# Ola 27 — Configurador de factura visual 80mm

Editor split (formulario + preview en vivo de ticket 80mm) para que cada tienda configure el layout de su recibo POS / comanda / vale, con plantillas por canal de venta (mostrador, domicilio, plataforma, mesa, llevar) y secciones reordenables. Cierra gap visible vs VectorPOS (capturas: "Configurador de factura split form+preview vivo 80mm" en mem://references/vectorpos-settings-kds).

## Slices

### Slice 1 — Schema + plantilla por defecto seed
- Nueva tabla `pos_receipt_templates` (id, org_id, name, channel `enum: counter|delivery|platform|table|takeaway|kitchen|void`, is_default, paper_width_mm 58|80, layout `jsonb` con array de secciones, header/footer texto, mostrar_logo, mostrar_qr_pago, mostrar_nit, copies, font_size, created_at, updated_at).
- GRANT + RLS estándar org-scoped + service_role.
- Seed automático on first read: plantilla "Mostrador 80mm" por org cuando no existe ninguna.
- Hook `usePosReceiptTemplates(channel?)`.

### Slice 2 — Editor split + preview en vivo 80mm
- Ruta `/admin/configuracion/recibos` con layout `grid grid-cols-1 lg:grid-cols-[420px_1fr]`:
  - Izquierda: form (RHF + zod) con accordion de secciones (Logo, Encabezado, Datos tienda, Cliente, Items, Totales, Pagos, Códigos, Pie legal, QR).
  - Derecha: `<ReceiptPreview/>` sticky, ancho fijo 302px (~80mm a 96dpi), tipografía mono, render reactivo con datos mock realistas.
- Drag & drop de orden de secciones (`@dnd-kit/sortable`, ya instalado).
- Toggles por sección: visible, mostrar título, separador.
- Cambios autosave con debounce 600ms + indicador "Guardado".

### Slice 3 — Plantillas por canal + asignación
- Tabs por canal en la cabecera del editor (counter/delivery/platform/table/takeaway/kitchen/void) con badge "default" y duplicar plantilla.
- RPC `pos_receipt_template_resolve(org, channel)` que devuelve plantilla activa por canal con fallback al default.
- Integración en `print_jobs`: el worker de impresión lee la plantilla resuelta para renderizar el ticket (no rompe jobs existentes, gating por flag `use_visual_template` en `app_settings`).

### Slice 4 — Comanda de cocina + vale de anulación
- Layouts especializados para `channel='kitchen'` (sin precios, fuente XL, separador por estación, hora, mesa/sub-letra) y `channel='void'` (vale de anulación de Ola 26 Slice 5, con motivo y hash fiscal).
- Preview muestra ejemplos contextualizados según canal seleccionado.
- Botón "Imprimir prueba" → encola `print_jobs` real con datos mock.

### Slice 5 — Export/Import JSON + galería de plantillas
- Export plantilla a JSON, import con validación zod.
- 4 plantillas prediseñadas (Minimal, Completa, Restaurante, Mayorista) disponibles desde botón "Cargar desde galería".
- QA E2E (Playwright: navegar al editor, mover sección, verificar preview cambia, autosave) + publish.

## Detalles técnicos

```text
src/modules/admin-cms/
├── pages/ReceiptTemplatesPage.tsx              # ruta /admin/configuracion/recibos
├── components/receipts/
│   ├── ReceiptTemplateEditor.tsx               # split layout
│   ├── ReceiptTemplateForm.tsx                 # RHF + zod + dnd-kit
│   ├── ReceiptPreview.tsx                      # render 302px, datos mock
│   ├── ReceiptSection.tsx                      # 10 renderers por tipo
│   ├── ChannelTabs.tsx
│   └── TemplateGalleryDialog.tsx
├── hooks/
│   ├── usePosReceiptTemplates.ts
│   └── useReceiptTemplateAutosave.ts
└── lib/
    ├── receiptLayoutSchema.ts                  # zod + tipos Section
    ├── receiptMockData.ts
    └── receiptGallery.ts                       # 4 presets

supabase/migrations/[ts]_pos_receipt_templates.sql
supabase/functions/print-worker/                # extender para leer template
```

Layout JSON ejemplo:
```text
{
  "sections": [
    {"id":"logo","type":"logo","visible":true,"align":"center"},
    {"id":"store","type":"store_info","fields":["name","nit","address","phone"]},
    {"id":"divider1","type":"divider","char":"="},
    {"id":"items","type":"items","columns":["qty","name","total"],"showModifiers":true},
    {"id":"totals","type":"totals","showTax":true,"showTip":true},
    {"id":"qr","type":"qr","content":"order_url"},
    {"id":"footer","type":"text","value":"Gracias por su compra"}
  ]
}
```

Render preview: componente puro stateless, recibe `layout` + `mockOrder`, sin red ni efectos, ideal para autosave debounce.

## Skills aplicadas
superpowers, feature-dev (clarify→architect→build→review), frontend-design (split editor minimal, mono font para ticket), frontend-ui-engineering (accessibility, dnd a11y, sticky preview), pos-feature (DB→edge→hooks→UI→ruta), code-review en cada slice.

¿Arrancamos por **Slice 1 (schema + seed)** o prefieres que empiece directo con **Slice 2 (editor + preview)** usando una plantilla hardcoded mientras valido UX?
