# POS — Roadmap estratégico Q3 2026

**Estado:** DRAFT
**Owner:** Eduardo Tobacia
**Fecha:** 2026-06-23

## Visión

Tras cerrar la base de plataforma (multi-tenant, lifecycle, audit, billing automático), el foco se mueve de **construir infraestructura** a **construir experiencia de uso diaria y verticales de negocio**.

## Tres frentes simultáneos

### Frente A — UX diaria del operador (Daily Driver)
**Objetivo:** Que un cajero, mesero o admin pueda usar SistecPOS sin manual, con < 3 clics para cualquier acción frecuente.

**Outcomes medibles:**
- Tiempo desde login → primera venta cobrada < 30s
- 0 modales bloqueantes en el flujo de venta
- Atajos de teclado en POS (F2 cobrar, F4 cliente, ESC cancelar)
- Onboarding interactivo: nuevo tenant ve un wizard de 5 pasos
- Empty states con CTA accionable (no "no hay datos")
- Skeletons en toda lista > 200ms

**Spec hijo:** `POS-daily-driver-ux.md`

### Frente B — Integración Innapsis (Facturación Electrónica DIAN)
**Objetivo:** Cerrar el flujo de facturación electrónica end-to-end vía Innapsis para que cualquier tenant pueda emitir factura DIAN válida desde POS o ecommerce.

**Estado actual:**
- ✅ Tabla `einvoice_configs` (22 columnas, NIT/resolución/API key)
- ✅ Edge function `innapsis-emit` (245 líneas, esqueleto)
- ✅ Edge function `innapsis-status` (104 líneas, consulta estado)
- ✅ Tabla `electronic_invoices` (30 columnas) + `einvoice_events`
- 🚧 Falta: UI de configuración, emisión desde POS, retry/reintentos, descarga PDF/XML, contingencia DIAN

**Outcomes:**
- Admin configura NIT + resolución + API key en < 5 min
- Toda venta POS o ecommerce puede emitir factura (toggle)
- Si Innapsis falla → reintento exponencial + cola en `sync_outbox`
- Cliente recibe PDF + XML por email automático
- Reporte de facturación: emitidas / rechazadas / pendientes

**Spec hijo:** `POS-innapsis-integration.md`

### Frente C — Módulo Casas de Cambio (Vertical nuevo)
**Objetivo:** Habilitar SistecPOS para casas de cambio (FX): compra/venta de divisas, control de denominaciones, reportes regulatorios Colombia (UIAF, Superfinanciera).

**Tipo de negocio:** `casa_cambio` (nuevo en `business_type`)

**Outcomes:**
- Cotización multi-divisa (USD, EUR, VES, COP) con spread compra/venta
- Tasa actualizada manualmente o vía API (TRM oficial Banco República)
- Transacción FX: cliente entrega X de divisa A, recibe Y de divisa B
- Identificación obligatoria de cliente > umbral UIAF (USD 10K equiv)
- Reporte ROS (Reporte Operación Sospechosa) — generación manual
- Caja multi-divisa (denominaciones por moneda)
- Arqueo por divisa al cierre de turno
- Histórico de tasas para auditoría

**Spec hijo:** `POS-casas-de-cambio.md`

## Orden de ejecución sugerido

1. **Semana 1-2:** Casas de Cambio (spec + DB + UI básica) — desbloquea nuevo segmento
2. **Semana 2-3:** Innapsis (cerrar integración) — desbloquea facturación legal
3. **Semana 3-4:** Daily Driver UX (polish + onboarding) — mejora retención

Los 3 pueden avanzar en paralelo porque tocan capas distintas (módulo nuevo / integración / UI polish).

## Dependencias cruzadas

- Casas de Cambio **necesita** Innapsis para emitir factura de comisión de cambio
- Daily Driver UX **necesita** que ambos módulos estén estables para no rediseñar dos veces

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Innapsis API cambia formato UBL | Versionar payload en `electronic_invoices.extra` |
| Regulación UIAF estricta | Documentar disclaimer: SistecPOS provee herramienta, no responsabilidad legal |
| Casas de Cambio = nicho pequeño | Validar con 1-2 pilotos antes de invertir en features avanzadas |
