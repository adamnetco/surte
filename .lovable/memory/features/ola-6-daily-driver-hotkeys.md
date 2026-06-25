---
name: Ola 6 Slice A — Hotkeys globales + cheatsheet
description: Atajos de teclado estilo Linear/Gmail montados globalmente con cheatsheet (?) y footer top-3 en /admin/diario
type: feature
---
# Ola 6 Slice A — Daily Driver Hotkeys

`src/components/GlobalHotkeys.tsx` (nuevo) — Componente montado en `App.tsx` junto a `GlobalCommandPalette`. Maneja:

- **Secuencias G+letra** (timeout 1200ms): `g d` Diario, `g p` POS, `g a` Admin, `g i` Inventario, `g o` Pedidos, `g u` Usuarios, `g s` Configuración.
- **Atajos simples**: `n` dispara ⌘K (Nuevo pedido), `r` emite `sps:refresh` (custom event), `?` abre cheatsheet.
- **Guards**: ignora si focus en input/textarea/contenteditable o `[cmdk-root]`; ignora cuando ruta empieza con `/pos` (POS tiene `usePOSHotkeys`); rechaza ctrl/meta/alt salvo en `?`.
- **Usage tracking**: `localStorage["sistecpos:hotkeys:usage"]` cuenta cada combo ejecutado. Helper exportado `getTopHotkeys(limit)`.
- **Cheatsheet**: Dialog accesible vía evento `sps:hotkeys:open` agrupado en Navegación / Acciones / Ayuda con `<kbd>` styling.

`src/modules/admin-cms/pages/Diario.tsx`:
- `HotkeyFooterHint` (inline) renderiza al final del main: botón `?` + top-3 combos más usados (refresh on window focus).
- No toca lógica existente del Diario.

Sin migraciones. Sin RLS. Solo frontend.
