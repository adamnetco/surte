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
  // POS-optimizar-bulk-retry-timeouts: simular falla en lotes específicos.
  outboxErrAtCall?: number[]; // call indices (0-based) que deben fallar
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
      gt() { return selectBuilder; },
      order() { return selectBuilder; },
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

    let outboxCallIdx = -1;
    return {
      select() { return selectBuilder; },
      update(_patch: any) { return updateBuilder; },
      async insert(rows: any) {
        ops.push({ table, type: "insert", payload: rows });
        if (table === "sync_outbox") {
          outboxCallIdx++;
          const outboxCalls = ops.filter((o) => o.table === "sync_outbox" && o.type === "insert").length - 1;
          if (cfg.outboxErr) return { error: { message: cfg.outboxErr } };
          if (cfg.outboxErrAtCall?.includes(outboxCalls)) {
            return { error: { message: `outbox_batch_${outboxCalls}_failed` } };
          }
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

Deno.test({
  name: "rejects missing Authorization with 401",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const res = await handler(post({ organization_ids: [crypto.randomUUID()] }));
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "Unauthorized");
  },
});

Deno.test({
  name: "rejects non-Bearer Authorization with 401",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const res = await handler(post({}, { Authorization: "Basic abc" }));
    assertEquals(res.status, 401);
    await res.text();
  },
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

// ---------- POS-optimizar-bulk-retry-timeouts (AC1/AC2/AC3/AC5) ----------
Deno.test("AC5: 250 pendings split into 3 batches (100/100/50) with single aggregated sync_log", async () => {
  const orgA = crypto.randomUUID();
  const pendings = Array.from({ length: 250 }, (_, i) => ({
    id: `inv-${i}`,
    organization_id: orgA,
  }));
  const { client, ops } = makeFake({ pendingsByOrg: { [orgA]: pendings } });

  const out = await processBulkRetry(
    client,
    { organization_ids: [orgA], batch_size: 100 },
    "user-1",
  );

  assertEquals(out.total_requeued, 250);
  assertEquals(out.partial, false);
  assertEquals(out.results[0].status, "success");
  assertEquals(out.results[0].batches?.length, 3);
  assertEquals(out.results[0].batches?.map((b) => b.candidates), [100, 100, 50]);
  assertEquals(out.results[0].batches?.map((b) => b.requeued), [100, 100, 50]);
  assertEquals(out.results[0].batches?.every((b) => b.status === "success"), true);

  // 3 inserts en sync_outbox (uno por lote)
  const outboxInserts = ops.filter((o) => o.table === "sync_outbox" && o.type === "insert");
  assertEquals(outboxInserts.length, 3);
  assertEquals(outboxInserts.map((o) => o.payload.length), [100, 100, 50]);

  // 3 updates de electronic_invoices (uno por lote)
  const updates = ops.filter((o) => o.table === "electronic_invoices" && o.type === "update");
  assertEquals(updates.length, 3);

  // Un único sync_logs agregado de éxito (AC5)
  const okLogs = ops.filter(
    (o) => o.table === "sync_logs" && o.payload?.status === "success",
  );
  assertEquals(okLogs.length, 1);
  assertEquals(okLogs[0].payload.payload.batches, 3);
  assertEquals(okLogs[0].payload.payload.failed_batches, 0);
  assertEquals(okLogs[0].payload.payload.batch_size, 100);
  assertEquals(okLogs[0].payload.payload.requeued_count, 250);
});

Deno.test("AC2/AC3: failure in one batch logs phase=batch_N and continues with next batch (partial=true)", async () => {
  const orgA = crypto.randomUUID();
  const pendings = Array.from({ length: 150 }, (_, i) => ({
    id: `inv-${i}`,
    organization_id: orgA,
  }));
  const { client, ops } = makeFake({
    pendingsByOrg: { [orgA]: pendings },
    outboxErrAtCall: [0], // primer lote falla en outbox
  });

  const out = await processBulkRetry(
    client,
    { organization_ids: [orgA], batch_size: 100 },
    "user-1",
  );

  assertEquals(out.partial, true);
  assertEquals(out.total_requeued, 50); // solo el 2º lote pasó
  const org = out.results[0];
  assertEquals(org.status, "success"); // hubo al menos un lote OK
  assertEquals(org.partial, true);
  assertEquals(org.batches?.[0].status, "error");
  assertEquals(org.batches?.[1].status, "success");

  // sync_logs con phase=batch_0 para el lote fallido
  const phaseLog = ops.find(
    (o) =>
      o.table === "sync_logs" &&
      o.payload?.payload?.phase === "batch_0",
  );
  assertEquals(!!phaseLog, true);
  assertEquals(phaseLog?.payload?.status, "error");

  // Un único sync_logs agregado, con failed_batches=1
  const aggLogs = ops.filter(
    (o) =>
      o.table === "sync_logs" &&
      o.payload?.payload?.action === "bulk_admin" &&
      typeof o.payload?.payload?.failed_batches === "number",
  );
  assertEquals(aggLogs.length, 1);
  assertEquals(aggLogs[0].payload.payload.failed_batches, 1);
  assertEquals(aggLogs[0].payload.payload.requeued_count, 50);
});

Deno.test("AC3: when ALL batches fail, org status=error and total_requeued=0", async () => {
  const orgA = crypto.randomUUID();
  const pendings = Array.from({ length: 200 }, (_, i) => ({
    id: `inv-${i}`,
    organization_id: orgA,
  }));
  const { client } = makeFake({
    pendingsByOrg: { [orgA]: pendings },
    outboxErr: "outbox_down",
  });

  const out = await processBulkRetry(
    client,
    { organization_ids: [orgA], batch_size: 100 },
    "user-1",
  );

  assertEquals(out.total_requeued, 0);
  assertEquals(out.partial, true);
  assertEquals(out.results[0].status, "error");
  assertEquals(out.results[0].batches?.length, 2);
  assertEquals(out.results[0].batches?.every((b) => b.status === "error"), true);
});

Deno.test("AC1: default batch_size=100 when not provided", async () => {
  const orgA = crypto.randomUUID();
  const pendings = Array.from({ length: 120 }, (_, i) => ({
    id: `inv-${i}`,
    organization_id: orgA,
  }));
  const { client, ops } = makeFake({ pendingsByOrg: { [orgA]: pendings } });

  const out = await processBulkRetry(
    client,
    { organization_ids: [orgA] }, // sin batch_size
    "user-1",
  );

  assertEquals(out.results[0].batches?.length, 2);
  assertEquals(out.results[0].batches?.map((b) => b.candidates), [100, 20]);

  const okLog = ops.find(
    (o) => o.table === "sync_logs" && o.payload?.status === "success",
  );
  assertEquals(okLog?.payload?.payload?.batch_size, 100);
});

// ---------- POS-optimizar-bulk-retry-timeouts AC4 (wallclock + cursor) ----------
Deno.test("AC4: wallclock guard truncates between batches and returns next_cursor", async () => {
  const orgA = crypto.randomUUID();
  const pendings = Array.from({ length: 300 }, (_, i) => ({
    id: `inv-${String(i).padStart(4, "0")}`,
    organization_id: orgA,
  }));
  const { client, ops } = makeFake({ pendingsByOrg: { [orgA]: pendings } });

  // Reloj determinista: deja correr el primer lote y excede deadline antes del 2º.
  // budget=50s; ticks consumidos: startedAt, outer-check orgA, pre-batch 0, pre-batch 1.
  const ticks = [0, 1_000, 2_000, 60_000, 60_000, 60_000];
  let i = 0;
  const now = () => ticks[Math.min(i++, ticks.length - 1)];

  const out = await processBulkRetry(
    client,
    { organization_ids: [orgA], batch_size: 100, wallclock_ms: 50_000 },
    "user-1",
    now,
  );

  assertEquals(out.truncated, true);
  assertEquals(out.partial, true);
  assertEquals(out.next_cursor?.organization_id, orgA);
  // Solo el primer lote debió procesarse (los siguientes se cortaron por wallclock).
  assertEquals(out.results[0].requeued, 100);
  assertEquals(out.results[0].truncated, true);
  assertEquals(out.next_cursor?.last_processed_id, "inv-0099");

  const outboxInserts = ops.filter((o) => o.table === "sync_outbox" && o.type === "insert");
  assertEquals(outboxInserts.length, 1);

  const aggLog = ops.find(
    (o) =>
      o.table === "sync_logs" &&
      o.payload?.payload?.action === "bulk_admin" &&
      o.payload?.payload?.truncated === true,
  );
  assertEquals(!!aggLog, true);
  assertEquals(aggLog?.payload?.payload?.last_processed_id, "inv-0099");
});

Deno.test("AC4: cursor resumes from last_processed_id and skips earlier orgs", async () => {
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const { client, ops } = makeFake({
    // Si la lógica respeta el cursor, NO debe leer orgA (saltado).
    pendingsByOrg: {
      [orgB]: [
        { id: "inv-b1", organization_id: orgB },
        { id: "inv-b2", organization_id: orgB },
      ],
    },
  });

  const out = await processBulkRetry(
    client,
    {
      organization_ids: [orgA, orgB],
      cursor: { organization_id: orgB, last_processed_id: "inv-b0" },
    },
    "user-1",
  );

  // Resultados solo contienen orgB.
  assertEquals(out.results.length, 1);
  assertEquals(out.results[0].organization_id, orgB);
  assertEquals(out.results[0].requeued, 2);
  assertEquals(out.truncated, false);

  // No debió consultar orgA.
  const orgASelect = ops.find(
    (o) => o.table === "electronic_invoices" && o.type === "select" && o.payload?.org === orgA,
  );
  assertEquals(!!orgASelect, false);
});

Deno.test("AC4: budget agotado antes de tocar la siguiente org devuelve next_cursor a esa org", async () => {
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const { client } = makeFake({
    pendingsByOrg: {
      [orgA]: [{ id: "inv-a1", organization_id: orgA }],
      [orgB]: [{ id: "inv-b1", organization_id: orgB }],
    },
  });

  // Reloj: deja procesar orgA completa, luego excede deadline antes de orgB.
  const ticks = [0, 5_000, 10_000, 15_000, 60_000, 60_000, 60_000];
  let i = 0;
  const now = () => ticks[Math.min(i++, ticks.length - 1)];

  const out = await processBulkRetry(
    client,
    { organization_ids: [orgA, orgB], batch_size: 100, wallclock_ms: 30_000 },
    "user-1",
    now,
  );

  assertEquals(out.truncated, true);
  assertEquals(out.next_cursor?.organization_id, orgB);
  assertEquals(out.next_cursor?.last_processed_id, null);
  assertEquals(out.results.length, 1);
  assertEquals(out.results[0].organization_id, orgA);
});

Deno.test("AC4: BodySchema acepta wallclock_ms y cursor", () => {
  const r = BodySchema.safeParse({
    organization_ids: [crypto.randomUUID()],
    wallclock_ms: 30_000,
    cursor: { organization_id: crypto.randomUUID(), last_processed_id: "inv-1" },
  });
  assertEquals(r.success, true);
});
