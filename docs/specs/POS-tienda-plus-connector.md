# POS-tienda-plus-connector

**Estado:** IN_REVIEW
**Módulo:** admin-cms + superadmin + integraciones

## Problema

Los clientes que ya tienen su tienda online en **Tienda Plus by SistecPOS**
necesitan operar en doble vía con SistecPOS Core: publicar catálogo/precios/stock,
recibir los pedidos web en el POS y cobrar por la pasarela de la tienda. Además,
el superadmin debe decidir **qué tienda queda expuesta** a la integración y si el
dueño puede autogestionarla.

## Arquitectura (hexagonal)

| Capa | Archivo |
|---|---|
| Puerto | `src/core/ports/ITiendaPlusRepository.ts` |
| Casos de uso (puros) | `src/core/use-cases/integrations/tiendaPlus.ts` |
| Adaptador | `src/infrastructure/database/SupabaseTiendaPlusRepository.ts` |
| Backend | `supabase/functions/tiendaplus-sync/index.ts` |
| Presentación (tenant) | `src/modules/admin-cms/pages/TiendaPlus.tsx` + `hooks/useTiendaPlus.ts` |
| Presentación (superadmin) | `src/modules/superadmin/components/TenantIntegrationsPanel.tsx` |

Rutas: `/admin/tienda-plus` (admin de la tienda) y
`/superadmin/t/:slug/integraciones` (control de exposición).

## Datos

- `tiendaplus_connections` (1 fila por `organization_id`): `base_url`, `api_key`
  (**sin GRANT** para `authenticated`), `api_key_prefix`, `scopes`, `enabled`,
  `exposed`, `allow_owner_manage`, `sync_catalog|orders|payments`,
  `catalog_cursor`, `orders_cursor`, `last_ping_at`, `last_sync_at`, `last_error`.
- `tiendaplus_sync_log`: bitácora `direction` (push/pull/payment), `entity`,
  `status`, conteos y `detail`.
- RLS: lectura para `can_write_org(organization_id)` o superadmin. Toda escritura
  pasa por la edge function con `service_role` (audita en la bitácora).
- La llave nunca vuelve al navegador: se muestra `tp_pos_xxxx…1234`.

## API remota consumida

| Acción | Endpoint | Scope |
|---|---|---|
| Validar/ping | `GET /api/public/pos/ping` | — |
| Enviar catálogo | `POST /api/public/pos/catalog` | `catalog` |
| Traer precios | `GET /api/public/pos/catalog?updatedSince=` | `catalog` |
| Importar pedidos | `GET /api/public/pos/sales?since=` | `sales` |
| Cobrar | `POST /api/public/pos/payments` | `payments` |
| Estado del cobro | `GET /api/public/pos/payments/{referencia}` | `payments` |

Hoy Tienda Plus solo publica `ping`, `payments` y `sync`. Los endpoints de
catálogo y ventas se llaman igual y, si responden 404/501, el conector devuelve
`unsupported: true`, registra la bitácora y avisa en la UI sin romper nada —
cuando allá se publiquen, la integración funciona sin cambios de código.

## Criterios de aceptación

- [x] La llave `tp_pos_...` se valida contra `ping` antes de guardarse.
- [x] Un admin de tienda solo puede configurar si `exposed && allow_owner_manage`.
- [x] Envío de catálogo incremental por `catalog_cursor`, en lotes de 100.
- [x] Importación de pedidos idempotente (`whatsapp_ref = 'TP:<id>'`).
- [x] Cobros idempotentes por referencia.
- [x] Bitácora consultable desde admin y superadmin.
- [ ] Prueba end-to-end contra la tienda real con llave productiva.
