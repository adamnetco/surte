// Outbox: queues mutations while offline and flushes them when back online.
// Idempotent via client_uuid stored alongside each operation.
import { supabase } from "@/integrations/supabase/client";
import { offlineDB, type OutboxItem, type OutboxOp } from "./db";

const MAX_ATTEMPTS = 8;
// Exponential backoff in ms: 5s, 10s, 30s, 60s, 120s, 300s, 300s, 300s
const BACKOFF_LADDER = [5_000, 10_000, 30_000, 60_000, 120_000, 300_000];
const backoffDelay = (attempts: number) =>
  BACKOFF_LADDER[Math.min(attempts, BACKOFF_LADDER.length - 1)];

function uuid() {
  return (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueue(op: OutboxOp, payload: any, organization_id: string): Promise<string> {
  const client_uuid: string = payload.client_uuid ?? uuid();
  const item: OutboxItem = {
    op,
    payload: { ...payload, client_uuid },
    created_at: Date.now(),
    attempts: 0,
    status: "pending",
    organization_id,
    client_uuid,
  };
  await offlineDB.outbox.add(item);

  // Ask the service worker to register a Background Sync (best-effort).
  try {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      // @ts-expect-error: sync is non-standard but supported on Chromium.
      await reg.sync?.register("outbox-sync");
    }
  } catch { /* no-op */ }

  // Try immediate flush if online; otherwise wait for "online" event.
  if (navigator.onLine) flushOutbox().catch(() => {});
  return client_uuid;
}

export async function pendingCount(): Promise<number> {
  return offlineDB.outbox.where("status").anyOf("pending", "failed").count();
}

let flushing = false;
export async function flushOutbox(): Promise<{ sent: number; failed: number; skipped: number }> {
  if (flushing || !navigator.onLine) return { sent: 0, failed: 0, skipped: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  try {
    const items = await offlineDB.outbox
      .where("status")
      .anyOf("pending", "failed")
      .sortBy("created_at");

    const now = Date.now();
    for (const item of items) {
      // Respect exponential backoff window for previously failed items.
      if (item.status === "failed" && item.attempts > 0) {
        const nextAt = item.created_at + backoffDelay(item.attempts - 1);
        if (now < nextAt) { skipped++; continue; }
      }
      try {
        await offlineDB.outbox.update(item.id!, { status: "syncing", attempts: item.attempts + 1 });
        await executeOp(item);
        await offlineDB.outbox.update(item.id!, { status: "done", last_error: undefined });
        sent++;
        await setMeta("last_sync_success_at", Date.now());
        failed++;
        const attempts = item.attempts + 1;
        const isPermanent = attempts >= MAX_ATTEMPTS;
        await offlineDB.outbox.update(item.id!, {
          status: isPermanent ? "failed" : "failed",
          attempts,
          last_error: `${isPermanent ? "[GAVE UP] " : ""}${String(e?.message ?? e)}`,
        });
      }
    }
    // Garbage-collect "done" items older than 1 day.
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    await offlineDB.outbox.where("status").equals("done").and((i) => i.created_at < cutoff).delete();
  } finally {
    flushing = false;
  }
  return { sent, failed, skipped };
}

async function executeOp(item: OutboxItem) {
  const { op, payload } = item;
  switch (op) {
    case "pos_order_create": {
      // Idempotent: if an order with this client_uuid already exists, reuse it.
      const { data: existing } = await (supabase as any)
        .from("pos_orders")
        .select("id")
        .eq("client_uuid", item.client_uuid)
        .maybeSingle();

      let orderId: string;
      if (existing?.id) {
        orderId = existing.id;
      } else {
        const { data: order, error } = await supabase
          .from("pos_orders")
          .insert({ ...payload.header, client_uuid: item.client_uuid })
          .select("id")
          .single();
        if (error) throw error;
        orderId = order.id;

        if (payload.items?.length) {
          const lines = payload.items.map((l: any) => ({ ...l, pos_order_id: orderId }));
          const { error: e2 } = await supabase.from("pos_order_items").insert(lines);
          if (e2) throw e2;
        }
        if (payload.payments?.length) {
          const pays = payload.payments.map((p: any) => ({ ...p, pos_order_id: orderId }));
          const { error: e3 } = await supabase.from("pos_payments").insert(pays);
          if (e3) throw e3;
        }
      }
      return orderId;
    }
    case "pos_payment_register": {
      const { error } = await supabase.from("pos_payments").insert(payload);
      if (error) throw error;
      return;
    }
    case "einvoice_emit": {
      const { error } = await supabase.functions.invoke("innapsis-emit", { body: payload });
      if (error) throw error;
      return;
    }
    case "quote_save": {
      const { error } = await supabase.from("pos_quotes").insert(payload);
      if (error) throw error;
      return;
    }
    case "park_ticket": {
      const { error } = await supabase.from("parked_tickets").insert(payload);
      if (error) throw error;
      return;
    }
    case "stock_movement": {
      const { error } = await supabase.rpc("apply_stock_movement", payload);
      if (error) throw error;
      return;
    }
    default:
      throw new Error(`Unknown op: ${op}`);
  }
}

// Wire global listeners once at app boot
let wired = false;
export function wireOutboxListeners() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", () => { flushOutbox().catch(() => {}); });
  // Periodic retry every 30s while the tab is open.
  setInterval(() => { if (navigator.onLine) flushOutbox().catch(() => {}); }, 30_000);
  // Service Worker may ask the page to flush after a `sync` event.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "outbox-flush") flushOutbox().catch(() => {});
    });
  }
}
