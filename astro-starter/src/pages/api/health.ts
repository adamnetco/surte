import type { APIRoute } from "astro";
import { jsonResponse } from "../../lib/api";

export const prerender = false;

export const GET: APIRoute = () =>
  jsonResponse({ status: "ok", ts: new Date().toISOString(), runtime: "cloudflare-pages" });
