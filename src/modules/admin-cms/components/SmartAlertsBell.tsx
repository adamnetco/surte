import { useState } from "react";
import { Bell, AlertTriangle, CheckCircle2, RefreshCw, X, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useSmartAlerts, type SmartAlert } from "../hooks/useSmartAlerts";

const sevTone = (s: SmartAlert["severity"]) =>
  s === "critical"
    ? "bg-destructive/10 text-destructive border-destructive/30"
    : s === "warning"
    ? "bg-accent/10 text-accent border-accent/30"
    : "bg-muted text-muted-foreground border-border";

export default function SmartAlertsBell() {
  const { currentOrg } = useOrganization();
  const { alerts, loading, refetch } = useSmartAlerts(currentOrg?.id);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const totalCount = alerts.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          aria-label={`Alertas (${totalCount})`}
        >
          <Bell size={18} />
          {totalCount > 0 && (
            <span
              className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                criticalCount > 0 ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground"
              }`}
            >
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[340px] p-0 max-h-[70vh] overflow-hidden flex flex-col">
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between bg-card">
          <div>
            <p className="text-sm font-bold font-heading flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-accent" />
              Alertas inteligentes
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalCount === 0 ? "Todo en orden" : `${totalCount} pendiente(s)${criticalCount > 0 ? ` · ${criticalCount} crítica(s)` : ""}`}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-50"
            aria-label="Actualizar"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 && !loading && (
            <div className="px-4 py-10 text-center">
              <CheckCircle2 size={28} className="text-success mx-auto mb-2 opacity-70" />
              <p className="text-sm font-semibold">Sin alertas activas</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Te avisaremos de stock crítico, traslados pendientes, errores DIAN y FX.
              </p>
            </div>
          )}
          {alerts.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                if (a.href) {
                  nav(a.href);
                  setOpen(false);
                }
              }}
              className="w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/50 flex gap-2 items-start"
            >
              <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${sevTone(a.severity)}`}>
                {a.severity === "critical" ? "Crít" : a.severity === "warning" ? "Avis" : "Info"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-tight">{a.title}</p>
                {a.description && <p className="text-[10px] text-muted-foreground mt-0.5">{a.description}</p>}
              </div>
              {a.href && <ArrowRight size={12} className="text-muted-foreground mt-1" />}
            </button>
          ))}
        </div>

        {alerts.length > 0 && (
          <div className="px-3 py-2 border-t border-border bg-muted/30">
            <button
              onClick={() => setOpen(false)}
              className="w-full text-[11px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
            >
              <X size={11} /> Cerrar
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
