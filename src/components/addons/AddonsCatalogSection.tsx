import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Users, FileText, Store, Plus, Loader2, Check, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAddonsCatalog, useTenantAddons, usePurchaseAddon, type Addon } from "@/lib/entitlements/useAddons";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Package, Users, FileText, Store,
};

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

const PERIOD_LABEL: Record<Addon["billing_period"], string> = {
  one_shot: "pago único",
  monthly: "/mes",
  yearly: "/año",
};

export default function AddonsCatalogSection() {
  const { currentOrg } = useOrganization();
  const { data: catalog, isLoading } = useAddonsCatalog();
  const { data: tenantAddons } = useTenantAddons(currentOrg?.id);
  const purchase = usePurchaseAddon();

  const activeCodes = new Set(
    (tenantAddons ?? []).filter((a) => a.status === "active" || a.status === "pending").map((a) => a.addon_code),
  );

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 h-[200px] animate-pulse bg-muted/40" />
        ))}
      </div>
    );
  }

  if (!catalog?.length) return null;

  async function handleBuy(addon: Addon) {
    if (!currentOrg?.id) {
      toast({ title: "Selecciona una organización primero", variant: "destructive" });
      return;
    }
    try {
      await purchase.mutateAsync({ organization_id: currentOrg.id, addon });
      toast({
        title: "Add-on reservado",
        description: `Te enviaremos el link de pago Wompi para activar "${addon.name}".`,
      });
    } catch (e: any) {
      toast({ title: "No se pudo reservar", description: e.message ?? String(e), variant: "destructive" });
    }
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      {catalog.map((a) => {
        const Icon = ICONS[a.icon ?? ""] ?? Plus;
        const existing = (tenantAddons ?? []).find((t) => t.addon_code === a.code);
        const isOwned = activeCodes.has(a.code);
        const busy = purchase.isPending && purchase.variables?.addon.code === a.code;
        return (
          <Card key={a.id} className="p-5 flex flex-col">
            <div className="flex items-start gap-3 mb-3">
              <div className="rounded-lg bg-primary/10 p-2"><Icon className="w-5 h-5 text-primary" /></div>
              <div className="flex-1">
                <h3 className="font-semibold leading-tight">{a.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
              </div>
            </div>
            <div className="text-2xl font-bold mt-auto">
              {COP(a.price_cop)}
              <span className="text-sm font-normal text-muted-foreground"> {PERIOD_LABEL[a.billing_period]}</span>
            </div>
            {isOwned && existing?.status === "active" && (
              <Badge variant="secondary" className="self-start mt-2"><Check className="w-3 h-3 mr-1" /> Activo</Badge>
            )}
            {isOwned && existing?.status === "pending" && (
              <Badge variant="outline" className="self-start mt-2"><Clock className="w-3 h-3 mr-1" /> Pago pendiente</Badge>
            )}
            <Button
              className="mt-3 w-full"
              variant={isOwned ? "outline" : "default"}
              disabled={busy || (isOwned && existing?.status === "active")}
              onClick={() => handleBuy(a)}
            >
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reservando…</>
                : isOwned && existing?.status === "active" ? "Ya activo"
                : isOwned ? "Pagar ahora" : "Comprar"}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
