// Outbox: queues mutations while offline and flushes them when back online.
// Idempotent via client_uuid stored alongside each operation.
import { supabase } from "@/integrations/supabase/client";
import { offlineDB, type OutboxItem, type OutboxOp } from "./db";

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
  // Try immediate flush if online; otherwise wait for "online" event
  if (navigator.onLine) flushOutbox().catch(() => {});
  return client_uuid;
}

export async function pendingCount(): Promise<number> {
  return offlineDB.outbox.where("status").anyOf("pending", "failed").count();
}

let flushing = false;
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  if (flushing || !navigator.onLine) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const items = await offlineDB.outbox
      .where("status")
      .anyOf("pending", "failed")
      .sortBy("created_at");

    for (const item of items) {
      try {
        await offlineDB.outbox.update(item.id!, { status: "syncing", attempts: item.attempts + 1 });
        await executeOp(item);
        await offlineDB.outbox.update(item.id!, { status: "done" });
        sent++;
      } catch (e: any) {
        failed++;
        await offlineDB.outbox.update(item.id!, {
          status: "failed",
          last_error: String(e?.message ?? e),
        });
      }
    }
    // Garbage-collect "done" items older than 1 day
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    await offlineDB.outbox.where("status").equals("done").and((i) => i.created_at < cutoff).delete();
  } finally {
    flushing = false;
  }
  return { sent, failed };
}

async function executeOp(item: OutboxItem) {
  const { op, payload } = item;
  switch (op) {
    case "pos_order_create": {
      // Insert order header + items. RPC could replace this for atomicity.
      const { data: order, error } = await supabase
        .from("pos_orders")
        .insert({ ...payload.header, client_uuid: item.client_uuid })
        .select("id")
        .single();
      if (error) throw error;
      if (payload.items?.length) {
        const lines = payload.items.map((l: any) => ({ ...l, pos_order_id: order.id }));
        const { error: e2 } = await supabase.from("pos_order_items").insert(lines);
        if (e2) throw e2;
      }
      return order.id;
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
  window.addEventListener("online", () => {
    flushOutbox().catch(() => {});
  });
  // Periodic retry every 60s while tab is open
  setInterval(() => {
    if (navigator.onLine) flushOutbox().catch(() => {});
  }, 60_000);
}
