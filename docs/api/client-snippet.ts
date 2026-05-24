// docs/api/client-snippet.ts
// Mini cliente reutilizable para hablar con la base de SURTÉ YA desde
// CUALQUIER proyecto externo (Node, Vite, Next, scripts, etc.).
//
// Instala:  npm i @supabase/supabase-js
//
// Uso:
//   import { surteya } from "./client-snippet";
//   const { data } = await surteya.from("products").select("*").eq("is_active", true).limit(20);
//   const { data: { session } } = await surteya.auth.signInWithPassword({ email, password });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SURTEYA_URL = "https://dimyhjzcwlgfczimqhet.supabase.co";

// Clave pública (anon). Está protegida por RLS — se puede commitear.
export const SURTEYA_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbXloanpjd2xnZmN6aW1xaGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODk1OTcsImV4cCI6MjA4OTc2NTU5N30.L2ERMQCCHYuJ51lhVffJaKIXKaVbwF0uGvkf-HxS6BI";

export const surteya: SupabaseClient = createClient(SURTEYA_URL, SURTEYA_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Helpers REST puros sin SDK (útiles desde Bash / Postman / Workers):
export const restHeaders = (accessToken?: string) => ({
  apikey: SURTEYA_ANON_KEY,
  Authorization: `Bearer ${accessToken ?? SURTEYA_ANON_KEY}`,
  "Content-Type": "application/json",
});

export const restURL = (path: string) => `${SURTEYA_URL}/rest/v1/${path}`;
export const fnURL = (name: string) => `${SURTEYA_URL}/functions/v1/${name}`;
