import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Building2 } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOrganization } from "@/context/OrganizationContext";
import { cn } from "@/lib/utils";

/**
 * Switcher persistente de tienda activa para el Superadmin.
 * - Recuerda la selección (vía OrganizationContext + localStorage).
 * - Reescribe la URL si estamos dentro de /superadmin/t/:slug/...
 */
export default function TenantSwitcher({ compact = false }: { compact?: boolean }) {
  const { orgs, currentOrg, switchOrg } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return orgs;
    return orgs.filter((o) => o.name.toLowerCase().includes(t) || o.slug.toLowerCase().includes(t));
  }, [orgs, q]);

  const handlePick = (id: string, slug: string) => {
    switchOrg(id);
    setOpen(false);
    setQ("");
    // Si estamos dentro de una ruta por-tenant, reemplaza el slug en la URL.
    const m = location.pathname.match(/^\/superadmin\/t\/[^/]+(\/.*)?$/);
    if (m && params.slug) {
      const rest = m[1] ?? "";
      navigate(`/superadmin/t/${slug}${rest}`, { replace: true });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-left",
            compact ? "px-2 py-1.5" : "px-3 py-2"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Tienda activa</p>
              <p className="text-sm font-semibold truncate">{currentOrg?.name ?? "Selecciona una tienda"}</p>
            </div>
          </div>
          <ChevronsUpDown size={14} className="text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="p-2 border-b border-border flex items-center gap-2">
          <Search size={14} className="text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar tienda…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-xs text-center text-muted-foreground">Sin resultados.</p>
          )}
          {filtered.map((o) => {
            const active = o.id === currentOrg?.id;
            return (
              <button
                key={o.id}
                onClick={() => handlePick(o.id, o.slug)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/60",
                  active && "bg-primary/5 text-primary"
                )}
              >
                <div className="min-w-0 text-left">
                  <p className="truncate font-medium">{o.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{o.slug}.sistecpos.com</p>
                </div>
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
