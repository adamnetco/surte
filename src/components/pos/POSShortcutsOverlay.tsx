import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SHORTCUTS: { key: string; label: string; hint?: string }[] = [
  { key: "F1", label: "Mostrar / ocultar esta ayuda" },
  { key: "F2 / F12", label: "Cobrar ticket", hint: "Abre el diálogo de pago" },
  { key: "F3", label: "Buscar producto", hint: "Foco en el buscador" },
  { key: "⌘K / Ctrl+K", label: "Command Palette", hint: "Búsqueda rápida por nombre, SKU o código" },
  { key: "F4", label: "Cambiar modo de venta", hint: "Ciclar entre Mesa / Autoservicio / Domicilio / Consumo" },
  { key: "F6", label: "Facturar último ticket", hint: "Emite factura electrónica DIAN" },
  { key: "F7", label: "Generar cotización" },
  { key: "F8", label: "Suspender ticket", hint: "Guardar para retomar después" },
  { key: "F9", label: "Limpiar ticket", hint: "Pide confirmación" },
  { key: "Esc", label: "Cerrar / Cierre Z", hint: "Cierra diálogos o abre cierre de caja" },
  { key: "Scanner", label: "Escaneo automático", hint: "El POS detecta lectores tipo teclado sin enfocar ningún campo" },
];

export default function POSShortcutsOverlay({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Atajos de teclado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-start gap-3 py-2 px-1 border-b last:border-b-0 border-border/60"
            >
              <kbd className="shrink-0 inline-flex items-center justify-center min-w-[42px] h-7 px-2 bg-muted border border-border rounded font-mono text-xs font-semibold text-primary">
                {s.key}
              </kbd>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{s.label}</p>
                {s.hint && <p className="text-[11px] text-muted-foreground mt-0.5">{s.hint}</p>}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground text-center pt-2 border-t">
          Los atajos F2 y F3 funcionan incluso mientras escribes en un campo.
        </p>
      </DialogContent>
    </Dialog>
  );
}
