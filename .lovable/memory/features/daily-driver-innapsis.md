---
name: Daily Driver + Innapsis
description: Pantalla diaria del admin con panel resumen + filtros y módulo Innapsis con timeline paginado
type: feature
---
**Daily Driver (`/admin/diario`)**
- Hub mobile-first con KPIs (refetch 60s), checklist persistido en `daily_checklist`, drawer móvil con subgrupos colapsables.
- Panel resumen con 3 tiles tap-eables (Errores DIAN+sync, Bajo stock, Total) que actúan como atajos de filtro.
- Chips de filtro por severidad (Todo/Crítico/Alerta/Info) con contadores reales; cuando no hay matches, muestra "Sin acciones en este filtro".
- Acciones ordenadas por severidad (`danger` → `warn` → `info`) y peso (impacto × cantidad).
- Notas inline en checklist (textarea, max 500 chars, Cmd/Ctrl+Enter guarda, Esc cancela), persistidas en `daily_checklist.notes`.

**Innapsis (`/admin/innapsis` y `/admin/innapsis/:id`)**
- Listado con búsqueda (CUFE/NIT/número) + filtros de estado.
- Detalle muestra timeline `einvoice_events` paginado (25 por página, "Cargar 25 más" hasta `total`).
- Acciones rápidas: forced_retry vía `innapsis-emit`, descarga PDF/XML, copiar CUFE.
- Refetch automático cada 15s sobre eventos; alerta inline de `last_error`.
