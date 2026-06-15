// Helpers compartidos por los endpoints en src/pages/api/*
// Cloudflare Pages Functions (Astro SSR) los ejecuta en el edge.

import { resolveTenant, type Tenant } from "./tenant";

export const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL!;
export const ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY!;

export const supaHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
} as const;

export const jsonResponse = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": init.headers && (init.headers as any)["Cache-Control"]
        ? (init.headers as any)["Cache-Control"]
        : "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      ...(init.headers ?? {}),
    },
  });

export const errorResponse = (status: number, code: string, message: string, details?: unknown) =>
  jsonResponse({ error: { code, message, details } }, { status });

export const corsPreflight = () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });

export async function requireTenant(req: Request): Promise<Tenant | Response> {
  const host = req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);
  if (!tenant) return errorResponse(404, "TENANT_NOT_FOUND", `No tenant for host ${host}`);
  return tenant;
}

export async function supaRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...supaHeaders, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function supaFn<T>(name: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: body !== undefined ? "POST" : "GET",
    ...init,
    headers: { ...supaHeaders, ...(init.headers ?? {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`fn ${name} ${res.status}: ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}
