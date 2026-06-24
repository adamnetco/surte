import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings, Clock, User, LogOut, Keyboard, CloudUpload, CloudOff, Loader2 } from "lucide-react";
import POSModeBar from "./POSModeBar";
import POSWorkspaceNav from "./POSWorkspaceNav";
import type { PosMode } from "@/modules/pos/lib/posModes";

/** Estado de sincronización mostrado de forma compacta y de ancho fijo
 *  para evitar reflow del cluster derecho (mantiene el ícono Settings anclado). */
export interface POSTopBarSyncState {
  pending: number;
  syncing: boolean;
  online: boolean;
  lastError?: string | null;
  onFlush?: () => void;
}

interface Props {
  shiftLabel: string;          // e.g. "Turno #12"
  cashierName: string;
  openedAt: string;            // ISO
  modes: PosMode[];
  activeMode: PosMode;
  onChangeMode: (m: PosMode) => void;
  onCloseShift: () => void;
  onOpenShortcuts: () => void;
  rightExtras?: React.ReactNode; // offline / status indicators (NO sync)
  sync?: POSTopBarSyncState;     // sync interno con slot de ancho fijo
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
  sync,
}: Props) {
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    const tick = () => setElapsed(fmtElapsed(Date.now() - new Date(openedAt).getTime()));
    tick();
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, [openedAt]);

  const hasSyncActivity = !!sync && (sync.pending > 0 || sync.syncing);

  return (
    <header className="sticky top-0 z-30 bg-card border-b">
      <div className="h-12 flex items-center px-3 gap-3">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-black">
            SP
          </div>
          <span className="hidden sm:inline text-sm font-bold text-primary">SistecPOS</span>
        </div>

        <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span className="font-semibold text-foreground">{shiftLabel}</span>
          <span className="flex items-center gap-1"><User className="w-3 h-3" />{cashierName}</span>
          <span className="flex items-center gap-1 tabular-nums"><Clock className="w-3 h-3" />{elapsed}</span>
        </div>

        {/* Switcher operativo Panel/Vender/Mesas/KDS — evita volver al hub */}
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
          <POSWorkspaceNav className="ml-1" />
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {rightExtras}
          {/* Slot interno de SYNC (ancho fijo 28px, siempre reservado) — evita reflow
              y mantiene el ícono Settings anclado en pixel-position. Visualmente discreto:
              un punto + (opcional) badge con conteo. Nunca se desmonta. */}
          <div
            data-testid="pos-topbar-sync-slot"
            className="w-7 h-7 shrink-0 flex items-center justify-center"
            aria-live="polite"
            aria-label={
              !sync ? "Sincronización inactiva"
              : sync.syncing ? "Sincronizando"
              : sync.pending > 0 ? `${sync.pending} operaciones pendientes`
              : sync.online ? "Sincronizado" : "Sin conexión"
            }
          >
            {hasSyncActivity ? (
              <button
                type="button"
                onClick={sync?.onFlush}
                title={sync?.lastError ?? (sync?.online ? "Sincronizar pendientes" : "Sin conexión · en cola")}
                className="relative inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted/60 transition"
                data-testid="pos-topbar-sync-btn"
              >
                {sync?.syncing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                  : sync?.online
                    ? <CloudUpload className="h-3.5 w-3.5 text-amber-600" />
                    : <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />}
                {sync && sync.pending > 0 && !sync.syncing ? (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-[3px] rounded-full bg-amber-500 text-[9px] font-bold text-white tabular-nums grid place-items-center">
                    {sync.pending > 9 ? "9+" : sync.pending}
                  </span>
                ) : null}
              </button>
            ) : (
              // Placeholder invisible: ocupa exactamente el mismo espacio
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-transparent" />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 hidden md:inline-flex"
            onClick={onOpenShortcuts}
            title="Atajos de teclado (?)"
            aria-label="Atajos de teclado"
          >
            <Keyboard className="w-4 h-4" />
          </Button>
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
