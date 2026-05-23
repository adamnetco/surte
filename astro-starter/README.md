# Astro Tenant Starter (Sistecpos + WP Headless)

Plantilla independiente para desplegar **un solo proyecto Astro en Vercel** que sirve a **muchos negocios** (multi-tenant) con WordPress headless por cliente y dominio propio.

## Cómo funciona

1. Cada request entra con un `Host` (ej. `www.minegocio.com`).
2. `src/lib/tenant.ts` llama a la edge function `resolve-tenant` de Sistecpos.
3. La función devuelve `{ name, logo, colors, wp_base_url, ... }` del negocio.
4. La página obtiene contenido de **ese** WordPress y renderiza con los colores del cliente.
5. Vercel cachea cada combinación (host + ruta) vía ISR (10 min por defecto).

## Setup

```bash
cd astro-starter
npm install
cp .env.example .env       # rellena PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

## Deploy

1. Sube este folder como repo a GitHub.
2. **Vercel → New Project** → importa el repo.
3. Variables de entorno:
   - `PUBLIC_SUPABASE_URL` = `https://dimyhjzcwlgfczimqhet.supabase.co`
   - `PUBLIC_SUPABASE_ANON_KEY` = (la anon key publicable)
4. **Settings → Domains**: añade los dominios de los clientes (`www.cliente1.com`, `www.cliente2.com`, …). Vercel emite SSL automáticamente.
5. El cliente apunta su DNS:
   - `CNAME www → cname.vercel-dns.com`
   - o `A @ → 76.76.21.21`

## Onboarding un nuevo cliente

1. En el panel admin `/sitios` de Sistecpos: crea el sitio, configura su URL de WP y publícalo.
2. Añade el dominio en la pestaña "Dominios".
3. Añade ese mismo dominio en Vercel → Settings → Domains.
4. El cliente configura el DNS.
5. Listo: el sitio levanta sin desplegar nada nuevo.

## Para >100 clientes (recomendado)

Usar **Cloudflare for SaaS** en vez del flujo de Domains de Vercel: emite SSL on-demand para miles de hostnames con un solo CNAME objetivo. Apunta Cloudflare for SaaS → tu proyecto Vercel.
