## Diagnóstico

**Proyecto Dimanti** (`Web Dimanti alisados`, hoy en dimanti.ventas.click) ya tiene casi todo el front-end que necesita SistecPOS SaaS vive en el dominio [sistecpos.lovable.app](http://sistecpos.lovable.app) con dominio propio sistecpos.com: `PlanesPage`, `LicenciasPage`, `ComparativaLicenciasPage`, `PacksPage`, `ModulosPage`, `ModuloDetallePage`, `SolucionesPage`, `SolucionNegocioPage`, `SedeLandingPage` (landings por ciudad), `AgendarPage` (demo/cita comercial), `ContactoPage`, `CasosExitoPage` + `CasoExitoDetallePage`, `GuiasDianHubPage`, `CalculadoraUVTPage`, `ValidadorNITPage`, `ComparacionCompetidorPage`, `FacturacionElectronicaPage`, `SoftwarePosColombiaPage`, `SoftwarePosLocalPage`, `RegistroClientePage`, `ActivarDemoPage`, `CheckoutPage`, `PagoResultadoPage`, `GraciasPage` + `AyudaPage`/`AyudaArticlePage` + `LegalPage`/`Terminos`/`Politica`.

Además tiene: `AdminPage`, `ClientesPage`, `VentasListPage`, `VentaDetallePage`, `ProductosPage`, `ProductoDetallePage`, `ProductoTiendaPage`, `TiendaPage`, `PedidoTrackingPage`. Estos se quedan y de [Dimanti.ventas.click](http://Dimanti.ventas.click) se migra copia al multitennat de surte ya.  Para aportar las capacidades para negocios de spa que fueron atendidas con dimanti. Las paginas y gestion de paginas las migramos para que sean paginas en Astro 5. Asi que se podrian exportar los componentes completos para ser paginas en Astro y como wp headles como cerebro 

**Este proyecto** (SURTÉ YA) ya tiene: multi-tenant (`organizations`, `organization_members`, `organization_modules`, `tenant_sites`, `tenant_domains`, `tenant_wp_config`), licencias completas (`licenses`, `license_activations`, `register_activation`, `heartbeat_activation`), billing (`plan_modules`, `usage_events`, `dunning_events`), POS offline-first, KDS, mesas, facturación electrónica Innapsis, catálogo, pedidos, push, WhatsApp YCloud, edge functions de tenants (`resolve-tenant`, `verify-tenant-domain`, `sync-products-to-wp`, `wp-revalidate-webhook`), plugin WP.

## Arquitectura objetivo

```text
┌────────────────────────────────────────────────────────────────┐
│ sistecpos.com  (sigue como está. Tiene muchas páginas indexadas en google y va ser el captador de clientes. Va ser el que activa las licencias)                            │
│ ─ Landings SEO (45+ páginas, sedes, casos, guías DIAN, etc.)   │
│ ─ Planes / Comparativa / Packs / Módulos / Soluciones          │
│ ─ Checkout DE LICENCIAS que de crean en el multi tennat (surteya.com) (Paddle/Stripe → crea organization +   │
│   license + invita owner por email)                          y 1 │
│ ─ Agendar demo  / Registro cliente / CRM leads                 │
│ ─ Calculadora UVT, Validador NIT, Comparación competidores     │
│ ─ Ayuda / Legal / Tracking público de pedido (lee API admin)   │
│                                                                │
│ Lee/escribe → MISMA BD Supabase de admin.sistecpos.com         │
│                vía edge functions públicas (CORS).             │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼  comparte Supabase
┌────────────────────────────────────────────────────────────────┐
│ admin.sistecpos.com  (este proyecto, hoy "SURTÉ YA")           │
│ ─ Back-office multi-tenant para TODOS los negocios             │
│ ─ Inventario, POS, KDS, Mesas, Pedidos, Compras, Facturación,  │
│   Catálogos base, Clientes, Reportes, Licencias, Sitios,       │
│   Dominios, Billing, Webhooks WP, Sync productos, Push, etc.   │
│ ─ Surteya pasa a ser organization_id semilla.                  │
│ ─ Selector de organización arriba (ya existe OrganizationCtx). │
│ ─ Cada vertical (HORECA, SPA, mini-mercado) = combinación de   │
│   organization_modules activos.                                │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼ resolve-tenant
┌────────────────────────────────────────────────────────────────┐
│ Astro multi-tenant en Vercel                                   │
│ ─ Sirve N dominios de clientes (surteya.com, cliente2.com…)    │
│ ─ Cada host → tenant → tema + datos + WordPress propio         │
│ ─ Productos y stock leídos del admin; contenido editorial de   │
│   WP headless del cliente.                                     │
└────────────────────────────────────────────────────────────────┘
```

## Plan por fases

### FASE A — Mapear y limpiar Dimanti (sin tocar BD)

1. Copiar de Dimanti → este proyecto (o un repo nuevo `sistecpos-marketing`):
  - **Mantener**: `Index`, `PlanesPage`, `LicenciasPage`, `ComparativaLicenciasPage`, `PacksPage`, `ModulosPage`, `ModuloDetallePage`, `SolucionesPage`, `SolucionNegocioPage`, `SedeLandingPage`, `AgendarPage`, `ContactoPage`, `CasosExitoPage`, `CasoExitoDetallePage`, `GuiasDianHubPage`, `GuiaDianPage`, `CalculadoraUVTPage`, `ValidadorNITPage`, `ComparacionCompetidorPage`, `FacturacionElectronicaPage`, `SoftwarePosColombiaPage`, `SoftwarePosLocalPage`, `RegistroClientePage`, `ActivarDemoPage`, `LandingDemoPage`, `CheckoutPage` (de licencias), `PagoResultadoPage`, `GraciasPage`, `AyudaPage`, `AyudaArticlePage`, `LegalPage`, `Politica`, `Terminos`, `NotFound`, `Compararpage`.
  - **Eliminar de Dimanti** (duplican admin): `AdminPage`, `ClientesPage`, `VentasListPage`, `VentaDetallePage`, `ProductosPage`, `ProductoDetallePage`, `ProductoTiendaPage`, `TiendaPage`, `PedidoTrackingPage` (este último pasa a redirigir a `admin.sistecpos.com/pedido/:id` o se reimplementa leyendo API pública).
2. Renombrar proyecto Dimanti → **"SistecPOS Marketing"** en Lovable.
3. Apuntar dominio `sistecpos.com` al proyecto SistecPOS Marketing. Mover `dimanti.ventas.click` a un tenant si el cliente original lo quiere.

### FASE B — Migrar landings SEO a CMS DB

- Crear/usar tablas `landing_pages` + `landing_sections` + `seo_content` (ya parcialmente existen en este admin).
- Script de ingestión: leer cada `Page.tsx` de Dimanti, parsear bloques (`Hero`, `Features`, `Pricing`, `FAQ`, `CTA`) y guardarlos como filas con slug + meta + JSON-LD.
- En SistecPOS Marketing, reemplazar las 45+ páginas estáticas por **un solo template** `<DynamicLanding slug={...} />` que consume la edge function `get-landing` (paginate, cache CDN 5 min).
- Beneficio: editar landings desde admin.sistecpos.com → propaga a sistecpos.com en minutos.

### FASE C — Conectar el checkout de licencias

1. En SistecPOS Marketing, el `CheckoutPage` deja de ser de productos y se vuelve **checkout de planes/módulos**:
  - Selección de plan (`plan_modules` define qué módulos trae) + módulos extra opcionales.
  - Provider: empezar con Paddle (MOR, IVA Colombia y global resuelto) o Wompi/MercadoPago si se quiere local.
2. Webhook `license-purchase-webhook` (nueva edge fn):
  - Crea `organization` (slug = NIT o dominio elegido).
  - Crea `owner` invitándolo por email con magic-link → cae en admin.sistecpos.com.
  - Inserta `licenses` con `plan`, `max_terminals`, `expires_at`.
  - Activa `organization_modules` según `plan_modules`.
  - Notifica al equipo comercial por WhatsApp/email.
3. `AgendarPage` → guarda lead en `crm_leads` (tabla nueva) + dispara notificación.

### FASE D — Surteya como tenant semilla

1. Asegurar `organization` `slug=surteya` (ya está como default via `default_org_id()`).
2. Crear `tenant_site` + `tenant_domain` `surteya.com` + `www.surteya.com` apuntando a esa org.
3. Configurar WP headless para surteya (si lo va a tener) o usar solo catálogo de admin como fuente.
4. Migrar el front público actual de este preview (Index, Catálogo, Producto, Carrito, Checkout WhatsApp) → al **Astro starter** ya creado, leyendo del mismo Supabase vía API pública.
5. Dejar este proyecto **únicamente como admin** (mover `/`, `/catalogo`, `/producto/*`, `/carrito` a un módulo "Vista cliente" interno de pruebas o eliminarlos). Login + `/admin` + módulos pasan a ser la home.
6. Apuntar `admin.sistecpos.com` a este proyecto.

### FASE E — Nicho SPA / Agenda (lo que aporta Dimanti vertical)

- Activar módulo `agenda` (ya propuesto antes) solo para orgs tipo `spa`.
- Reusar `AgendarPage` de Dimanti como **booking público embebible** en cada tenant Astro.

### FASE F — Onboarding cliente nuevo (flujo end-to-end)

```text
Cliente entra a sistecpos.com → ve plan → Checkout
  → paga (Paddle)
  → webhook crea org + licencia + invita owner
  → owner entra a admin.sistecpos.com, completa setup
  → opcional: en /sitios añade su dominio + WP
  → DNS CNAME → Astro Vercel
  → su negocio queda vivo en su-dominio.com
  → POS desktop activa licencia con license_key
```

## Cambios en BD (mínimos)

- `crm_leads` (nombre, email, teléfono, origen, plan_interes, notas, status, owner_id).
- `landing_pages` / `landing_sections` (ya existen parcialmente; revisar y extender).
- `org_signup_requests` (para auditar checkouts antes de aprobar pago).
- Nada destructivo.

## Edge functions nuevas

- `get-landing` (público, CORS, cache CDN).
- `license-purchase-webhook` (Paddle/Stripe).
- `lead-capture` (CRM público desde Dimanti).
- `org-invite-owner` (envía magic-link al comprador).

## Cosas que NO se hacen en este plan

- No tocar POS, KDS, mesas, facturación electrónica, push, WhatsApp, licencias, billing existentes.
- No migrar dimanti.ventas.click a tenant a menos que el cliente original lo apruebe.
- No habilitar pagos todavía: en una iteración futura decidimos Paddle vs Stripe vs Wompi (Colombia).

## Entregables al aprobar

- Confirmación de cuáles páginas de Dimanti copiamos y cuáles eliminamos.
- Migración SQL para `crm_leads` + extensiones de `landing_pages`.
- Edge functions `get-landing` y `lead-capture` (las de billing van en una fase posterior).
- Plan de DNS: `sistecpos.com` → SistecPOS Marketing, `admin.sistecpos.com` → este proyecto, `surteya.com` → Astro Vercel.

## Preguntas abiertas (responder al aprobar plan)

1. ¿Trabajamos sobre el proyecto Dimanti existente renombrándolo, o creamos `sistecpos-marketing` nuevo y vamos copiando páginas de Dimanti con `cross_project--copy_project_asset`?
2. ¿`dimanti.ventas.click` se queda como tenant del cliente original o lo descontinuamos?
3. ¿Pagos: Paddle (MOR global), Stripe (más control), o Wompi/MercadoPago (local Colombia, mejor para tarjetas locales y PSE)?