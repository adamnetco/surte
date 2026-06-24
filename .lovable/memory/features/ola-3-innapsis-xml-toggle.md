---
name: Ola 3 Slice 4 — Toggle visual XML/JSON
description: UI en /admin/facturacion para elegir formato de payload Innapsis y previsualizar el último request emitido
type: feature
---

# Ola 3 — Slice 4: Toggle visual XML/JSON + preview

## UI Config
- Bloque "Formato de payload Innapsis" en tab Configuración con botones JSON | XML.
- Persiste en `einvoice_configs.extra.payload_format` (consumido por `innapsis-emit`, ver Slice 2).
- Banner naranja al activar XML recordando que requiere validación previa con Innapsis.

## Preview de payload
- Botón `Eye` por cada factura: abre Dialog con el contenido de `electronic_invoices.request_payload`.
- Si el toggle está en XML, serializa client-side con `src/modules/admin-cms/lib/feToXmlPreview.ts` (mirror de `buildXml.ts` del edge function — mantener en sync ante cambios de spec).
- Botón "Copiar" al portapapeles.

## Por qué mirror y no fetch del edge
Evita un round-trip extra (el JSON ya está en DB) y permite ver instantáneamente cómo se vería el XML aunque la factura se haya emitido en JSON.
