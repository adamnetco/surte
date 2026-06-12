---
name: Demo Tenant Seed
description: Baseline operativa sembrada para la organización Demo SistecPOS (vitrina pública en `/t/demo/*`)
type: feature
---

## Demo org

- `id`: `59a4032f-3eeb-4312-a84a-f6d042f019ec`
- `slug`: `demo`
- `name`: `Demo SistecPOS`
- `tenant_sites.slug='demo'` (`id=2f3c3bbc-40bc-459e-be3c-423359b0ac6f`, `is_published=true`)

## Seed aplicado (idempotente)

- **organization_modules**: 11 módulos activos (`retail`, `pos`, `kds`, `mesas`, `inventario`, `crm`, `licencias`, …)
- **locations**: `Sede Demo Centro` (1 sede)
- **cash_registers**: `Caja 1`
- **kitchen_stations**: `Cocina principal`
- **dining_areas**: `Salón principal` + 4 mesas
- **categories**: 3 (`demo-*`)
- **products**: 10 ítems (`DEMO-001..DEMO-010`)
- **tenant_domains**: `demo.sistecpos.com` (primary, SSL `pending_validation` — bloqueado por DNS del cliente, ver `demo-dns-pending`) y `demo.ventas.click`.

## Frontend
- `LoginRouter.tsx` usa `placeholder="ej: demo"` para que el portal sugiera este tenant.
- Rutas storefront: `/t/demo/*` funcionan sin SSL custom (van por dominio Lovable).

## Convenciones
- `module_key` correcto del POS nativo es **`pos`** (no `pos_counter`).
- Mesas usan columna `label` (no `name`).
- Slugs demo prefijados con `demo-` para evitar choques con otros tenants.

## Pendiente (Fase 2.5) — usuario demo

Hoy `organization_members` para esta org tiene **0 filas**. Para habilitar login real:
- Invocar edge fn `reseed-demo` (solo superadmin) que:
  1. Crea/recupera `demo@sistecpos.com` en `auth.users`.
  2. Upsert `organization_members` con `role='admin'`.
  3. Upsert `user_roles` con `role='admin'` global.
- Alternativa SQL manual si el usuario auth ya existe:
```sql
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('59a4032f-3eeb-4312-a84a-f6d042f019ec', '<auth.uid>', 'admin')
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin';

INSERT INTO public.user_roles (user_id, role)
VALUES ('<auth.uid>', 'admin')
ON CONFLICT DO NOTHING;
```
