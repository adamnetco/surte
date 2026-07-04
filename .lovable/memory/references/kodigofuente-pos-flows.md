---
name: Kodigo Fuente — Flujos POS con dualidad mouse+teclado
description: Cada acción del POS Kodigo Fuente tiene 3 caminos paralelos (click / hotkey / TAB); patrón "sin sorpresas" para operar sin quitar la mano del teclado
type: reference
---

# Kodigo Fuente — Flujos POS (mouse + teclado + TAB)

**Principio central:** cada operación se documenta con los **3 caminos** disponibles simultáneamente. Nunca un flujo dice "haz clic en X" sin decir también la hotkey y el orden de TAB.

## 1. Selección de cliente

- Default: **"Consumidor Final"** (nunca obliga a elegir para arrancar).
- Cambiar: click en el campo cliente **o** `TAB ↹ ×2` desde arranque **o** `Ctrl+F` estando en Código.
- Lista con búsqueda por documento o nombre.
- **Selección duplicada según destino del documento:**
  - Factura POS → `Enter` o clic en el nombre.
  - Factura electrónica → `Espacio` o clic en el **checkbox izquierdo** (distingue explícitamente entre "seleccionar" y "activar para e-doc").
- Cliente no existe → **Archivar factura** actual, salir a crear cliente, volver.

## 2. Ingresar producto

- Foco por defecto: campo **"Código"** al entrar.
- Camino A — código escaneado: lector → `Enter` (implícito con enter del escáner).
- Camino B — código manual: teclear + `Enter`.
- Camino C — búsqueda por nombre: `TAB ↹` una vez → escribir nombre → `Enter` → lista → `↑↓ + Enter`.
- Camino D — peso manual (báscula): en campo Código teclear kg + tecla **`+`** → aparece punto rojo indicando "peso capturado" → luego teclear código y precio/kg → sistema calcula.

## 3. Modificar cantidad de una línea

1. `↑↓` sobre la lista de productos → línea sombreada.
2. `Enter` → línea entra en modo edición.
3. Escribir cantidad → `Enter` guarda.

Botones alternativos permanentes: `-1 (F8)` y `+1 (F9)` — atajos +/−1 sin abrir edición.

## 4. Eliminar una línea

`↑↓` para sombrear + **`Backspace`** (Delete/Borrar). Sin confirmación (asume que el operador ve la línea).

Alternativa: botón `BORRAR LINEA` en la columna derecha.

## 5. Totalizar (Pagar)

**3 caminos siempre disponibles** para pagar:
1. Botón **"PAGAR"** arriba.
2. Tecla **`ESC`**.
3. **`Ctrl + Enter`**.

Se abre ventana con info de factura. En **"Total pagado"** teclea monto → **"Vuelto"** aparece auto.

### Micro-flow del cierre — teclado puro:

- Imprimiendo: `Enter × 3` después del monto.
- Sin imprimir: `Enter` → `Barra espaciadora` (desactiva impresión) → `Enter × 2`.
- Factura electrónica: `Enter × 4` (paso adicional de "medio de pago").

Regla implícita: **una interacción = un tecleado**. El operador aprende la cadencia por muscle-memory.

## 6. Factura Electrónica — diferencia clave

- Al seleccionar cliente con `Espacio` (no `Enter`) aparece banner arriba: **"Factura electrónica activa"**.
- Medio de pago **obligatorio** (default: Efectivo).
- No imprime tirilla por defecto (se envía al correo).
- Observaciones: botón "Agregar observaciones" o desde teclado: en campo total pagado → `Enter` → `Espacio` toggle observaciones.

## 7. Notas Crédito / Débito (nunca desde Pagar)

Entrada: botón **"Otros"** o **`Ctrl+O`** → `TAB ↹ + Enter` sobre "Nota Crédito" (o Débito).

Flujo:
1. Lista de clientes → sombrear + `Enter`.
2. Lista de facturas del cliente → sombrear + `Enter`.
3. Formulario tipo factura para registrar productos a restar/agregar.
4. Escoger concepto: campo "Otros" o `TAB × 2`.
5. `Ctrl+Enter` para guardar → confirmación → Sí.

**Causas documentadas oficialmente** (aparecen en la ayuda contextual):
- Nota crédito: devolución, descuento, cobro mal aplicado.
- Nota débito: corrección de precio, cargos adicionales, error en descuento.

## 8. Búsqueda inversa por documento

En el formulario de administración: teclear N° documento en campo → `Enter`. Si existe, formulario se rellena; si no, entra en modo "crear" con los campos vacíos. **Mismo formulario para buscar y crear** — sin cambio de vista.

## 9. Cotizaciones, Cargar, Archivar

- **Archivar** (botón superior) = suspender factura actual sin cerrarla. Se recupera con **Cargar**.
- **Cotización** = documento no fiscal, se crea desde el mismo flujo pero se totaliza sin cobrar.

Nunca hay "borradores" o "listas de suspendidas" separadas — Cargar es la única pantalla para retomar cualquier trabajo pendiente.

## Cómo aplicarlo a SistecPOS Core

- **Todo botón en `POSWorkspace` debe llevar su hotkey impresa** (ya lo hacemos con F2 en COBRAR — extender a Otros/Cargar/Archivar/F8/F9).
- **Numpad on-screen debe también responder a `F8/F9`** (`vibrate?.(8)` + acción −1/+1) y no ser sólo entrada numérica.
- **Selección de línea en el ticket con `↑↓`** cuando el ticket tiene foco — actualmente sólo se selecciona con tap. Añadir `useKeyDown` en `TicketLineRow` (`Backspace` para borrar, `Enter` para editar cantidad).
- **Buscador de cliente con `Ctrl+F`** desde el campo de código de barra del catálogo.
- **Pagar** debe seguir soportando `ESC` además de `F2` (agregar en `usePOSHotkeys`).
- **Pattern de "un formulario, dos modos" (crear/buscar):** aplicarlo en `POSCustomerPicker` y `POSQuickCreate` — hoy son sheets separados, deberían compartir contexto.

## Referencias

- https://docs.kodigofuente.com/docs/manual-pos/facturacion/Facturacionypagosenposelectr%C3%B3nico (367 líneas, la referencia más completa)
- https://docs.kodigofuente.com/docs/manual-pos/facturacion/cuadrarCaja
- https://docs.kodigofuente.com/docs/manual-pos/facturacion/cotizaciones
- https://docs.kodigofuente.com/docs/manual-pos/facturacion/reimprimirFactura
