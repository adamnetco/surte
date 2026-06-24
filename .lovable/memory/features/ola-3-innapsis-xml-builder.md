---
name: Ola 3 — Innapsis XML Builder (Slice 2)
description: Builder XML opt-in Fe→string conforme spec Innapsis v1.9, integrado en innapsis-emit con flag cfg.extra.payload_format
type: feature
---

# Ola 3 — Slice 2: Builder XML alterno

## Implementación
- **`buildXml.ts`** (nuevo): convierte el objeto `{ trackId, Fe: {...} }` a XML conforme jerarquía Innapsis v1.9. Reglas:
  - Raíz `<?xml version="1.0" encoding="UTF-8"?><Fe trackId="...">…</Fe>`.
  - Orden de secciones según spec: Encabezado → CondicionesDePago → … → Detalles → Adicionales.
  - Escapado XML (`&<>"'`).
  - Arrays se serializan como tags repetidos (TaxTotal, Detalles).
  - `null`/`undefined`/`""` se omiten.
- **`innapsis-emit/index.ts`**:
  - Toggle `cfg.extra.payload_format === "xml"` (opt-in por tenant).
  - Endpoint XML: `/api/v1/emision/envieDocumento?nit=<NIT>&configuracion=string` (single-emision, según spec).
  - Endpoint JSON (default, prod-proven): `/api/v1/emision/emision/envieDocumento`.
  - Content-Type aplicado dinámicamente; Accept siempre JSON para parsear respuesta.

## Tests
- `buildXml_test.ts`: 2/2 verde
  - Estructura + orden secciones + escapado XML
  - Omisión de null/undefined/empty

## Cómo activar XML para un tenant
```sql
UPDATE einvoice_configs
SET extra = jsonb_set(coalesce(extra,'{}'::jsonb), '{payload_format}', '"xml"')
WHERE organization_id = '<org-id>' AND environment = 'dev';
```

## Pendientes
- UI en `/admin/facturacion` para alternar formato (toggle visual). De momento es DB-only.
- Slice 3: UI Notas Crédito/Débito.
