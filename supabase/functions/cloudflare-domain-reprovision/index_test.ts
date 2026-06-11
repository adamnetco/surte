// Deno tests for cloudflare-domain-reprovision handler.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("CLOUDFLARE_API_TOKEN", "test-token");
Deno.env.set("CLOUDFLARE_FALLBACK_ZONE_ID", "test-zone");
Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");

const { handler } = await import("./index.ts");

const post = (body: unknown) =>
  new Request("http://local/cloudflare-domain-reprovision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

Deno.test("OPTIONS preflight returns ok", async () => {
  const res = await handler(new Request("http://local/", { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("rejects non-POST methods with 405", async () => {
  const res = await handler(new Request("http://local/", { method: "GET" }));
  assertEquals(res.status, 405);
});

Deno.test("returns 500 when Cloudflare env is missing", async () => {
  const prev = Deno.env.get("CLOUDFLARE_FALLBACK_ZONE_ID")!;
  Deno.env.delete("CLOUDFLARE_FALLBACK_ZONE_ID");
  const res = await handler(post({ hostname: "x.com" }));
  Deno.env.set("CLOUDFLARE_FALLBACK_ZONE_ID", prev);
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, "cloudflare_not_configured");
});

Deno.test("rejects invalid JSON body with 400", async () => {
  const res = await handler(post("{not-json"));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_json");
});

Deno.test("rejects empty hostname with 400", async () => {
  const res = await handler(post({ hostname: "" }));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "hostname_required");
});
