# Plan de unificación de los 3 proyectos (sin romper lo vivo)

## Mapa final

```text
┌──────────────────────────────────────────────────────────────────────┐
│  surteya.lovable.app  →  admin.sistecpos.com  (ESTE proyecto)        │
│  Back-office multi-tenant. organization_id por cliente.              │
│  Aquí viven: POS, KDS, mesas, inventario, catálogo, CRM, billing,    │
│              módulos (retail, horeca, spa, belleza, agenda...)       │
│  Tenant semilla: SURTÉ YA (org_id existente).                        │
└──────────────────────────────────────────────────────────────────────┘
            │                                │
            │ API (resolve-tenant +          │ API (get-landing +
            │  wp-headless + cart-sync)      │  wp-headless)
            ▼                                ▼
┌─────────────────────────┐      ┌──────────────────────────────────┐
│ Astro multi-tenant       │      │ sistecpos.lovable.app (separado) │
│ Sirve N dominios:        │      │ Marketing + captación + tienda   │
│  - surteya.com (seed)    │      │ de licencias + representantes.   │
│  - dimanti.ventas.click  │      │ Sus 45+ landings y tienda se     │
│    (cliente spa)         │      │ migran a tablas y se sirven      │
│  - *.cliente.com         │      │ TAMBIÉN desde Astro como tenant  │
│                          │      │ "sistecpos" (id-negocio propio). │
└─────────────────────────┘      └──────────────────────────────────┘
```

Clave: **nada se borra**. Cada proyecto sigue vivo hasta que su reemplazo esté validado.

---

## Fase 1 — Activar módulos de Dimanti en SURTÉ YA (no toca Dimanti)

Objetivo: traer las capacidades de spa/belleza/agenda al multi-tenant, sin migrar el proyecto Dimanti todavía.

1. Crear catálogo de módulos en BD (`modules`): `retail`, `horeca`, `spa`, `belleza`, `agenda`, `comandas`, `kds`, `mesas`, `representantes`.
2. Tabla `organization_modules (organization_id, module_code, enabled, config jsonb)` para activarlos por tenant.
3. Migrar al admin de SURTÉ YA solo los componentes spa/belleza/agenda de Dimanti vía `cross_project--copy_project_asset` (lectura). Se importan como nuevas pestañas que solo aparecen si el módulo está activo para la org.
4. Crear tablas nuevas (no chocan con lo existente):
   - `service_catalog` (servicios spa: nombre, duración, precio, recurso requerido)
   - `service_resources` (cabinas, sillas, profesionales)
   - `appointments` (cita, cliente, recurso, servicio, estado, canal)
   - `appointment_slots` (vista materializada de disponibilidad)
5. RLS por `organization_id`; tenant `spa` ve solo agenda, tenant `retail` no la ve.
6. Activar `spa` + `agenda` en una org demo para validar (no en SURTÉ YA producción).

Resultado: SURTÉ YA gana el módulo spa/belleza/agenda sin tocar Dimanti.

---

## Fase 2 — Migrar contenido SEO de SistecPOS al CMS (sin tumbar SistecPOS)

Objetivo: preservar los 45+ URLs indexados de `sistecpos.lovable.app` moviéndolos a `landing_pages` + `landing_sections` (ya creadas en la fase anterior), con `site_scope = 'sistecpos'`.

1. Script de lectura `cross_project--read_project_file` por cada page de SistecPOS Lovable (Planes, Licencias, Comparativa, Módulos, Soluciones, Blog, etc.).
2. Convertir cada page React → fila en `landing_pages` (slug, meta_title, meta_description, canonical_url, json_ld, hero) + N filas en `landing_sections` (features, pricing, faq, testimonials...).
3. Importar productos de la tienda de SistecPOS a tablas existentes (`products` con `organization_id = sistecpos_org`).
4. Crear `tenant_site` "sistecpos" + `tenant_domain` `sistecpos.com` apuntando a Astro.
5. Astro ya sabe servir `/l/[slug]` desde `get-landing`. Habilitar también `/`, `/planes`, `/licencias`, `/blog/[slug]`, `/tienda/[slug]` para mantener URLs idénticas (cero ruptura SEO).
6. `301` desde `sistecpos.lovable.app/*` hacia `sistecpos.com/*` se activa solo cuando el equivalente Astro esté verificado.

Mientras tanto, **sistecpos.lovable.app sigue publicado y funcionando**.

---

## Fase 3 — Dimanti como tenant cliente de SURTÉ YA

Objetivo: el cliente real de Dimanti pasa a vivir como tenant del multi-tenant; su sitio público lo sirve Astro.

1. Crear `organization` "Dimanti" en SURTÉ YA + `tenant_site` + `tenant_domain` `dimanti.ventas.click`.
2. Activar módulos `spa`, `belleza`, `agenda`, `tienda` para esa org.
3. Importar (no mover) productos, categorías, landings desde Dimanti Lovable a la org de Dimanti.
4. Astro sirve `dimanti.ventas.click` consumiendo `get-landing` con `scope = "dimanti"`.
5. Dimanti Lovable queda en modo "solo lectura" hasta confirmar paridad; después se archiva (no se borra).

---

## Fase 4 — SURTÉ YA como tenant semilla del Astro

Objetivo: que `surteya.com` lo sirva Astro multi-tenant (igual que cualquier otro cliente), y este proyecto pase a ser `admin.sistecpos.com`.

1. Asegurar que Astro renderiza `/`, `/catalogo`, `/producto/:slug`, `/categoria/:slug`, `/carrito`, `/pedido/:n` leyendo de las mismas tablas (mismo Supabase).
2. Verificar paridad visual y de checkout WhatsApp.
3. Cambiar DNS de `surteya.com` a Astro. Este proyecto pasa a responder en `admin.sistecpos.com`.
4. Rollback: si algo falla, devolver DNS al hosting actual de Lovable (5 min).

---

## Fase 5 — SistecPOS Lovable como motor de licenciamiento puro

Objetivo: dejar `sistecpos.lovable.app` solo con lo que sí necesita ejecución React (checkout de licencias, panel de representantes, demos), y delegar todo el contenido SEO a Astro.

1. En SistecPOS Lovable se mantienen: `Checkout`, `AgendarDemo`, `PortalRepresentantes`, `CrmInterno`.
2. Las demás pages quedan como **redirect 301** a `sistecpos.com/...` (Astro).
3. Edge function `license-purchase-webhook` (ya planeada) crea automáticamente la `organization` + invitación al owner en este admin.

---

## Detalle técnico (resumen)

- **DB nueva**: `modules`, `organization_modules`, `service_catalog`, `service_resources`, `appointments`, `appointment_slots`. Todo con RLS por `organization_id` usando `has_org_membership(uid, org_id)`.
- **Edge functions nuevas**: ninguna obligatoria en Fase 1-2; reutilizamos `get-landing`, `resolve-tenant`, `lead-capture`, `wp-revalidate-webhook`. En Fase 5 se añade `license-purchase-webhook`.
- **Importadores** (uno por proyecto fuente): scripts Node locales que usan `cross_project--read_project_file` y vuelcan a Supabase vía service-role; idempotentes (upsert por slug).
- **Sin destruir**: cada proyecto fuente queda intacto hasta que su equivalente esté verificado en producción.

---

## Orden de ejecución sugerido y puntos de control

1. Fase 1 (módulos spa en SURTÉ YA) → demo interna ✅
2. Fase 2 (importar landings SistecPOS al CMS, servir en Astro bajo subdominio de prueba) → revisar SEO ✅
3. Fase 3 (Dimanti como tenant) → cliente valida ✅
4. Fase 4 (cambio DNS surteya.com) → ventana de mantenimiento corta ✅
5. Fase 5 (limpiar SistecPOS Lovable + redirects) ✅

Cada fase es independiente y reversible.

---

## Lo que necesito que confirmes antes de empezar Fase 1

1. ¿Arrancamos por **Fase 1** (módulos spa/belleza/agenda activables por tenant en este proyecto) o prefieres ir primero por **Fase 2** (importar contenido SEO de SistecPOS al CMS)?
2. ¿El cliente real de Dimanti ya sabe que su sitio pasará a `dimanti.ventas.click` servido por Astro, o lo manejamos como migración silenciosa con paridad 1:1?
3. Para la importación de pages desde los otros 2 proyectos Lovable, ¿autorizas que yo lea sus archivos con las herramientas de cross-project y los vuelque a las tablas, o prefieres exportar tú manualmente?
