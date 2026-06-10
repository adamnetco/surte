import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronDown, ExternalLink, RefreshCw, Send, ShieldCheck, Globe, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Site {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
  updated_at?: string;
  tenant_domains?: Array<{ hostname: string; is_primary?: boolean; cf_status?: string | null; cf_ssl_status?: string | null; verified_at?: string | null }>;
  tenant_wp_config?: Array<{ wp_base_url?: string; wp_app_password?: string | null }>;
}

interface Props {
  site: Site;
  onSync: () => void;
  onTogglePublish: () => void;
  onConfigWp: () => void;
}

function rel(ts?: string | null) {
  if (!ts) return "Nunca";
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "hace segundos";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

function DetailsBody({ site, onSync, onTogglePublish, onConfigWp }: Props) {
  const primary = site.tenant_domains?.find((d) => d.is_primary) ?? site.tenant_domains?.[0];
  const wp = site.tenant_wp_config?.[0];
  const [verifying, setVerifying] = useState(false);

  const verifyDns = async () => {
    if (!primary?.hostname) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloudflare-domain-status", {
        body: { hostname: primary.hostname },
      });
      if (error) throw error;
      toast.success(`Cloudflare: ${data?.status ?? "ok"} · SSL: ${data?.ssl_status ?? "—"}`);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo verificar DNS");
    } finally { setVerifying(false); }
  };

  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <dt className="text-muted-foreground">Última actualización</dt>
      <dd className="font-medium" title={site.updated_at ?? ""}>{rel(site.updated_at)}</dd>

      <dt className="text-muted-foreground">Publicación</dt>
      <dd className="font-medium">{site.is_published ? "Publicado" : "Borrador"}</dd>

      <dt className="text-muted-foreground">Dominio</dt>
      <dd className="font-mono truncate" title={primary?.hostname ?? ""}>{primary?.hostname ?? "—"}</dd>

      <dt className="text-muted-foreground">Estado CF</dt>
      <dd className="font-medium">{primary?.cf_status ?? "—"}</dd>

      <dt className="text-muted-foreground">SSL</dt>
      <dd className="font-medium">{primary?.cf_ssl_status ?? "—"}</dd>

      <dt className="text-muted-foreground">WordPress</dt>
      <dd className="truncate">{wp?.wp_base_url ? new URL(wp.wp_base_url).hostname : "Sin configurar"}</dd>

      <dd className="col-span-2 mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onSync} disabled={!wp?.wp_app_password} aria-label="Sincronizar productos">
          <Send className="h-3.5 w-3.5 mr-1" aria-hidden /> Sincronizar
        </Button>
        <Button size="sm" variant="outline" onClick={onTogglePublish} aria-label={site.is_published ? "Despublicar sitio" : "Publicar sitio"}>
          <Globe className="h-3.5 w-3.5 mr-1" aria-hidden /> {site.is_published ? "Despublicar" : "Publicar"}
        </Button>
        <Button size="sm" variant="outline" onClick={onConfigWp} aria-label="Configurar WordPress">
          WP
        </Button>
        {primary?.hostname && (
          <>
            <Button size="sm" variant="outline" onClick={verifyDns} disabled={verifying} aria-label="Verificar DNS y SSL">
              {verifying ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" aria-hidden />}
              Verificar DNS
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={`https://${primary.hostname}`} target="_blank" rel="noreferrer" aria-label="Abrir sitio en nueva pestaña">
                <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden /> Abrir
              </a>
            </Button>
          </>
        )}
      </dd>
    </dl>
  );
}

/**
 * Panel de detalles por card. En móvil se abre como Sheet lateral; en
 * desktop se expande in-place vía Collapsible para mantener la card compacta.
 */
export default function SiteDetailsPanel(props: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="sm" variant="ghost" className="w-full justify-between" aria-label={`Ver detalles de ${props.site.name}`}>
            Detalles <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80dvh] overflow-y-auto">
          <SheetHeader><SheetTitle>{props.site.name}</SheetTitle></SheetHeader>
          <div className="mt-4"><DetailsBody {...props} /></div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-between text-xs"
          aria-expanded={open}
          aria-label={`${open ? "Ocultar" : "Ver"} detalles de ${props.site.name}`}
        >
          {open ? "Ocultar detalles" : "Ver detalles"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 border-t mt-2">
        <DetailsBody {...props} />
      </CollapsibleContent>
    </Collapsible>
  );
}
