# Tenant-first hardening — SistecPOS Core

Estado del endurecimiento multi-tenant de la base de datos y el runtime.
Última actualización: 2026-09-01.

## 1. Reglas no negociables

1. Todo dato operativo pertenece a una `organization_id`.
2. Toda política RLS de datos operativos filtra por **membresía de organización**
   (`is_member_of(organization_id)`), nunca por rol global `admin`.
3. Solo el superadmin maestro (`is_master_superadmin(auth.uid())`) hace bypass global,
   y siempre como política separada y explícita.
4. Todo índice de tabla caliente empieza por `organization_id`.
5. Toda query crítica filtra primero por `organization_id` y selecciona columnas explícitas.
6. El runtime Desktop es genérico: cero marcas, dominios o datos de un tenant en `core`.

## 2. Clasificación de tablas

| Clase | Ejemplos | Regla de acceso |
|---|---|---|
| Tenant-scoped | `products`, `categories`, `pos_orders`, `pos_order_items`, `pos_payments`, `cash_sessions`, `cash_movements`, `product_stock`, `stock_movements`, `warehouses`, `suppliers`, `purchase_orders`, `electronic_invoices`, `persistent_carts`, `app_settings` | `is_member_of(organization_id)` + rol de organización para escritura |
| Global de plataforma | `saas_plans`, `modules`, `addons`, `desktop_releases`, `feature_flags` | lectura pública/autenticada; escritura solo superadmin maestro |
| Relación usuario-organización | `organization_members`, `user_roles`, `profiles` | dueño del registro + admins de la **misma** organización |
| Logs / auditoría | `tenant_audit_log`, `sync_logs`, `license_audit`, `api_request_logs` | append-only; lectura por organización o superadmin |

## 3. Cambios aplicados

### FASE 2 — RLS
- `profiles`: se eliminó la política global
  `Admins and superadmins can manage all profiles` (permitía a un admin de la
  organización A leer y modificar teléfonos, direcciones y razón social de clientes
  de la organización B). Reemplazada por:
  - `Org admins manage profiles of their organization`
    → `organization_id IS NOT NULL AND is_member_of(organization_id) AND has_any_role(auth.uid(), ARRAY['admin','superadmin'])`
  - `Master superadmins manage all profiles` → `is_master_superadmin(auth.uid())`
- Correcciones previas equivalentes ya aplicadas en `crm_leads`, `orders`, `order_items`,
  `customer_reviews`.

### FASE 3 — Índices compuestos
Añadidos con `CREATE INDEX IF NOT EXISTS` (no duplican índices existentes):

```
products (organization_id, is_active, category_id)
products (organization_id, sku)
categories (organization_id, is_active, sort_order)
pos_orders (organization_id, status, created_at DESC)
pos_orders (organization_id, location_id, created_at DESC)
pos_order_items (organization_id, pos_order_id)
pos_payments (organization_id, pos_order_id)
cash_sessions (organization_id, location_id, status)
stock_movements (organization_id, product_id, created_at DESC)
product_stock (organization_id, warehouse_id, product_id)
electronic_invoices (organization_id, status, created_at DESC)
persistent_carts (organization_id, cart_token)
license_activations (license_id, revoked_at)
```

Ya existían y se reutilizan: `idx_pos_orders_org_date`, `idx_products_org_active`,
`idx_categories_org`, `idx_cash_sessions_org`, `idx_einvoice_org_status`.

### FASE 7 — Offline aislado
`src/modules/offline/lib/db.ts` abre una IndexedDB por tienda
(`sistecpos_offline_<organization_id>`); `setOfflineOrganization()` se dispara desde
`OrganizationContext`, por lo que catálogo, tickets y outbox nunca se mezclan.

### FASE 5 — Desktop genérico
`license-activate` → token firmado + `organization_id` + `tenant_manifest`.
`desktop-tenant-bootstrap` sirve el manifiesto refrescado; `license-heartbeat`
lo revalida cada 30 min y dispara `wipe` si la licencia fue revocada.
Detalle en [`docs/desktop/multitenant-runtime.md`](../desktop/multitenant-runtime.md).

## 4. Verificación

```bash
# Auditoría de scoping y select("*") en el código
node scripts/audit-tenant-scope.mjs

# Presupuesto de bundle / rendimiento
node scripts/perf-budget.mjs

# Tipos y build
npx tsgo --noEmit && npm run build
```

SQL de verificación (Cloud → Run SQL):

```sql
-- Tablas operativas sin organization_id
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and not exists (
    select 1 from information_schema.columns col
    where col.table_schema = 'public' and col.table_name = c.relname
      and col.column_name = 'organization_id')
order by 1;

-- Políticas que dan acceso por rol global sin filtrar organización
select tablename, policyname, qual
from pg_policies
where schemaname = 'public'
  and qual like '%has_any_role%'
  and qual not like '%organization_id%';

-- Plan de una consulta caliente
explain analyze
select id, name, price from products
where organization_id = '00000000-0000-0000-0000-000000000000' and is_active
order by name limit 50;
```

## 5. Backup / restore (checklist)

1. Backups automáticos diarios activos en Cloud (retención según plan).
2. Antes de cada migración destructiva: exportar las tablas afectadas a CSV
   (Cloud → Advanced settings → Export data).
3. Probar el restore en un proyecto de prueba al menos una vez por trimestre.
4. Registrar en este documento la fecha del último restore verificado.
   - Último restore verificado: _pendiente_.

## 6. Riesgos abiertos

| Riesgo | Impacto | Siguiente paso |
|---|---|---|
| `profiles` sigue con políticas `agente` globales (`Agents can read/update all profiles`) | Un usuario con rol `agente` ve perfiles de todas las tiendas | Acotar a `is_member_of(organization_id)` cuando se defina si `agente` es global o por tienda |
| ~165 funciones `SECURITY DEFINER` ejecutables por `anon` | Superficie de API amplia | Revocar `EXECUTE` a `anon` en las que no sean públicas por diseño |
| `client_downloads` / `desktop_releases` sin scope de tienda | Un cliente ve instaladores de otros | Añadir `organization_id` nullable + RLS y filtrar `ClientDownloadsTab` |
| Reportes históricos calculados en vivo | Latencia en tenants grandes | Materializar resúmenes diarios por tienda |
| Flujo de venta POS con inserts múltiples desde el cliente | Riesgo de venta parcial | RPC transaccional idempotente con `client_operation_id` |
