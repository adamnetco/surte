// Deno tests for einvoice-resend-bulk-admin.
// Covers AC1 (schema), AC2 (superadmin gate via handler), AC3 (error aislado por org),
// AC4 (dry_run no muta), AC5 (agregados y sync_logs).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");

const { handler, BodySchema, processBulkRetry } = await import("./index.ts");

// ---------- Fake Supabase builder ----------
type Op = { table: string; type: "select" | "update" | "insert"; payload?: any };

type FakeConfig = {
  pendingsByOrg?: Record<string, Array<{ id: string; organization_id: string }>>;
  queryErrByOrg?: Record<string, string>;
  updateErrByOrg?: Record<string, string>;
  outboxErr?: string;
};

function makeFake(cfg: FakeConfig = {}) {
  const ops: Op[] = [];

  function from(table: string) {
    let currentOrg: string | null = null;

    const selectBuilder: any = {
      select() { return selectBuilder; },
      eq(col: string, val: string) {
        if (col === "organization_id") currentOrg = val;
        return selectBuilder;
      },
      gte() { return selectBuilder; },
      async in(_col: string, _vals: string[]) {
        const org = currentOrg!;
        ops.push({ table, type: "select", payload: { org } });
        if (cfg.queryErrByOrg?.[org]) {
          return { data: null, error: { message: cfg.queryErrByOrg[org] } };
        }
        return { data: cfg.pendingsByOrg?.[org] ?? [], error: null };
      },
    };

    const updateBuilder: any = {
      async in(_col: string, ids: string[]) {
        const org = ids[0]?.split(":")[0] ?? "";
        ops.push({ table, type: "update", payload: { ids } });
        if (cfg.updateErrByOrg?.[org]) {
          return { error: { message: cfg.updateErrByOrg[org] } };
        }
        return { error: null };
      },
    };

    return {
      select() { return selectBuilder; },
      update(_patch: any) { return updateBuilder; },
      async insert(rows: any) {
        ops.push({ table, type: "insert", payload: rows });
        if (table === "sync_outbox" && cfg.outboxErr) {
          return { error: { message: cfg.outboxErr } };
        }
        return { error: null };
      },
    };
  }

  return { client: { from }, ops };
}

// ---------- BodySchema (AC1) ----------
Deno.test("BodySchema rejects empty organization_ids", () => {
  const r = BodySchema.safeParse({ organization_ids: [] });
  assertEquals(r.success, false);
});

Deno.test("BodySchema rejects more than 20 organization_ids", () => {
  const ids = Array.from({ length: 21 }, () => crypto.randomUUID());
  const r = BodySchema.safeParse({ organization_ids: ids });
  assertEquals(r.success, false);
});

Deno.test("BodySchema rejects non-uuid entries", () => {
  const r = BodySchema.safeParse({ organization_ids: ["not-a-uuid"] });
  assertEquals(r.success, false);
});

Deno.test("BodySchema accepts valid payload with optional batch_size/max_retries", () => {
  const r = BodySchema.safeParse({
    organization_ids: [crypto.randomUUID()],
    dry_run: true,
    batch_size: 50,
    max_retries: 3,
  });
  assertEquals(r.success, true);
});

// ---------- handler auth gates (AC2 / pre-checks) ----------
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://local/", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

Deno.test("OPTIONS preflight returns CORS headers", async () => {
  const res = await handler(new Request("http://local/", { method: "OPTIONS" }));
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("rejects missing Authorization with 401", async () => {
  const res = await handler(post({ organization_ids: [crypto.randomUUID()] }));
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "Unauthorized");
});

Deno.test("rejects non-Bearer Authorization with 401", async () => {
  const res = await handler(post({}, { Authorization: "Basic abc" }));
  assertEquals(res.status, 401);
  await res.text();
});

// ---------- processBulkRetry (AC3 / AC4 / AC5) ----------
Deno.test("dry_run=true does NOT update or insert into sync_outbox (AC4)", async () => {
  const orgA = crypto.randomUUID();
  const { client, ops } = makeFake({
    pendingsByOrg: { [orgA]: [{ id: "inv-1", organization_id: orgA }] },
  });
  const out = await processBulkRetry(
    client,
    { organization_ids: [orgA], dry_run: true },
    "user-1",
  );
  assertEquals(out.dry_run, true);
  assertEquals(out.total_orgs, 1);
  assertEquals(out.total_requeued, 0);
  assertEquals(out.results[0].status, "skipped");
  assertEquals(out.results[0].candidates, 1);
  // No update on electronic_invoices, no insert on sync_outbox
  assertEquals(ops.some((o) => o.table === "electronic_invoices" && o.type === "update"), false);
  assertEquals(ops.some((o) => o.table === "sync_outbox" && o.type === "insert"), false);
});

Deno.test("error in one org does NOT block remaining orgs (AC3)", async () => {
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const { client, ops } = makeFake({
    queryErrByOrg: { [orgA]: "boom" },
    pendingsByOrg: { [orgB]: [{ id: "inv-b1", organization_id: orgB }] },
  });
  const out = await processBulkRetry(
    client,
    { organization_ids: [orgA, orgB] },
    "user-1",
  );
  assertEquals(out.total_orgs, 2);
  assertEquals(out.results[0].status, "error");
  assertEquals(out.results[0].error, "boom");
  assertEquals(out.results[1].status, "success");
  assertEquals(out.results[1].requeued, 1);
  assertEquals(out.total_requeued, 1);
  // sync_logs row for the failing org with error status
  const failLog = ops.find(
    (o) => o.table === "sync_logs" && o.payload?.status === "error",
  );
  assertEquals(!!failLog, true);
  assertEquals(failLog?.payload?.payload?.phase, "query");
});

Deno.test("success path requeues all pendings and logs success (AC5)", async () => {
  const orgA = crypto.randomUUID();
  const { client, ops } = makeFake({
    pendingsByOrg: {
      [orgA]: [
        { id: "inv-1", organization_id: orgA },
        { id: "inv-2", organization_id: orgA },
      ],
    },
  });
  const out = await processBulkRetry(
    client,
    { organization_ids: [orgA], batch_size: 100, max_retries: 5 },
    "user-1",
  );
  assertEquals(out.success, true);
  assertEquals(out.total_requeued, 2);
  assertEquals(out.results[0].status, "success");

  const outbox = ops.find((o) => o.table === "sync_outbox" && o.type === "insert");
  assertEquals(Array.isArray(outbox?.payload), true);
  assertEquals(outbox?.payload.length, 2);
  assertEquals(outbox?.payload[0].payload.batch_size, 100);
  assertEquals(outbox?.payload[0].payload.max_retries, 5);
  assertEquals(outbox?.payload[0].payload.admin, true);

  const okLog = ops.find(
    (o) => o.table === "sync_logs" && o.payload?.status === "success",
  );
  assertEquals(okLog?.payload?.payload?.requeued_count, 2);
});

Deno.test("zero pendings returns success with candidates=0 and no mutations", async () => {
  const orgA = crypto.randomUUID();
  const { client, ops } = makeFake({ pendingsByOrg: { [orgA]: [] } });
  const out = await processBulkRetry(client, { organization_ids: [orgA] }, "user-1");
  assertEquals(out.results[0].status, "success");
  assertEquals(out.results[0].candidates, 0);
  assertEquals(out.total_requeued, 0);
  assertEquals(ops.some((o) => o.table === "sync_outbox"), false);
});
