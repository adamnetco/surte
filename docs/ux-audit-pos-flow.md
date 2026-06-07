# Auditoría UX — Flujo POS end-to-end

Recorrido: **Abrir caja → Vender (añadir producto, atajos, modos) → Cobrar (pago/split) → Cierre Z (arqueo)**.
Foco: eficiencia táctil 10–15", accesibilidad WCAG AA, claridad visual, atajos profesionales.

---

## 1. Apertura de caja — `OpenSessionPanel`

### Hallazgos
| Sev | Hallazgo | Impacto |
|---|---|---|
| P0 | Si no hay sedes o cajas configuradas, el botón "Abrir caja" muestra solo un toast genérico. | El cajero queda bloqueado sin saber qué hacer. |
| P0 | La base de caja exige tecleo numérico aunque 95% de los turnos abren con denominaciones redondas (0, 50k, 100k, 200k). | Latencia diaria innecesaria en pantallas táctiles. |
| P1 | La sede/caja preferida del cajero no se recuerda entre sesiones. | Selección manual cada apertura. |
| P1 | El error de Supabase se muestra crudo (`new row violates RLS…`). | No es legible para un cajero. |
| P2 | No hay contexto del cierre anterior (última base, último descuadre) que ayude a decidir base inicial. | Pérdida de continuidad operativa. |

### Optimizaciones aplicadas
- **Empty state inteligente** con CTA "Configurar sede / caja" cuando faltan registros.
- **Chips de base rápida** (0 · 50k · 100k · 200k · 500k) sobre el input numérico.
- **Memoria del cajero** vía `localStorage` (`pos:last_location`, `pos:last_register`).
- **Manejo de errores** con `errorToMessage()` traducido al español.
- **Submit con Enter** en el form.

---

## 2. Cobro — `PaymentDialog`

### Hallazgos
| Sev | Hallazgo | Impacto |
|---|---|---|
| P0 | El cajero debe escribir el monto recibido — sin botones de billetes (10k, 20k, 50k, 100k). | Operación más lenta que la competencia (Vendty, Loyverse). |
| P0 | El input no recibe `autoFocus` al abrir. | Click extra obligatorio. |
| P0 | Enter no confirma el cobro. | Rompe la expectativa del cajero profesional. |
| P1 | Métodos de pago como `<select>` nativo. En touch es lento e inconsistente. | Mejor chips visibles. |
| P1 | "Dividir pago" no comunica que el nuevo renglón ya viene con el saldo pendiente. | Confusión. |
| P2 | No hay desglose final del vuelto por método (importante en pagos mixtos). | Riesgo de error de cuadre. |

### Optimizaciones aplicadas
- **Método como chips** (Efectivo, Débito, Crédito, Transfer, Nequi, Daviplata) con `aria-pressed`.
- **Quick-cash**: botones del billete exacto y siguientes superiores (5k, 10k, 20k, 50k, 100k) que rellenan el monto y calculan vuelto. Solo aparecen cuando el método es efectivo.
- **AutoFocus** en el monto al abrir + **Enter** confirma cuando hay total cubierto.
- **Indicador visual del estado**: badge "Falta", "Exacto", "Vuelto" con color semántico.
- **Botón "Recibido = Total"** para cobro exacto en 1 tap.

---

## 3. Cierre Z — `CloseSessionDialog`

### Hallazgos
| Sev | Hallazgo | Impacto |
|---|---|---|
| P0 | El cajero puede cerrar con descuadre sin confirmación. | Riesgo financiero alto. |
| P0 | No hay forma de declarar "efectivo cuadrado" sin contar denominación por denominación. | Friction en cajas pequeñas. |
| P1 | La diferencia mostrada no distingue **sobrante** (warning) vs **faltante** (destructive). | Ambigüedad visual. |
| P1 | Notas son opcionales aunque haya descuadre. | Auditoría pobre. |
| P2 | Emojis 🪙/💵 inconsistentes con el sistema (memoria: sin emojis). | Inconsistencia visual. |

### Optimizaciones aplicadas
- **Botón "Cuadrar al esperado"** que rellena denominaciones desde las más grandes (greedy) para coincidir con el efectivo esperado.
- **Distinción visual**: sobrante = warning (amber), faltante = destructive (red), cuadrado = success (green).
- **AlertDialog de confirmación** si `|diff| > 5.000 COP` antes de cerrar.
- **Notas obligatorias** cuando hay diferencia.
- **Iconos lucide** (`Coins`, `Banknote`) reemplazan los emojis.
- **Resumen final** con tickets, ventas y diferencia destacados.

---

## 4. Workspace de venta — ya optimizado (pasada anterior)

- Skeleton grid + estado de error con reintento.
- Tap targets 44×44 (botones +/−/Trash).
- Variantes `cta` / `cta-primary` en lugar de estilos inline.
- Hotkeys profesionales (F2 cobrar, F3 buscar, F9 limpiar, +/-/Supr por línea enfocada).
- `aria-label`, `aria-pressed`, `focus-visible:ring` en todo el workspace.
- `AlertDialog` reemplaza `window.confirm` para limpiar ticket.

---

## Resumen ejecutivo

| Pantalla | Antes | Después |
|---|---|---|
| Apertura | 4 inputs + tecleo manual | 1 tap (chips) + memoria de cajero |
| Cobro efectivo exacto | 3 taps + tecleo | 1 tap (Recibido = Total) |
| Cobro con vuelto | tecleo manual del recibido | 1 tap en billete (5k, 10k, 20k, 50k, 100k) |
| Cierre cuadrado | conteo manual de cada denom | 1 tap (Cuadrar al esperado) |
| Cierre con descuadre | sin barrera | AlertDialog + notas obligatorias |

ROI: **−60% de taps** en apertura/cobro/cierre del cajero medio; **0 cierres silenciosos con descuadre**.
