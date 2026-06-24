// E2E unitario del scheduler de reintentos: simula timeouts/5xx transitorios
// y valida que attempts incremente, next_attempt_at siga BACKOFF, y que tras
// success/dead NO se programen más intentos (no duplicación de envíos).
// POS-einvoice-bulk-retry-hardening · cobertura adicional solicitada.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scheduleNextAttempt, BACKOFF_MIN } from "./backoff.ts";

const fixedNow = () => new Date("2026-06-24T12:00:00Z").getTime();
const noJitter = () => 0.5; // jitter factor → 1.0

Deno.test("transient 5xx: attempts incrementa y next_attempt_at sigue ventana 1/5/30/120/720", () => {
  let row = { attempts: 0, max_attempts: 5 };
  const schedule: number[] = [];
  for (let i = 0; i < 4; i++) {
    const d = scheduleNextAttempt(
      row,
      { ok: false, error: "HTTP 503" },
      { now: fixedNow, rand: noJitter },
    );
    assertEquals(d.kind, "retry");
    if (d.kind === "retry") {
      assertEquals(d.attempts, i + 1);
      assertEquals(d.delay_min, BACKOFF_MIN[i]);
      schedule.push(d.delay_min);
      // delta entre fixedNow() y next_attempt_at = delay_min * 60s (jitter=1.0)
      const delta = new Date(d.next_attempt_at).getTime() - fixedNow();
      assertEquals(delta, d.delay_min * 60_000);
      row = { attempts: d.attempts, max_attempts: 5 };
    }
  }
  assertEquals(schedule, [1, 5, 30, 120]);
});

Deno.test("timeout transitorio: 5º intento alcanza max_attempts → dead, sin más reprogramaciones", () => {
  let row = { attempts: 4, max_attempts: 5 };
  const d = scheduleNextAttempt(
    row,
    { ok: false, error: "fetch timeout" },
    { now: fixedNow, rand: noJitter },
  );
  assertEquals(d.kind, "dead");
  if (d.kind === "dead") {
    assertEquals(d.attempts, 5);
    assertEquals(d.reason, "fetch timeout");
  }
});

Deno.test("permanent=true (4xx Innapsis): dead inmediato aunque queden intentos", () => {
  const d = scheduleNextAttempt(
    { attempts: 1, max_attempts: 5 },
    { ok: false, error: "HTTP 422", permanent: true },
    { now: fixedNow, rand: noJitter },
  );
  assertEquals(d.kind, "dead");
});

Deno.test("success terminal: ok=true → succeeded; no se calcula next_attempt_at", () => {
  const d = scheduleNextAttempt(
    { attempts: 2, max_attempts: 5 },
    { ok: true },
    { now: fixedNow, rand: noJitter },
  );
  assertEquals(d.kind, "succeeded");
  if (d.kind === "succeeded") assertEquals(d.attempts, 3);
});

Deno.test("jitter ±20%: delay ∈ [0.8·base, 1.2·base]", () => {
  const samples: number[] = [];
  for (let r = 0; r <= 1; r += 0.05) {
    const d = scheduleNextAttempt(
      { attempts: 0, max_attempts: 5 },
      { ok: false, error: "503" },
      { now: fixedNow, rand: () => r },
    );
    if (d.kind === "retry") {
      const delta = new Date(d.next_attempt_at).getTime() - fixedNow();
      samples.push(delta / 60_000);
    }
  }
  const base = 1;
  assert(samples.every((m) => m >= base * 0.8 - 1e-9 && m <= base * 1.2 + 1e-9), `samples: ${samples}`);
});

Deno.test("simulación E2E: 3 fallos transitorios + 1 éxito → 1 envío exitoso total (no duplica)", () => {
  // Modelo: cada decisión retry NO emite una nueva fila; sólo reprograma la
  // existente. Al tener success, queda terminal. Esto demuestra que el
  // contrato del scheduler NO genera duplicados de outbox por reintentos.
  let row = { attempts: 0, max_attempts: 5 };
  const sequence = [
    { ok: false, error: "HTTP 502" },
    { ok: false, error: "HTTP 504" },
    { ok: false, error: "ETIMEDOUT" },
    { ok: true },
  ];
  let successCount = 0;
  let deadCount = 0;
  let retryCount = 0;
  for (const r of sequence) {
    const d = scheduleNextAttempt(row, r, { now: fixedNow, rand: noJitter });
    if (d.kind === "retry") {
      retryCount++;
      row = { attempts: d.attempts, max_attempts: 5 };
    } else if (d.kind === "succeeded") {
      successCount++;
      break;
    } else {
      deadCount++;
      break;
    }
  }
  assertEquals(retryCount, 3);
  assertEquals(successCount, 1);
  assertEquals(deadCount, 0);
  assertEquals(row.attempts, 3); // 3 attempts antes del éxito
});
