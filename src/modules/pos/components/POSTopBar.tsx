import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings, Clock, User, LogOut, Keyboard } from "lucide-react";
import POSModeBar from "./POSModeBar";
import POSWorkspaceNav from "./POSWorkspaceNav";
import type { PosMode } from "@/modules/pos/lib/posModes";

interface Props {
  shiftLabel: string;          // e.g. "Turno #12"
  cashierName: string;
  openedAt: string;            // ISO
  modes: PosMode[];
  activeMode: PosMode;
  onChangeMode: (m: PosMode) => void;
  onCloseShift: () => void;
  onOpenShortcuts: () => void;
  rightExtras?: React.ReactNode; // offline / sync indicators
}

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Top bar compacto 48px con info de turno + acceso a configuración del POS. */
export default function POSTopBar({
  shiftLabel,
  cashierName,
  openedAt,
  modes,
  activeMode,
  onChangeMode,
  onCloseShift,
  onOpenShortcuts,
  rightExtras,
}: Props) {
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    const tick = () => setElapsed(fmtElapsed(Date.now() - new Date(openedAt).getTime()));
    tick();
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, [openedAt]);

  return (
    <header className="sticky top-0 z-30 bg-card border-b">
      <div className="h-12 flex items-center px-3 gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-black">
            SP
          </div>
          <span className="hidden sm:inline text-sm font-bold text-primary">SistecPOS</span>
        </div>

        <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{shiftLabel}</span>
          <span className="flex items-center gap-1"><User className="w-3 h-3" />{cashierName}</span>
          <span className="flex items-center gap-1 tabular-nums"><Clock className="w-3 h-3" />{elapsed}</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          {rightExtras}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 focus-visible:ring-2 focus-visible:ring-ring" aria-label="Abrir configuración del POS">
                <Settings className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px]">
              <SheetHeader>
                <SheetTitle>Sesión POS</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Turno</span><span className="font-semibold">{shiftLabel}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cajero</span><span className="font-semibold">{cashierName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Abierto hace</span><span className="font-semibold tabular-nums">{elapsed}</span></div>
                </div>
                <Button variant="outline" className="w-full justify-start" onClick={onOpenShortcuts}>
                  <Keyboard className="w-4 h-4 mr-2" /> Ver atajos de teclado
                </Button>
                <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={onCloseShift}>
                  <LogOut className="w-4 h-4 mr-2" /> Cierre Z de caja
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {modes.length > 1 && (
        <POSModeBar modes={modes} active={activeMode} onChange={onChangeMode} />
      )}
    </header>
  );
}
