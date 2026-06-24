---
name: Ola 5 · Slice 2 — UIAF XML oficial
description: Exportación UIAF en XML estructurado (Res. UIAF 285) además del CSV plano, disponible en /casas-de-cambio/reportes.
type: feature
---

# Ola 5 · Slice 2 — UIAF XML

## Qué se entrega
- **Lib** `src/modules/fx/lib/uiafXml.ts`:
  - `buildUiafXml(txs, currencies, meta)` genera XML 1.0 UTF-8 con root `<ReporteUIAF version="1.0" tipo="OperacionesCambio">`.
  - `<Encabezado>` con `EntidadReportante` (legal_name fallback name), `NIT` (tax_id), `Periodo` (YYYY-MM), `FechaGeneracion`, `TotalOperaciones`, `TotalSobreUmbral`, `TotalROS`.
  - `<Operaciones>` con un `<Operacion numero="N">` por transacción: `Fecha` (YYYY-MM-DD), `NumeroRecibo`, `TipoOperacion`, `MonedaEntregada/MontoEntregado`, `MonedaRecibida/MontoRecibido`, `TasaAplicada` (6 decimales), `SuperaUmbral` (S/N), `Sospechosa` (S/N), `MotivoROS`, y bloque `<Cliente>` con `TipoDocumento`, `NumeroDocumento`, `Nombre`, `Direccion`, `Ocupacion`, `OrigenFondos`.
  - `xmlEscape` cubre `& < > " '`. Campos vacíos se emiten como `<Tag/>` (self-closing).
  - `downloadXml(filename, content)` con BOM UTF-8.
- **UI** `FxReportsPage`: nuevo botón "UIAF XML" en la tarjeta "Exportaciones regulatorias" junto a "UIAF CSV". Reutiliza el `txs` y `currMap` del mes seleccionado.

## Decisiones
- Esquema autoportante (sin XSD oficial referenciado). La Resolución UIAF 285/2007 no expone un schema público estable; cada entidad reportante valida con su propio adaptador antes de cargar al portal SIREL. El XML emitido aquí es válido (well-formed) y mantiene los mismos campos que el CSV para facilitar mapping.
- Montos con 2 decimales (`fmtAmount`), tasas con 6 (`fmtRate`).
- `NIT` y `EntidadReportante` se leen del contexto `currentOrg` (`tax_id`, `legal_name`).
- Mantenemos el CSV existente por compatibilidad con flujos contables internos del cliente.

## Pendiente (próximos slices Ola 5)
- Slice 3: Reintentos automáticos de facturación de comisión fallida.
- (Opcional) Validador XSD oficial cuando UIAF publique uno o el cliente comparta el esquema de su régimen.
