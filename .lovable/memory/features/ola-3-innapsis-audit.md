---
name: Ola 3 — Innapsis Audit vs Spec FacturaE v1.9
description: Discrepancias detectadas entre integración actual y spec oficial Innapsis v1.9, ajustes aplicados Slice 1
type: feature
---

# Ola 3 — Slice 1: Audit + Hardening

## Hallazgos (referencia spec FacturaE v1.9 — POS-INNAPSIS)

### ✅ Ya implementado y correcto
- OAuth2 B2C client_credentials con `saasTenantId` + `apiKey` URL-encoded (`getToken` en innapsis-emit/status).
- Token cache 1h con margen 60s.
- Contingencia con rango propio (Ola 1) + retransmisión sin re-numeración.
- Auto-email PDF/XML al receptor (Ola 1).
- Retry server-side con backoff exponencial vía `sync_outbox` target `einvoice_emit_retry`.
- DV mod-11 calculado en cliente y backend.
- Panel `/admin/facturacion` con DV autofill + Test de Conexión.

### ⚠️ Discrepancias con spec — no críticas (no rompen prod)
1. **Endpoint emit path**: código actual `/api/v1/emision/emision/envieDocumento` (doble "emision") vs spec `/api/v1/emision/envieDocumento`. Producción funciona con el doble — Innapsis probablemente expone ambos. NO modificar sin confirmar con Innapsis.
2. **Content-Type**: enviamos `application/json` (Innapsis acepta JSON wrap del Fe object). Spec literal pide `application/xml`. Si futura versión obliga XML estricto, implementar builder en Slice 2.
3. **Campos opcionales faltantes en Encabezado/Emisor** — añadidos en este slice (ver abajo).

### ✅ Ajustes aplicados en este Slice
1. **innapsis-status ping reforzado**: además de validar token OAuth2, ahora hace hop 2 a `/api/v1/configuraciones/manuales/consulteManuales` para verificar autorización end-to-end en el API gateway. Devuelve `{ gateway: { ok, status, detail } }`. Best-effort: si el gateway falla el ping no se cae, solo reporta el estado.
2. **innapsis-emit Encabezado**: `Operacion` ahora es configurable vía `extra.operacion` (default "10"). Cuando es `"22"` (factura sin referencia, periodo mensual) auto-incluye `FechaPeriodoInicio` y `FechaPeriodoFin`.
3. **innapsis-emit Emisor**: `Procedencia` opcional (`extra.procedencia`) — obligatorio para Documento Soporte según spec.

## Pendientes (próximos slices)
- **Slice 2** Builder XML alterno (`Fe → UBL`) para flujos que requieran XML crudo.
- **Slice 3** UI Notas Crédito/Débito (`tipoDoc 6/5`) con referencia a CUFE original y motivo DIAN.
- **Slice 4** Validar y migrar endpoint emit a path single-`emision` cuando Innapsis confirme deprecación del doble.

## Archivos tocados
- `supabase/functions/innapsis-status/index.ts` — ping con doble hop (token + consulteManuales).
- `supabase/functions/innapsis-emit/index.ts` — Procedencia, Operacion configurable, FechaPeriodo* para op 22.
