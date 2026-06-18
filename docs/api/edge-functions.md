# Edge Functions

Base: `https://dimyhjzcwlgfczimqhet.supabase.co/functions/v1/<nombre>`

Headers comunes:
```
apikey: <ANON_KEY>
Authorization: Bearer <ANON_KEY_O_ACCESS_TOKEN>
Content-Type: application/json
```

La mayoría se despliegan con `verify_jwt = false` (validan en código). Algunas son **webhooks públicos** y no requieren JWT.

---

## Variables de entorno de infraestructura

Estas variables aplican a edge functions de dominio/Cloudflare. Si no se definen, se usan los defaults productivos.

| Variable (Deno.env) | Variable Vite equivalente | Default | Usado en |
|---|---|---|---|
| `LOVABLE_EDGE_IP` | `VITE_LOVABLE_EDGE_IP` | `185.158.133.1` | UI de DNS (SiteDetailsPanel, Sitios, cloudTasks) |
| `LOVABLE_STOREFRONT_SLUG` | `VITE_LOVABLE_STOREFRONT_SLUG` | `sistecpos-storefront` | `provision-tenant-domain` (Cloudflare Pages project) |
| `LOVABLE_ROOT_DOMAIN` | `VITE_LOVABLE_ROOT_DOMAIN` | `sistecpos.com` | Validación de subdominios SaaS |
| `CLOUDFLARE_FALLBACK_HOSTNAME` | — | `sistecpos-storefront.pages.dev` | `cloudflare-domain-connect` (CNAME target SaaS) |
| `CLOUDFLARE_FALLBACK_ZONE_ID` | — | (Cloudflare zone del root SaaS) | edge functions Cloudflare |

Override sin redeploy del frontend: editar `.env.local` y reiniciar Vite (HMR recoge el cambio).

---

## Catálogo / E-commerce

### `get-landing`
`POST` `{ scope: "surteya", slug: "promo-mayo" }` → landing + secciones.

### `cart-sync`
`POST` sincroniza carrito omnicanal. Body: `{ cart_token, items, subtotal, total_items, phone?, channel? }`.

### `send-whatsapp-order`
`POST` `{ order_id }` → envía resumen del pedido por WhatsApp (YCloud, con fallback `wa.me`).

### `send-ycloud-whatsapp`
`POST` `{ to, template, params[] }`.

### `broadcast-whatsapp-ycloud`
`POST` `{ template, segment, params? }` — broadcast masivo.

### `process-scheduled-broadcasts`
`POST` (cron) procesa broadcasts en cola.

### `send-callmebot`
`POST` `{ phone?, apikey?, message }` — WhatsApp via CallMeBot, lee defaults de `app_settings`.

### `sync-order`
`POST` `{ order_id, webhook_url? }` — envía el pedido a sistema externo (ERP) y marca `external_sync_status`.

### `lead-capture` *(público)*
`POST` `{ full_name, email?, phone?, business_name?, plan_interest?, modules_interest?, utm? }` → crea fila en `crm_leads`.

---

## Email

### `resend-mail-service`
`POST` `{ to, subject, html|template_id, data? }` — wrapper Resend.

### `send-transactional-email`
`POST` `{ template, to, data }` — usa templates `_shared/transactional-email-templates`.

### `preview-transactional-email`
`GET ?template=order-confirmation&data=...` — render HTML para preview.

### `process-email-queue`
`POST` (cron) — procesa `pgmq.email_queue`.

### `auth-email-hook`
Hook de Supabase Auth: customiza emails de magic-link, signup, recovery, invite, etc. (renderizados con React-Email en `_shared/email-templates`).

### `handle-email-suppression` / `handle-email-unsubscribe`
Webhooks Resend (bounces, quejas) + endpoint público `?token=...` para desuscribir.

---

## Push web

### `get-vapid-public-key` *(público)* → `{ key }`.
### `send-web-push`
`POST` `{ subscription_ids[]|topic, title, body, url? }`.

---

## SEO / Multi-tenant

### `sitemap` *(público)*
`GET /functions/v1/sitemap?site=surteya` → XML sitemap dinámico.

### `resolve-tenant` *(público)*
`POST` `{ host }` → datos del tenant (logo, colores, WP config).

### `verify-tenant-domain`
`POST` `{ site_id, hostname }` → comprueba DNS/TXT.

### `sync-products-to-wp`
`POST` `{ site_id, since? }` → publica productos hacia WordPress.

### `wp-revalidate-webhook` *(público)*
`POST` desde WP → invalida caches.

---

## Reseñas / IA

### `fetch-google-reviews`
`POST` `{ place_id }` → trae reviews vía Google Places (New) y actualiza `google_reviews`.

### `ai-manager`
`POST` `{ organization_id }` → genera insights (Lovable AI Gateway, modelo Gemini 3 Flash). Inserta en `ai_insights`.

### `invoice-ocr`
`POST` multipart con PDF/imagen → extrae items, crea `invoice_scans` + `invoice_scan_items`.

---

## Facturación electrónica (Innapsis)

### `innapsis-emit`
`POST` `{ invoice_id }` → emite DIAN.
### `innapsis-status`
`POST` `{ invoice_id }` → consulta estado.

---

## Licencias / Desktop POS

### `license-issue`
`POST` `{ org_id, plan, max_terminals, expires_at? }` → crea licencia (Ed25519 keypair).

### `license-activate` *(público con clave)*
`POST` `{ license_key, fingerprint, hostname, platform, app_version }` → JWT firmado 7d.

### `license-heartbeat`
`POST` `{ license_key, fingerprint }` → `{ ok, status, expires_at }`.

### `license-purchase-webhook` *(público / firmado)*
Webhook de pasarela de pago → crea licencia automáticamente.

---

## Storage / Media

### `optimize-image`
`GET /optimize-image?url=...&w=800&q=80` → WebP optimizado con cache 1 año.

---

## Plantillas de invocación

### Con `fetch`:
```ts
const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-capture`, {
  method: "POST",
  headers: {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ full_name: "Eduardo", phone: "3001112233", source: "web" }),
});
const data = await res.json();
```

### Con SDK:
```ts
const { data, error } = await supabase.functions.invoke("send-whatsapp-order", {
  body: { order_id },
});
```
