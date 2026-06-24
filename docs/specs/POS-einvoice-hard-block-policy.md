# POS — Hard-Block de Cobro cuando DIAN está offline sin contingencia

**Estado:** IN_REVIEW
**Módulo:** `pos` + `admin-cms` (config) + `einvoice_configs`
**Wave:** Follow-up de [POS-innapsis-emision-pos](./POS-innapsis-emision-pos.md) (Observación #1 del review)
**Tablas:** `einvoice_configs` (nueva columna `hard_block_when_dian_down`), `einvoice_contingency_ranges`

## Problema

Hoy, cuando DIAN/Innapsis está offline y el tenant **no tiene rango de contingencia configurado**, el POS solo muestra un banner amarillo (`ResolutionStatusBanner` / `ContingencyBanner`) pero **permite cobrar igual**. Esto genera ventas que después no se podrán normalizar a DIAN dentro de las 48h y obliga al tenant a anular o emitir manualmente.

Algunos sectores (HORECA alto volumen, mayoristas) prefieren **bloquear el cobro** hasta que se restablezca DIAN o se cargue un rango de contingencia válido. Otros (minimercados de barrio) prefieren seguir cobrando en modo "recibo interno" y normalizar luego.

La política debe ser **configurable por organización**.

## Outcomes

- [x] **AC1:** Nueva columna `einvoice_configs.hard_block_when_dian_down BOOLEAN DEFAULT false` (migración aplicada).
- [x] **AC2:** Toggle en `POSBehaviorSettings` (admin/facturacion/configuracion): "Bloquear cobro si DIAN está offline y no hay rango de contingencia activo" con explicación clara del trade-off.
- [x] **AC3:** En `PaymentDialog`, si `hard_block_when_dian_down = true` Y `dian_health = down` Y `no hay contingency_range vigente` → botón "Cobrar" deshabilitado con tooltip "DIAN offline. Configure rango de contingencia o espere a restablecimiento".
- [x] **AC4:** El bloqueo NO aplica a ventas marcadas como "Sin documento DIAN" (recibo interno explícito) — `BYPASS_DOC_TYPES` en `usePosCobroGate`.
- [x] **AC5:** Superadmin puede forzar override por sesión con `Ctrl+Shift+B` (auditado en `sync_logs` con `service_name='pos_hard_block_override'`).

## Notas de Implementación

- Reutilizar `useDianHealth` + `useEinvoiceResolutionStatus` + nuevo `useContingencyRangeStatus`.
- Documentar en CHANGELOG que es opt-in (default `false` para no romper tenants existentes).

## Diseño técnico

### Schema (migración)

```sql
ALTER TABLE public.einvoice_configs
  ADD COLUMN IF NOT EXISTS hard_block_when_dian_down BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.einvoice_configs.hard_block_when_dian_down IS
  'Si true, el POS bloquea el botón Cobrar cuando DIAN/Innapsis está offline y no hay rango de contingencia vigente.';
```

No requiere backfill (default seguro = `false`).

### Hook nuevo: `useContingencyRangeStatus(orgId)`

Retorna `{ hasActiveRange: boolean, range: ContingencyRange | null, loading: boolean }`.
- Query `einvoice_contingency_ranges` por `organization_id`, `is_active=true`, `valid_from <= now() <= valid_to`, `consumed < total`.
- Cachea 30s en React Query. Realtime opcional fase 2.

### Hook agregador: `usePosCobroGate()`

```ts
{ canCharge: boolean, reason: 'ok' | 'dian_down_no_contingency' | 'no_resolution', overrideActive: boolean }
```

Combina `useDianHealth`, `useEinvoiceResolutionStatus`, `useContingencyRangeStatus`, `einvoice_configs.hard_block_when_dian_down`, doc type seleccionado y flag de override por sesión (sessionStorage `pos:hard_block_override:<orgId>`).

### UI

- **`POSBehaviorSettings`**: nuevo `<Switch>` con label, descripción larga y badge "Recomendado para HORECA alto volumen".
- **`PaymentDialog` / `SaleCompleteDialog`**: leer `usePosCobroGate()`. Si `canCharge=false`:
  - `<Button disabled>` con `<Tooltip>` explicando razón.
  - CTA secundaria "Configurar rango de contingencia" → link a `/admin/facturacion/contingencia`.
  - CTA terciaria solo si user es superadmin: "Forzar cobro (override)".
- **Excepción AC4**: si el `document_type` seleccionado es `recibo_interno` / `sin_dian`, el gate retorna `canCharge=true` sin importar el resto.

### Override (AC5)

- Atajo `Ctrl+Shift+B` solo activo cuando `usePosCobroGate().canCharge=false` y user tiene rol `superadmin`.
- Setea `sessionStorage['pos:hard_block_override:<orgId>'] = '<timestamp>'` (TTL 30 min).
- Inserta fila en `sync_logs` con `event_type='hard_block_override'`, payload `{ user_id, org_id, dian_health, has_contingency, reason }`.
- Banner persistente rojo en topbar mientras override esté activo: "Override de hard-block activo — auditoría registrada".

## QA / Casos

1. Config OFF + DIAN down + sin contingencia → cobra (comportamiento actual, no regresión).
2. Config ON + DIAN down + sin contingencia → bloqueado.
3. Config ON + DIAN down + contingencia vigente → cobra normal (marca XML `Contingencia=true`).
4. Config ON + DIAN ok → cobra normal.
5. Config ON + doc type `recibo_interno` → cobra siempre.
6. Override superadmin → cobra + fila en `sync_logs`.
7. Override de otro user (no superadmin) → atajo ignorado.

## Fuera de alcance

- Bloqueo automático al alcanzar 80% del rango de contingencia (spec aparte).
- Notificación push/email al admin cuando se activa el bloqueo (spec aparte).

</content>
</invoke>
## Implementación (Build)

**Migración:** `einvoice_configs.hard_block_when_dian_down BOOLEAN NOT NULL DEFAULT false` (idempotente).

**Archivos creados/modificados:**
- `src/modules/pos/hooks/usePosCobroGate.ts` (NEW) — combina `useDianHealth` + flag + override sessionStorage + auditoría sync_logs.
- `src/modules/admin-cms/components/POSBehaviorSettings.tsx` — añade Switch destructivo con badge "Recomendado HORECA alto volumen".
- `src/modules/pos/components/PaymentDialog.tsx` — wiring del gate, CTA configurar contingencia, banner override, atajo `Ctrl+Shift+B` para superadmin.

**Decisiones de diseño:**
- Se reutiliza `useDianHealth().hasContingencyRange` (lee JSON `einvoice_configs.contingency_range`) en lugar de crear hook nuevo contra `einvoice_contingency_ranges` (esa tabla no existe en este schema; el rango está embebido en `einvoice_configs`).
- Bypass por doc type vía set `["recibo_interno", "sin_dian", "ticket_pos"]` — ajustable.
- Override TTL 30 min en `sessionStorage['pos:hard_block_override:<orgId>']`. Auditoría en `sync_logs` con `service_name='pos_hard_block_override'` y status `warning`.
- `SaleCompleteDialog` no recibe el gate (es post-emisión, no decide cobro). El bloqueo ocurre en `PaymentDialog` antes de generar la venta.
