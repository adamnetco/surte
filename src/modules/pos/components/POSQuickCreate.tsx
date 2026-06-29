import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, PackagePlus, Truck } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

/**
 * POSQuickCreate — Sheet inline para crear Cliente / Artículo / Proveedor
 * sin abandonar el POS. Inspirado en "Cliente Nuevo +" y "Artículo Nuevo +"
 * de SoftwarePOS Colombia (ver memory softwarepos-batch1-top-ribbon).
 *
 * Mínimos campos por entidad — el detalle completo se edita luego en /admin.
 * Multi-tenant: organization_id se inyecta desde OrganizationContext.
 */
type Kind = "customer" | "product" | "supplier";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: Kind;
  /** Permite al POS reaccionar (p. ej. seleccionar el cliente recién creado). */
  onCreated?: (kind: Kind, row: { id: string; name: string }) => void;
}

export default function POSQuickCreate({ open, onOpenChange, initialTab = "customer", onCreated }: Props) {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Kind>(initialTab);
  const [busy, setBusy] = useState(false);

  // Customer (profiles)
  const [cust, setCust] = useState({ full_name: "", phone: "", email: "", city: "" });
  // Product
  const [prod, setProd] = useState({ name: "", price: "", sku: "" });
  // Supplier
  const [sup, setSup] = useState({ name: "", tax_id: "", phone: "", email: "" });

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  const reset = () => {
    setCust({ full_name: "", phone: "", email: "", city: "" });
    setProd({ name: "", price: "", sku: "" });
    setSup({ name: "", tax_id: "", phone: "", email: "" });
  };

  const submit = async () => {
    if (!currentOrg?.id) return toast.error("Selecciona una organización");
    setBusy(true);
    try {
      if (tab === "customer") {
        if (!cust.full_name.trim()) return toast.error("Nombre requerido");
        const { data, error } = await supabase
          .from("profiles")
          .insert({ ...cust, organization_id: currentOrg.id })
          .select("id, full_name")
          .single();
        if (error) throw error;
        toast.success("Cliente creado");
        onCreated?.("customer", { id: data.id, name: data.full_name ?? cust.full_name });
        qc.invalidateQueries({ queryKey: ["admin-customers", currentOrg.id] });
      } else if (tab === "product") {
        if (!prod.name.trim()) return toast.error("Nombre requerido");
        const priceNum = Number(prod.price || 0);
        if (!Number.isFinite(priceNum) || priceNum < 0) return toast.error("Precio inválido");
        const { data, error } = await supabase
          .from("products")
          .insert({
            name: prod.name.trim(),
            price: priceNum,
            sku: prod.sku.trim() || null,
            organization_id: currentOrg.id,
            is_active: true,
          })
          .select("id, name")
          .single();
        if (error) throw error;
        toast.success("Artículo creado");
        onCreated?.("product", { id: data.id, name: data.name });
        qc.invalidateQueries({ queryKey: ["admin-products"] });
        qc.invalidateQueries({ queryKey: ["products"] });
      } else {
        if (!sup.name.trim()) return toast.error("Nombre requerido");
        const { data, error } = await supabase
          .from("suppliers")
          .insert({ ...sup, organization_id: currentOrg.id })
          .select("id, name")
          .single();
        if (error) throw error;
        toast.success("Proveedor creado");
        onCreated?.("supplier", { id: data.id, name: data.name });
        qc.invalidateQueries({ queryKey: ["suppliers", currentOrg.id] });
      }
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Crear rápido</SheetTitle>
          <SheetDescription>Crea sin salir del POS. Edita el detalle luego en Admin.</SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)} className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="customer" className="gap-1.5"><UserPlus className="w-4 h-4" /> Cliente</TabsTrigger>
            <TabsTrigger value="product" className="gap-1.5"><PackagePlus className="w-4 h-4" /> Artículo</TabsTrigger>
            <TabsTrigger value="supplier" className="gap-1.5"><Truck className="w-4 h-4" /> Proveedor</TabsTrigger>
          </TabsList>

          <TabsContent value="customer" className="space-y-3 mt-4">
            <Field label="Nombre completo *">
              <Input autoFocus value={cust.full_name} onChange={(e) => setCust({ ...cust, full_name: e.target.value })} />
            </Field>
            <Field label="Teléfono"><Input inputMode="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} /></Field>
            <Field label="Ciudad"><Input value={cust.city} onChange={(e) => setCust({ ...cust, city: e.target.value })} /></Field>
          </TabsContent>

          <TabsContent value="product" className="space-y-3 mt-4">
            <Field label="Nombre *"><Input autoFocus value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} /></Field>
            <Field label="Precio (COP) *"><Input inputMode="decimal" value={prod.price} onChange={(e) => setProd({ ...prod, price: e.target.value })} /></Field>
            <Field label="SKU / Código"><Input value={prod.sku} onChange={(e) => setProd({ ...prod, sku: e.target.value })} /></Field>
            <p className="text-xs text-muted-foreground">Se crea con presentación base automática.</p>
          </TabsContent>

          <TabsContent value="supplier" className="space-y-3 mt-4">
            <Field label="Nombre / Razón social *"><Input autoFocus value={sup.name} onChange={(e) => setSup({ ...sup, name: e.target.value })} /></Field>
            <Field label="NIT / Documento"><Input value={sup.tax_id} onChange={(e) => setSup({ ...sup, tax_id: e.target.value })} /></Field>
            <Field label="Teléfono"><Input inputMode="tel" value={sup.phone} onChange={(e) => setSup({ ...sup, phone: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={sup.email} onChange={(e) => setSup({ ...sup, email: e.target.value })} /></Field>
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Guardando…" : "Crear"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
