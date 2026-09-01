import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard, ShoppingCart, Navigation, Receipt, Lock, ScanLine } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Shortcut = { key: string; label: string; hint?: string };
type Section = { title: string; icon: React.ComponentType<{ className?: string }>; items: Shortcut[] };

/**
 * Ayuda de atajos del POS — categorizada para escaneo rápido.
 * Fuente única de verdad: refleja los listeners reales en POSWorkspace.tsx.
 */
const SECTIONS: Section[] = [
  {
    title: "Venta",
    icon: ShoppingCart,
    items: [
      { key: "F2", label: "Cobrar ticket", hint: "Abre el diálogo de pago (F12 alternativo)" },
      { key: "F6", label: "Pendiente / Facturar", hint: "Con ticket: lo suspende. Ticket vacío: factura el último pedido" },
      { key: "F7", label: "Generar cotización" },
      { key: "F8", label: "Suspender ticket", hint: "Guarda para retomarlo desde 'Suspendidas'" },
      { key: "F4", label: "Cambiar modo de venta", hint: "Ciclar Mesa / Autoservicio / Domicilio / Consumo interno" },
      { key: "F5", label: "Cambiar", hint: "En Mesas: asigna/cambia mesa. En el resto: cambia la cantidad de la línea" },
    ],
  },
  {
    title: "Búsqueda y navegación",
    icon: Navigation,
    items: [
      { key: "F1", label: "Mostrar / ocultar esta ayuda" },
      { key: "F3", label: "Buscar producto", hint: "Foco en el buscador del catálogo" },
      { key: "⌘K / Ctrl+K", label: "Command Palette", hint: "Buscar por nombre, SKU o código de barras" },
      { key: "Ctrl+F", label: "Buscar / crear cliente" },
      { key: "Alt+1…9", label: "Añadir producto Nº N del catálogo visible", hint: "Estilo VectorPOS — no funciona mientras escribes" },
      { key: "Esc", label: "Salir / volver", hint: "Cierra diálogos o vuelve a la vista anterior" },
    ],
  },
  {
    title: "Ticket abierto",
    icon: Receipt,
    items: [
      { key: "↑ / ↓", label: "Seleccionar línea del ticket" },
      { key: "0…9", label: "Editar cantidad de la línea seleccionada" },
      { key: "Backspace / Delete", label: "Eliminar línea seleccionada" },
      { key: "Enter", label: "Confirmar cantidad / edición" },
      { key: "F9", label: "Limpiar ticket completo", hint: "Pide confirmación" },
      { key: "Ctrl+P", label: "Reimprimir último ticket", hint: "Abre la vista previa del último ticket del turno" },
    ],
  },
  {
    title: "Seguridad",
    icon: Lock,
    items: [
      { key: "Ctrl+L", label: "Bloquear caja ahora", hint: "Requiere PIN configurado" },
    ],
  },
  {
    title: "Scanner",
    icon: ScanLine,
    items: [
      { key: "Escaneo automático", label: "Lectores tipo teclado se detectan sin enfocar ningún campo", hint: "Ráfaga rápida + Enter" },
    ],
  },
];

export default function POSShortcutsOverlay({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Atajos de teclado del POS
          </DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.title} aria-labelledby={`shortcuts-${section.title}`}>
                <h3
                  id={`shortcuts-${section.title}`}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5"
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                  {section.title}
                </h3>
                <ul className="space-y-0.5">
                  {section.items.map((s) => (
                    <li
                      key={s.key + s.label}
                      className="flex items-start gap-2.5 py-1.5 px-1 border-b last:border-b-0 border-border/50"
                    >
                      <kbd className="shrink-0 inline-flex items-center justify-center min-w-[46px] h-6 px-1.5 bg-muted border border-border rounded font-mono text-[11px] font-semibold text-primary">
                        {s.key}
                      </kbd>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium leading-tight">{s.label}</p>
                        {s.hint && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.hint}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-3 border-t">
          F2 y F3 funcionan incluso mientras escribes en un campo. Los demás atajos requieren que no haya foco en un input.
        </p>
      </DialogContent>
    </Dialog>
  );
}
