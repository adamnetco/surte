import { Store, Copy, ExternalLink } from "lucide-react";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { toast } from "sonner";

/**
 * Banner que se muestra en TODAS las pantallas por-tienda del Superadmin.
 * Hace inequívoco qué tienda se está administrando (nombre + slug + UUID).
 */
export default function TenantScopeBanner() {
  const { currentOrg } = useOrganization();
  if (!currentOrg) return null;

  const copyId = () => {
    navigator.clipboard.writeText(currentOrg.id).then(() => toast.success("ID copiado"));
  };

  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Store size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
            Administrando tienda
          </p>
          <p className="font-heading font-bold text-base truncate">{currentOrg.name}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span className="font-mono">{currentOrg.slug}</span>
            <span>·</span>
            <button
              onClick={copyId}
              className="font-mono hover:text-foreground inline-flex items-center gap-1"
              title="Copiar UUID"
            >
              {currentOrg.id.slice(0, 8)}…<Copy size={10} />
            </button>
          </div>
        </div>
      </div>
      <a
        href={`/superadmin/t/${currentOrg.slug}`}
        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 shrink-0"
      >
        Salud de la tienda <ExternalLink size={11} />
      </a>
    </div>
  );
}
