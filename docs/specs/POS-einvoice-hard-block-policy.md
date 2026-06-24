# POS — Hard-Block de Cobro cuando DIAN está offline sin contingencia

**Estado:** DRAFT
**Módulo:** `pos` + `admin-cms` (config) + `einvoice_configs`
**Wave:** Follow-up de [POS-innapsis-emision-pos](./POS-innapsis-emision-pos.md) (Observación #1 del review)
**Tablas:** `einvoice_configs` (nueva columna `hard_block_when_dian_down`), `einvoice_contingency_ranges`

## Problema

Hoy, cuando DIAN/Innapsis está offline y el tenant **no tiene rango de contingencia configurado**, el POS solo muestra un banner amarillo (`ResolutionStatusBanner` / `ContingencyBanner`) pero **permite cobrar igual**. Esto genera ventas que después no se podrán normalizar a DIAN dentro de las 48h y obliga al tenant a anular o emitir manualmente.

Algunos sectores (HORECA alto volumen, mayoristas) prefieren **bloquear el cobro** hasta que se restablezca DIAN o se cargue un rango de contingencia válido. Otros (minimercados de barrio) prefieren seguir cobrando en modo "recibo interno" y normalizar luego.

La política debe ser **configurable por organización**.

## Outcomes

- [ ] **AC1:** Nueva columna `einvoice_configs.hard_block_when_dian_down BOOLEAN DEFAULT false`.
- [ ] **AC2:** Toggle en `POSBehaviorSettings` (admin/facturacion/configuracion): "Bloquear cobro si DIAN está offline y no hay rango de contingencia activo" con explicación clara del trade-off.
- [ ] **AC3:** En `PaymentDialog` / `SaleCompleteDialog`, si `hard_block_when_dian_down = true` Y `dian_health = down` Y `no hay contingency_range vigente` → botón "Cobrar" deshabilitado con tooltip "DIAN offline. Configure rango de contingencia o espere a restablecimiento".
- [ ] **AC4:** El bloqueo NO aplica a ventas marcadas como "Sin documento DIAN" (recibo interno explícito).
- [ ] **AC5:** Superadmin puede forzar override por sesión con `Ctrl+Shift+B` (auditado en `sync_logs` con `event_type='hard_block_override'`).

## Notas de Implementación

- Reutilizar `useDianHealth` + `useEinvoiceResolutionStatus` + nuevo `useContingencyRangeStatus`.
- Documentar en CHANGELOG que es opt-in (default `false` para no romper tenants existentes).
</content>
</invoke>