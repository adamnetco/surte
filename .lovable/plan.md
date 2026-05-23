# SurteYa OS — Plataforma POS Multi-Tenant Modular

Convertir SurteYa de un eCommerce single-tenant en una **plataforma SaaS** estilo Tiendana / Vendty / Toteat / Fudo, donde cada negocio (tenant) activa solo los módulos que necesita: restaurante con mesas, tienda con caja, eCommerce, multi-sucursal, facturación electrónica DIAN (Innapsis), etc.

## 1. Modelo conceptual

```text
Organization (tenant)              ← "Mi Restaurante S.A.S"
   │
   ├── Subscription + Modules      ← qué tiene activado (pos, kds, tables, ecommerce, einvoice)
   │
   ├── Locations (sucursales)      ← "Sede Cabecera", "Sede Cañaveral"
   │     │
   │     ├── Cash Registers        ← cajas físicas con apertura/cierre
   │     ├── Areas + Tables        ← "Salón", "Terraza", mesas 1..20
   │     ├── Stock por bodega      ← inventario independiente por sede
   │     └── Printers / KDS        ← impresoras y pantallas asignadas
   │
   ├── Members (usuarios)          ← link user_id ↔ org con rol por org
   │     └── Roles: owner, admin, manager, cashier, waiter, kitchen, agent
   │
   └── Customers + Products + Orders (todo scoped por organization_id)
```

Cada tabla del negocio (`products`, `orders`, `customers`, `categories`...) recibe `organization_id` + `location_id`. RLS filtra automáticamente por la organización a la que pertenece el usuario logueado.

## 2. Sistema modular (capa de habilitación granular)

Tabla `organization_modules` define qué tiene activo cada tenant:


| module_key          | Habilita                                                   |
| ------------------- | ---------------------------------------------------------- |
| `ecommerce`         | Storefront público, carrito web, WhatsApp Flow (lo actual) |
| `pos_counter`       | Caja mostrador, ticket, apertura/cierre, arqueo            |
| `pos_tables`        | Plano de mesas, comandas, dividir cuenta, propinas         |
| `kds`               | Pantalla de cocina realtime                                |
| `multi_location`    | Más de 1 sucursal, transferencias de inventario            |
| `multi_warehouse`   | Stock por bodega independiente                             |
| `einvoice_innapsis` | Facturación electrónica DIAN                               |
| `loyalty`           | Puntos, niveles, cupones avanzados                         |
| `delivery_own`      | Asignación de repartidores propios                         |
| `qr_menu`           | Menú QR con autoservicio por mesa                          |
| `b2b_wholesale`     | Precios mayorista/distribuidor (lo actual)                 |


El frontend lee `useModules()` y renderiza solo las tabs/rutas habilitadas. El backend valida en RLS y edge functions.

## 3. Roadmap por fases

### Fase 0 — Refactor multi-tenant (cimiento, NO opcional)

1. Crear `organizations`, `organization_members`, `organization_modules`, `subscriptions`.
2. Agregar `organization_id NOT NULL` a todas las tablas de negocio existentes.
3. Migrar datos actuales a una organización "SurteYa Bucaramanga" semilla.
4. Reescribir RLS con función `current_org_id()` SECURITY DEFINER + `is_member_of(org_id)`.
5. Selector de organización + persistencia en localStorage + JWT claim.

**Riesgo:** rompe todo lo existente si no se hace con cuidado. Requiere QA exhaustivo.

### Fase 1 — Locations + Cajas + Tickets (POS mostrador básico)

- `locations`, `cash_registers`, `cash_sessions` (apertura/cierre con conteo).
- `payments` (múltiples por orden: efectivo + tarjeta + transferencia, con split).
- `/pos` ruta dedicada: catálogo a la izquierda, ticket a la derecha (estilo Gamasoft/Vectorpos).
- Impresión 58/80mm vía `window.print` con CSS térmico + soporte ESC/POS via WebUSB.
- Reportes X y Z por sesión de caja.

### Fase 2 — Mesas + KDS (restaurante)

- `dining_areas`, `tables`, `table_orders` (orden persistente por mesa).
- Plano visual drag-drop con estados (libre/ocupada/cobrar/sucia).
- Dividir cuenta por persona o por ítem, transferir mesa, fusionar cuentas.
- **KDS:** `/kds` realtime via Supabase channel, ticket por estación (cocina caliente / fría / barra), tiempo de preparación, sonido al entrar comanda.
- Tipos de servicio: mesa / llevar / domicilio / mostrador / autoservicio.

### Fase 3 — Multi-location + Inventario por bodega

- `warehouses`, `stock_movements`, `transfers` entre sedes.
- `products` mantiene precio base; `location_overrides` permite precio/stock por sede.
- Reportes consolidados vs por sede.

### Fase 4 — Facturación electrónica Innapsis

- Tabla `electronic_invoices` con estados (pending, sent, accepted, rejected, void).
- Edge function `innapsis-emit` (firma + envío) y `innapsis-webhook` (estado DIAN).
- Resoluciones de numeración, contingencia, notas crédito/débito.
- Mapeo de productos con código DIAN, IVA, INC, ICUI.
- Secret: `INNAPSIS_API_KEY` + `INNAPSIS_NIT` + `INNAPSIS_RESOLUTION`.

### Fase 5 — Onboarding SaaS + Billing

- Wizard de creación de organización: tipo de negocio → preset de módulos.
- Stripe/MercadoPago suscripción por módulos activados.
- Trial 14 días, downgrade/upgrade, factura SaaS al propio tenant.

### Fase 6 — Modo offline (PWA POS real)

- Service worker con queue IndexedDB de ventas offline.
- Sync al recuperar conexión, conflict resolution por timestamp.
- Imprescindible para tiendas con internet inestable (caso TiendaTek/Kyte).

## 4. Detalles técnicos

### Nuevas tablas core (Fase 0)

```text
organizations (id, slug, name, business_type, country, currency, timezone, created_at)
organization_modules (org_id, module_key, enabled, config jsonb, expires_at)
organization_members (org_id, user_id, role, location_ids[], is_active)
locations (id, org_id, name, address, phone, settings jsonb)
subscriptions (org_id, plan, status, current_period_end, stripe_id)
```

### Funciones SECURITY DEFINER nuevas

- `current_org_id()` — lee de JWT claim o tabla default
- `is_member_of(org_id)` — valida pertenencia
- `has_module(org_id, module_key)` — gate de feature
- `org_role(org_id)` — rol dentro de la org actual

### Patrón RLS estándar

```sql
CREATE POLICY "tenant_isolation" ON products
  USING (organization_id = current_org_id() AND is_member_of(organization_id));
```

### Frontend

- `OrganizationContext` provee `currentOrg`, `modules`, `switchOrg()`.
- Hook `useModule('pos_tables')` → boolean.
- Router envuelve rutas en `<RequireModule module="kds">`.
- Sidebar admin se reconstruye dinámicamente según módulos.

### Inspiración aplicada (qué tomamos de cada referencia)

- **Tiendana / Vendty:** estructura multi-tenant + facturación electrónica + billing SaaS.
- **Vectorpos / Gamasoft:** plano de mesas, dividir cuenta, atajos de teclado para caja rápida.
- **Toteat / Fudo:** KDS, tipos de servicio, gestión de meseros y turnos.
- **GoMenu / restaurante.pe:** flujo cocina (KDS) + descuentos por línea.
- **Plick / ola.click:** menú público con bottom-sheet de entrega, sticker UX de carrito persistente (ya implementado).
- **Kyte / Yimi:** POS móvil ultra-simple, modo offline.
- **TiendaTek:** multi-bodega, transferencias, foco minimercado Colombia.
- **Innapsis:** proveedor único de facturación electrónica DIAN.

## 5. Riesgos y advertencias

1. **Fase 0 es destructiva.** Toca todas las tablas. Sin tests + staging real → pérdida de datos.
2. **Innapsis requiere contrato comercial + certificado digital DIAN** del cliente final, no solo API key. Hay que documentar el onboarding.
3. **Convertirse en SaaS implica soporte multi-cliente:** logs por tenant, billing, contratos, SLA, GDPR/Habeas Data. Hay implicación legal.
4. **Tiempo realista:** Fase 0-2 = 6-10 semanas de trabajo enfocado. Fase 0-6 completa = 4-6 meses.
5. **Recomendación:** ejecutar Fase 0 + Fase 1 primero, validar con SurteYa como tenant inicial, luego abrir a un segundo cliente piloto antes de seguir.

## 6. Próximo paso sugerido

Si apruebas este plan, propongo arrancar por:

**Sprint 0 (1 semana):** crear `organizations` + `organization_members` + `organization_modules` + migración suave (todo apunta a una org "default-surteya"), sin tocar UI todavía. Esto deja el cimiento listo sin romper nada visible.

Luego decides si seguimos con caja (Fase 1) o mesas (Fase 2) primero.