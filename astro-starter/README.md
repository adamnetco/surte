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

## Deploy (Lovable hosting)

El storefront se sirve desde **Lovable Cloud** (mismo hosting que el panel SistecPOS). No se despliega en Vercel.

1. Publica el proyecto SistecPOS Core en Lovable (botón **Publish**).
2. En **Project Settings → Domains** añade los dominios de los clientes (`www.cliente1.com`, etc.). Lovable provisiona SSL automáticamente.
3. El cliente apunta su DNS:
   - `A @ → 185.158.133.1`
   - `A www → 185.158.133.1`
   - `TXT _lovable → lovable_verify=<token>` (mostrado en el flujo de conexión)

## Onboarding un nuevo cliente

1. En el panel admin `/sitios` de Sistecpos: crea el sitio, configura su URL de WP y publícalo.
2. Añade el dominio en la pestaña "Dominios" (genera el `_lovable-tenant` token).
3. Añade ese mismo dominio en **Lovable → Project Settings → Domains**.
4. El cliente configura el DNS (A records + TXT de verificación).
5. Listo: el sitio levanta sin desplegar nada nuevo.

## Para >100 clientes (recomendado)

Usar **Cloudflare for SaaS** delante de Lovable: emite SSL on-demand para miles de hostnames con un solo CNAME objetivo. El wizard `/sitios → Conectar dominio` ya soporta el modo `saas` para este flujo.

