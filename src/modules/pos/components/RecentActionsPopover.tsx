/**
 * Ola 6 — Slice G (AC6)
 * Popover lanzado desde el mini-rail derecho del POS con las últimas acciones
 * realizadas por el cajero. Click → re-dispara la acción mediante el handler
 * mapeado por `type` en el workspace.
 */
import { History, Pause, Receipt, BarChart3, Wallet, RefreshCw, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RecentAction, RecentActionType } from "../hooks/useRecentActions";

const ICONS: Record<RecentActionType, React.ComponentType<{ className?: string }>> = {
  park: Pause,
  nc: Receipt,
  ventas: BarChart3,
  cajon: Wallet,
  refresh: RefreshCw,
  sale_complete: CheckCircle2,
};

function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return new Date(ts).toLocaleDateString();
}

interface Props {
  actions: RecentAction[];
  onReplay: (action: RecentAction) => void;
  onClear: () => void;
}

export default function RecentActionsPopover({ actions, onReplay, onClear }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-11 w-11 rounded-md"
          title="Acciones recientes"
          aria-label="Acciones recientes"
        >
          <History className="h-[18px] w-[18px]" />
          {actions.length > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground grid place-items-center"
              aria-hidden="true"
            >
              {actions.length > 9 ? "9+" : actions.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-72 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Acciones recientes
          </p>
          {actions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={onClear}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Limpiar
            </Button>
          )}
        </div>
        {actions.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Sin acciones registradas en este turno.
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {actions.map((a) => {
              const Icon = ICONS[a.type] ?? History;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onReplay(a)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground">{timeAgo(a.ts)}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
