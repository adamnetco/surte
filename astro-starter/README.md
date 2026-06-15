# SistecPOS Astro Storefront

Storefront **multi-tenant** del ecosistema SistecPOS, construido con **Astro 5 (SSR)** y desplegado en **Cloudflare Pages** (Pages Functions).

Un único deploy sirve a todos los tenants. Cada request se resuelve por el header `Host` contra la edge function `resolve-tenant` de Supabase, que devuelve `organization_id`, branding y configuración de WordPress headless opcional.

---

## Stack

| Capa | Tecnología | Versión |
|------|------------|---------|
| Framework | [Astro](https://astro.build) (SSR) | `^5.8.0` |
| Adapter | [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) | `^12.5.0` |
| Estilos | Tailwind CSS via `@astrojs/tailwind` | `^6.0.0` / `^3.4.0` |
| Backend | Supabase (Postgres + Edge Functions) | — |
| Hosting | Cloudflare Pages (Functions runtime) | — |

> Requiere `compatibility_flags = ["nodejs_compat"]` en `wrangler.toml` (ya configurado).

---

## Estructura

```
astro-starter/
├── astro.config.mjs        # adapter Cloudflare + Tailwind
├── wrangler.toml           # config de Cloudflare Pages
├── tailwind.config.mjs
├── public/
│   └── _routes.json        # excluye assets estáticos del runtime SSR
└── src/
    ├── layouts/Base.astro
    ├── lib/
    │   ├── tenant.ts       # resolveTenant(host) → cache 5 min
    │   ├── store.ts        # helpers PostgREST (catálogo, pedidos)
    │   └── api.ts          # helpers para endpoints /api/*
    └── pages/
        ├── index.astro              # home (landing CMS + fallback WP)
        ├── catalogo.astro
        ├── categoria/[slug].astro
        ├── producto/[slug].astro
        ├── pedido/[number].astro
        ├── l/[slug].astro           # landings dinámicas (CMS)
        ├── blog/[slug].astro        # WP headless
        ├── carrito.astro
        ├── sitemap.xml.ts
        ├── robots.txt.ts
        └── api/                     # endpoints SSR
            ├── health.ts
            ├── tenant.ts
            ├── categories.ts
            ├── categories/[slug].ts
            ├── products/index.ts    # ?category=&search=&page=&pageSize=
            ├── products/[slug].ts
            ├── order/[number].ts
            ├── cart-sync.ts         # POST → proxy edge fn
            ├── checkout.ts          # POST → genera wa.me URL
            ├── lead.ts              # POST → proxy lead-capture
            └── landing/[slug].ts
```

---

## Variables de entorno

Todas las variables **públicas** (consultables desde el navegador y desde SSR) deben empezar con `PUBLIC_`.

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `PUBLIC_SUPABASE_URL` | ✅ | URL del proyecto Supabase (`https://xxx.supabase.co`) |
| `PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key del proyecto |
| `PUBLIC_WA_DEFAULT_PHONE` | ⛔ opcional | Teléfono fallback para `/api/checkout` cuando el tenant no tenga `whatsapp_phone` en BD |

Local: copia `.env.example` a `.env`.
Cloudflare Pages: **Settings → Environment variables** (Production + Preview).

---

## Desarrollo local

```bash
cd astro-starter
bun install               # o: npm install
cp .env.example .env      # edita con tus claves
bun run dev               # http://localhost:4321
```

Para probar **multi-tenant** localmente, edita `/etc/hosts`:

```
127.0.0.1   surteya.localhost
127.0.0.1   dimanti.localhost
```

Y navega a `http://surteya.localhost:4321`. El resolver detecta el subdominio y carga el tenant correcto.

---

## Build

```bash
bun run build             # genera ./dist (server entry + assets)
bun run preview           # corre dist en wrangler con nodejs_compat
```

`bun run preview` ejecuta `wrangler pages dev ./dist --compatibility-flag=nodejs_compat`, replicando el runtime real de Cloudflare.

---

## Deploy en Cloudflare Pages

Dos caminos: **CLI (Wrangler)** o **integración Git**. La integración Git es la recomendada (deploys automáticos por commit + previews por PR).

> ⚠️ **IMPORTANTE — No confundir Pages con Workers Builds**
>
> Cloudflare muestra dos flujos parecidos al conectar un repo. Elige el correcto:
>
> | Flujo | Cuándo elegirlo | Pista visual |
> |-------|-----------------|--------------|
> | ✅ **Pages → Connect to Git** | Este proyecto. Usa `@astrojs/cloudflare` + `output: "server"` que emite formato Pages (`dist/_worker.js/`). | Pide "Framework preset" y "Build output directory". |
> | ❌ **Workers & Pages → Import a repository (Workers Builds)** | Solo para Workers puros con `wrangler deploy`. **No usar** aquí. | Pide "Comando de despliegue" (`npx wrangler deploy`) y "Camino: dist". |
>
> Si terminas en la pantalla de Workers Builds (la que pide `npx wrangler deploy` y "Construcciones para sucursales no productivas"), **vuelve atrás** y entra por **Pages → Connect to Git**. Nuestro `wrangler.toml` está configurado para Pages (`pages_build_output_dir = "dist"`), no para Worker independiente.

### Opción A — Integración Git (recomendado)

1. **Push del repo** a GitHub / GitLab.
2. En Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Selecciona el repo y configura:

   | Campo | Valor (repo separado) | Valor (monorepo) |
   |-------|------------------------|-------------------|
   | Project name | `sistecpos-storefront` | `sistecpos-storefront` |
   | Production branch | `main` | `main` |
   | Framework preset | `Astro` | `Astro` |
   | Build command | `bun install && bun run build` | `cd astro-starter && bun install && bun run build` |
   | Build output directory | `dist` | `astro-starter/dist` |
   | Root directory (advanced) | `/` (vacío) | `/` (vacío) |

4. **Environment variables** — agrega **una por fila** (no las pegues juntas en un mismo campo):

   | Nombre | Valor | Cifrar |
   |--------|-------|--------|
   | `PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | No |
   | `PUBLIC_SUPABASE_ANON_KEY` | anon key (`eyJhbGciOi...`) | No |
   | `PUBLIC_WA_DEFAULT_PHONE` | número WhatsApp con código país, sin `+` (ej. `573001234567`) | No |

   > Las variables `PUBLIC_*` van al cliente — **no se cifran**. Son seguras porque el anon key está protegido por RLS en Supabase.

5. **Settings → Functions → Compatibility flags** → añade `nodejs_compat` para **Production** y **Preview**.
6. **Settings → Functions → Compatibility date** → `2025-06-01` (o más reciente).
7. **Save and Deploy**. Cada push a `main` redeploya; cada PR genera un preview en `<hash>.sistecpos-storefront.pages.dev`.

> Si el repo es monorepo y prefieres limitar el watch, en **Settings → Builds & deployments → Build watch paths** añade `astro-starter/*`.

### Repo separado (recomendado para el storefront)

Separar el storefront del repo del admin/POS evita builds innecesarios y simplifica permisos:

```bash
# 1. Copiar fuera del repo actual
cp -r astro-starter ~/sistecpos-storefront
cd ~/sistecpos-storefront

# 2. .gitignore mínimo
cat > .gitignore <<'EOF'
node_modules/
dist/
.astro/
.wrangler/
.env
.env.local
EOF

# 3. Inicializar y subir a GitHub
git init -b main
git add .
git commit -m "feat: storefront inicial Astro 5 + Cloudflare Pages"
git remote add origin git@github.com:<org>/sistecpos-tienda.git
git push -u origin main

# 4. Cloudflare → Pages → Connect to Git → seleccionar el repo
#    Usar los valores de la columna "repo separado" de la tabla de arriba.
```

### Opción B — Wrangler CLI (deploys manuales)

```bash
cd astro-starter
bun install
bun run build
bunx wrangler login                       # primera vez
bunx wrangler pages project create sistecpos-storefront --production-branch=main
bun run deploy                            # = wrangler pages deploy ./dist
```

Las variables de entorno también deben configurarse vía dashboard (no se leen automáticamente de `.env` en producción).

### Verificación post-deploy

```bash
curl https://sistecpos-storefront.pages.dev/api/health
# → { "status": "ok", "ts": "...", "runtime": "cloudflare-pages" }

curl -H "Host: surteya.sistecpos.com" https://sistecpos-storefront.pages.dev/api/tenant
# → { site_id, organization_id, slug, name, ... }
```


---

## Dominios custom (multi-tenant)

Cada tenant accede por su propio dominio. Hay dos modos según cómo esté provisionado en `tenant_domains.dns_mode`:

### 1. Modo `saas` (Cloudflare for SaaS — recomendado)

El cliente apunta su dominio con **CNAME → `<zone>.cloudflareondemand.com`** (valor exacto en `tenant_domains.cname_target`). Cloudflare emite SSL automáticamente vía ACME DCV y enruta el tráfico al storefront.

Pasos:
1. En el panel SistecPOS → **Sitios → Detalle → Asistente DNS** ejecuta los pasos del wizard (creación del Custom Hostname y publicación de los TXT/CNAME).
2. Cloudflare valida el dominio (1–15 min).
3. El storefront responde automáticamente; no se requiere configuración adicional en Pages.

> Para que esto funcione, el **Fallback Origin** de SaaS en Cloudflare debe apuntar al hostname del proyecto Pages (`sistecpos-storefront.pages.dev`).

### 2. Modo `pages` (dominio directo en Pages)

Para clientes sin SaaS:
1. **Pages → tu proyecto → Custom domains → Set up a custom domain**.
2. Cloudflare crea el CNAME automáticamente si el dominio ya está en la misma cuenta; si es externo, indica el CNAME a configurar.
3. SSL se aprovisiona en minutos.

Cualquiera de los dos modos: el resolver `resolveTenant(host)` reconoce el dominio por `tenant_domains.hostname` y carga el tenant correcto.

---

## Endpoints API disponibles

| Método | Ruta | Caché | Descripción |
|--------|------|-------|-------------|
| GET | `/api/health` | no-store | Healthcheck |
| GET | `/api/tenant` | s-maxage 300 | Tenant resuelto por Host |
| GET | `/api/categories` | s-maxage 300 | Categorías activas |
| GET | `/api/categories/:slug` | s-maxage 300 | Categoría + productos |
| GET | `/api/products?category=&search=&page=&pageSize=` | s-maxage 120 | Listado paginado |
| GET | `/api/products/:slug` | s-maxage 120 | Detalle producto |
| GET | `/api/order/:number` | no-store | Estado de pedido (polling) |
| POST | `/api/cart-sync` | — | Proxy a edge `cart-sync` (omnichannel) |
| POST | `/api/checkout` | — | Construye mensaje WhatsApp + URL `wa.me` |
| POST | `/api/lead` | — | Proxy a `lead-capture` |
| GET | `/api/landing/:slug?scope=` | s-maxage 300 | Proxy a `get-landing` |

Todos los endpoints:
- Devuelven JSON con shape `{ data: ... }` o `{ error: { code, message, details? } }`.
- Soportan CORS (`OPTIONS` preflight incluido).
- Validan input en el body (422 `VALIDATION_ERROR` ante datos faltantes).

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---------|----------------|-----|
| `Invalid binding 'SESSION'` en build | Astro 5 sugiere KV para sesiones | Es solo aviso. Si no usas `Astro.session`, ignorar. Para habilitar: crear KV y descomentar el bloque en `wrangler.toml`. |
| `Cannot find module 'node:xxx'` en runtime | Falta `nodejs_compat` | Activar el flag en **Pages → Settings → Functions** |
| HTTPS no responde tras DNS OK | Falta Fallback Origin de SaaS | En Cloudflare zona umbrella → SSL/TLS → Custom Hostnames → Fallback Origin → setear al hostname `*.pages.dev` |
| `TENANT_NOT_FOUND` en `/api/tenant` | El `Host` no está en `tenant_domains` | Insertar el hostname en Superadmin → Sitios → Dominios |
| Build falla con error de Sharp | Imágenes con servicio incorrecto | Ya está fijo: `imageService: "compile"` en `astro.config.mjs` |

---

## Referencias

- [Astro 5 docs](https://docs.astro.build/en/getting-started/)
- [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Pages — Functions](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare for SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)
