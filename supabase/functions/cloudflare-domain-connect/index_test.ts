// Deno tests for cloudflare-domain-connect handler.
// Validation paths only — Cloudflare/Supabase calls are not mocked here.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Ensure required env exists BEFORE importing the module (handler reads them at request time).
Deno.env.set("CLOUDFLARE_API_TOKEN", "test-token");
Deno.env.set("CLOUDFLARE_FALLBACK_ZONE_ID", "test-zone");
Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");

const { handler } = await import("./index.ts");

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://local/cloudflare-domain-connect", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

Deno.test("OPTIONS preflight returns ok with CORS headers", async () => {
  const res = await handler(new Request("http://local/", { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("rejects non-POST methods with 405", async () => {
  const res = await handler(new Request("http://local/", { method: "GET" }));
  assertEquals(res.status, 405);
  assertEquals((await res.json()).error, "method_not_allowed");
});

Deno.test("returns 500 when Cloudflare env is missing", async () => {
  const prev = Deno.env.get("CLOUDFLARE_API_TOKEN")!;
  Deno.env.delete("CLOUDFLARE_API_TOKEN");
  const res = await handler(post({ tenant_id: "t", hostname: "x.com" }));
  Deno.env.set("CLOUDFLARE_API_TOKEN", prev);
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, "cloudflare_not_configured");
});

Deno.test("rejects missing Authorization with 401", async () => {
  const res = await handler(post({ tenant_id: "t", hostname: "x.com" }));
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error, "unauthorized");
});

Deno.test("rejects malformed Authorization header with 401", async () => {
  const res = await handler(post({}, { Authorization: "NotBearer abc" }));
  assertEquals(res.status, 401);
});
