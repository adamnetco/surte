---
name: FX Casas de Cambio
description: Módulo FX con búsqueda por divisa/par y actualización desde fuente configurada (TRM Banrep)
type: feature
---
- Página `/casas-de-cambio` permite filtrar divisas y pares por código/nombre vía buscador unificado.
- Cada par USD/COP muestra acción "TRM Banrep" → invoca edge function `fx-import-trm` con `publish: true`.
- `fx_rates.source` distingue origen (`manual`, `trm_banrep`, `api`); se muestra en la fila de cotización actual.
- Cotizaciones tab incluye atajo "Importar TRM oficial" inline por par USD/COP.
