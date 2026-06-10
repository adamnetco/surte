---
name: Demo Tenant Seed
description: Baseline operativa sembrada para la organización Demo SistecPOS para que POS, KDS, mesas e inventario funcionen sin configuración manual
type: feature
---

## Demo org

- `id`: `59a4032f-3eeb-4312-a84a-f6d042f019ec`
- `slug`: `demo`
- `name`: `Demo SistecPOS`

## Seed aplicado (idempotente)

- **organization_modules**: `retail`, `pos`, `kds`, `mesas`, `inventario`, `crm`, `licencias`
- **locations**: `Sede Demo Centro` (code `DEMO-01`, Bucaramanga, `is_main=true`)
- **cash_registers**: `Caja 1` (code `CAJA-01`)
- **kitchen_stations**: `Cocina principal`
- **dining_areas**: `Salón principal` + 4 mesas (`Mesa 1..4`, capacidad 4)
- **categories**: Bebidas, Snacks, Panadería (slugs `demo-*`)
- **products**: 10 ítems con SKU `DEMO-001..DEMO-010`, `price`, `cost_price`, `stock`

## Convención

- El `module_key` correcto para el POS nativo es **`pos`** (no `pos_counter`). Cualquier `hasModule("pos_counter")` en código es un bug.
- Las mesas usan columna `label` (no `name`).
- Los slugs de categorías/productos demo van prefijados con `demo-` para evitar choques con otros tenants.

## Pendiente (Fase 2.5)

Cuando exista un usuario auth para el demo (`demo@sistecpos.com` u otro):
```sql
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('59a4032f-1f2f-47c1-81c7-...', '<auth.uid>', 'admin')
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin';

INSERT INTO public.user_roles (user_id, role)
VALUES ('<auth.uid>', 'admin')
ON CONFLICT DO NOTHING;
```
