// Stub for auth-recovery-consume.
// Real implementation pending: see .lovable/pending-cloud-tasks.md §5.
// Expected input fields: user_id:string,code:string
import { preflight, notReady, safeJson, json } from "../_shared/auth-stub.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  const body = await safeJson<Record<string, unknown>>(req);
  if (!body) return json({ error: "invalid_json" }, 400);
  // TODO: validate fields (user_id:string,code:string) with zod once subsystem is live.
  return notReady("auth-recovery-consume");
});
