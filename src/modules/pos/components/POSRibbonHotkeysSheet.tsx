import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * POSRibbonHotkeysSheet — cheat-sheet de atajos del Top Ribbon de navegación.
 * Se abre con `?` (Shift+/) o desde el botón "Ayuda". No registra los atajos,
 * solo los documenta — el binding vive en `usePOSHotkeys` y `POSWorkspace`.
 */
interface Props { open: boolean; onOpenChange: (v: boolean) => void }

const NAV = [
  ["F2", "Vender / Cobrar"],
  ["F3", "Buscar en ticket"],
  ["F4", "Cambiar modo (Mesa/Llevar/Domicilio)"],
  ["F5", "Mesas"],
  ["F6", "Generar factura"],
  ["F7", "Cotización"],
  ["F8", "Suspender venta"],
  ["F9", "Limpiar ticket"],
];
const QUICK = [
  ["Alt + N", "Crear cliente / artículo / proveedor rápido"],
  ["⌘ / Ctrl + K", "Buscador global de productos"],
  ["/", "Foco al buscador"],
  ["Esc", "Cerrar diálogo activo"],
  ["?", "Mostrar esta ayuda"],
];

export default function POSRibbonHotkeysSheet({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>Operación rápida sin mouse, estilo SoftwarePOS / VectorPOS.</DialogDescription>
        </DialogHeader>

        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Navegación POS</h4>
          <ul className="divide-y border rounded-md">
            {NAV.map(([k, l]) => <Row key={k} k={k} l={l} />)}
          </ul>
        </section>

        <section className="space-y-1 mt-4">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Acciones globales</h4>
          <ul className="divide-y border rounded-md">
            {QUICK.map(([k, l]) => <Row key={k} k={k} l={l} />)}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, l }: { k: string; l: string }) {
  return (
    <li className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="text-foreground">{l}</span>
      <kbd className="px-2 py-0.5 rounded bg-muted font-mono text-[11px] border">{k}</kbd>
    </li>
  );
}
