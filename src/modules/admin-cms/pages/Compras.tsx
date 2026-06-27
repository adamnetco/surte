import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Truck, FileText, Link2, Star, Trash2, PackageCheck, Scan } from "lucide-react";
import { toast } from "sonner";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";
import PurchaseSuggestionsSheet from "@/modules/admin-cms/components/PurchaseSuggestionsSheet";
import ReceivePOSheet from "@/modules/admin-cms/components/ReceivePOSheet";
import InvoiceOcrSheet from "@/modules/admin-cms/components/InvoiceOcrSheet";
import SupplierPerformanceSheet from "@/modules/admin-cms/components/SupplierPerformanceSheet";

export default function Compras() {
  const { user, role, loading } = useAuth();
  const { currentOrg } = useOrganization();
  const organizationId = currentOrg?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("suppliers");

  useEffect(() => {
    if (!loading && !user) { toast.error("Acceso denegado"); navigate("/login"); }
    else if (!loading && !["superadmin","admin"].includes(role)) { toast.error("Solo administradores"); navigate("/"); }
  }, [user, role, loading, navigate]);

  if (loading || !organizationId) return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="max-w-7xl mx-auto p-4 lg:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">Compras a Proveedores</h1>
          <p className="text-sm text-muted-foreground">Maestro de proveedores, catálogo por proveedor y órdenes de compra.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full lg:w-auto">
            <TabsTrigger value="suppliers"><Truck className="w-4 h-4 mr-1" />Proveedores</TabsTrigger>
            <TabsTrigger value="catalog"><Link2 className="w-4 h-4 mr-1" />Catálogo</TabsTrigger>
            <TabsTrigger value="po"><FileText className="w-4 h-4 mr-1" />Órdenes</TabsTrigger>
            <TabsTrigger value="ocr"><Scan className="w-4 h-4 mr-1" />OCR Facturas</TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers"><SuppliersTab orgId={organizationId} qc={qc} /></TabsContent>
          <TabsContent value="catalog"><SupplierCatalogTab orgId={organizationId} qc={qc} /></TabsContent>
          <TabsContent value="po"><PurchaseOrdersTab orgId={organizationId} qc={qc} /></TabsContent>
          <TabsContent value="ocr">
            <Card className="p-6 text-center space-y-3">
              <Scan className="w-12 h-12 mx-auto text-primary" />
              <h3 className="text-lg font-heading font-semibold">Escanea facturas de proveedor</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Captura la factura con la cámara o sube una imagen. La IA extrae proveedor, items, costos y los matchea con tu inventario para aplicar el ingreso.
              </p>
              <InvoiceOcrSheet orgId={organizationId} trigger={<Button size="lg"><Scan className="w-4 h-4 mr-2" />Iniciar escaneo</Button>} />
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ─── PROVEEDORES ────────────────────────────────────────────
function SuppliersTab({ orgId, qc }: { orgId: string; qc: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", tax_id: "", contact_name: "", phone: "", email: "", city: "", payment_terms_days: 30, lead_time_days: 3 });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("organization_id", orgId).order("name");
      if (error) throw error; return data;
    },
  });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nombre requerido");
    const { error } = await supabase.from("suppliers").insert({ ...form, organization_id: orgId });
    if (error) return toast.error(error.message);
    toast.success("Proveedor creado");
    setOpen(false);
    setForm({ name: "", tax_id: "", contact_name: "", phone: "", email: "", city: "", payment_terms_days: 30, lead_time_days: 3 });
    qc.invalidateQueries({ queryKey: ["suppliers", orgId] });
  };

  const toggleActive = async (s: any) => {
    await supabase.from("suppliers").update({ is_active: !s.is_active })
      .eq("organization_id", orgId).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["suppliers", orgId] });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{suppliers?.length ?? 0} proveedores</p>
        <div className="flex items-center gap-2">
          <SupplierPerformanceSheet orgId={orgId} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo proveedor</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Razón social</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>NIT</Label><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></div>
              <div><Label>Contacto</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Ciudad</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Plazo de pago (días)</Label><Input type="number" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: +e.target.value })} /></div>
              <div><Label>Lead time (días)</Label><Input type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: +e.target.value })} /></div>
            </div>
            <Button onClick={save}>Guardar</Button>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Table>
        <TableHeader><TableRow>
          <TableHead>Proveedor</TableHead><TableHead>NIT</TableHead><TableHead>Contacto</TableHead>
          <TableHead>Lead</TableHead><TableHead>Plazo</TableHead><TableHead>Estado</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {suppliers?.map((s: any) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}<div className="text-xs text-muted-foreground">{s.city ?? "—"}</div></TableCell>
              <TableCell>{s.tax_id ?? "—"}</TableCell>
              <TableCell className="text-sm">{s.contact_name ?? "—"}<div className="text-xs text-muted-foreground">{s.phone ?? s.email ?? ""}</div></TableCell>
              <TableCell>{s.lead_time_days ?? 0}d</TableCell>
              <TableCell>{s.payment_terms_days ?? 0}d</TableCell>
              <TableCell>
                <button onClick={() => toggleActive(s)}>
                  <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Activo" : "Inactivo"}</Badge>
                </button>
              </TableCell>
            </TableRow>
          ))}
          {!suppliers?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin proveedores aún.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

// ─── CATÁLOGO PROVEEDOR ↔ PRODUCTOS ────────────────────────
function SupplierCatalogTab({ orgId, qc }: { orgId: string; qc: any }) {
  const [supplierId, setSupplierId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<any>({ product_id: "", supplier_sku: "", supplier_name_ref: "", unit_cost: 0, pack_size: 1, lead_time_days: 0, is_preferred: false });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-list", orgId],
    queryFn: async () => (await supabase.from("suppliers").select("id,name").eq("organization_id", orgId).eq("is_active", true).order("name")).data ?? [],
  });

  const { data: rows } = useQuery({
    queryKey: ["supplier-products", orgId, supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data } = await supabase.from("supplier_products")
        .select("*, products(name, sku, gtin, image_url)")
        .eq("organization_id", orgId)
        .eq("supplier_id", supplierId).order("supplier_sku");
      return data ?? [];
    },
    enabled: !!supplierId,
  });

  const { data: searchProducts } = useQuery({
    queryKey: ["product-search", orgId, search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const { data } = await supabase.from("products").select("id,name,sku")
        .eq("organization_id", orgId)
        .ilike("name", `%${search}%`).limit(10);
      return data ?? [];
    },
    enabled: search.length >= 2,
  });

  const link = async () => {
    if (!supplierId || !form.product_id || !form.supplier_sku.trim()) return toast.error("Producto y SKU del proveedor requeridos");
    const { error } = await supabase.from("supplier_products").insert({ ...form, organization_id: orgId, supplier_id: supplierId });
    if (error) return toast.error(error.message);
    toast.success("Vinculación creada");
    setOpen(false);
    setForm({ product_id: "", supplier_sku: "", supplier_name_ref: "", unit_cost: 0, pack_size: 1, lead_time_days: 0, is_preferred: false });
    qc.invalidateQueries({ queryKey: ["supplier-products", supplierId] });
  };

  const togglePreferred = async (r: any) => {
    await supabase.from("supplier_products").update({ is_preferred: !r.is_preferred })
      .eq("organization_id", orgId).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["supplier-products", orgId, supplierId] });
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar vinculación?")) return;
    await supabase.from("supplier_products").delete()
      .eq("organization_id", orgId).eq("id", id);
    qc.invalidateQueries({ queryKey: ["supplier-products", orgId, supplierId] });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <Label>Proveedor</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
            <SelectContent>{suppliers?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={!supplierId}><Plus className="w-4 h-4 mr-1" />Vincular producto</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Asociar producto con SKU del proveedor</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Buscar producto interno</Label>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre del producto…" />
                {searchProducts && searchProducts.length > 0 && (
                  <div className="border rounded-md mt-1 max-h-40 overflow-auto">
                    {searchProducts.map((p: any) => (
                      <button key={p.id} className={`w-full text-left p-2 hover:bg-muted text-sm ${form.product_id === p.id ? "bg-primary/10" : ""}`}
                        onClick={() => { setForm({ ...form, product_id: p.id }); setSearch(p.name); }}>
                        {p.name} <span className="text-muted-foreground">({p.sku ?? "—"})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>SKU del proveedor *</Label><Input value={form.supplier_sku} onChange={(e) => setForm({ ...form, supplier_sku: e.target.value })} /></div>
                <div><Label>Nombre que usa el proveedor</Label><Input value={form.supplier_name_ref} onChange={(e) => setForm({ ...form, supplier_name_ref: e.target.value })} /></div>
                <div><Label>Costo unitario (COP)</Label><Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: +e.target.value })} /></div>
                <div><Label>Tamaño de pack</Label><Input type="number" value={form.pack_size} onChange={(e) => setForm({ ...form, pack_size: +e.target.value })} /></div>
                <div><Label>Lead time (días)</Label><Input type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: +e.target.value })} /></div>
                <div className="flex items-end gap-2"><input type="checkbox" checked={form.is_preferred} onChange={(e) => setForm({ ...form, is_preferred: e.target.checked })} /><Label>Proveedor preferido</Label></div>
              </div>
              <Button onClick={link} className="w-full">Vincular</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {supplierId && (
        <Table>
          <TableHeader><TableRow>
            <TableHead>SKU prov.</TableHead><TableHead>Producto interno</TableHead>
            <TableHead>Costo</TableHead><TableHead>Pack</TableHead><TableHead>Preferido</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.supplier_sku}</TableCell>
                <TableCell>{r.products?.name ?? "(producto eliminado)"}<div className="text-xs text-muted-foreground">{r.supplier_name_ref}</div></TableCell>
                <TableCell>${Number(r.unit_cost).toLocaleString("es-CO")}</TableCell>
                <TableCell>{r.pack_size}</TableCell>
                <TableCell><button onClick={() => togglePreferred(r)}><Star className={`w-4 h-4 ${r.is_preferred ? "fill-accent text-accent" : "text-muted-foreground"}`} /></button></TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
              </TableRow>
            ))}
            {!rows?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin productos vinculados.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

// ─── ÓRDENES DE COMPRA ──────────────────────────────────────
function PurchaseOrdersTab({ orgId, qc }: { orgId: string; qc: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ supplier_id: "", po_code: "", expected_at: "", notes: "" });
  const [receivePoId, setReceivePoId] = useState<string | null>(null);

  const { data: pos } = useQuery({
    queryKey: ["purchase-orders", orgId],
    queryFn: async () => (await supabase.from("purchase_orders")
      .select("*, suppliers(name), purchase_order_items(*)")
      .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-list", orgId],
    queryFn: async () => (await supabase.from("suppliers").select("id,name").eq("organization_id", orgId).eq("is_active", true).order("name")).data ?? [],
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", orgId],
    queryFn: async () => (await supabase.from("warehouses").select("id,name").eq("organization_id", orgId)).data ?? [],
  });

  const create = async () => {
    if (!form.supplier_id) return toast.error("Selecciona proveedor");
    const wh = warehouses?.[0]?.id;
    if (!wh) return toast.error("Crea una bodega primero en Inventario");
    const { error } = await supabase.from("purchase_orders").insert([{
      organization_id: orgId, supplier_id: form.supplier_id, warehouse_id: wh,
      po_code: form.po_code || null,
      expected_at: form.expected_at || null, notes: form.notes, status: "draft",
    }]);
    if (error) return toast.error(error.message);
    toast.success("OC creada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["purchase-orders", orgId] });
  };


  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{pos?.length ?? 0} órdenes recientes</p>
        <div className="flex items-center gap-2">
          <PurchaseSuggestionsSheet orgId={orgId} warehouseId={warehouses?.[0]?.id} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Nueva OC</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva orden de compra</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Proveedor *</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>{suppliers?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Código OC</Label><Input value={form.po_code} onChange={(e) => setForm({ ...form, po_code: e.target.value })} /></div>
              <div><Label>Fecha esperada</Label><Input type="date" value={form.expected_at} onChange={(e) => setForm({ ...form, expected_at: e.target.value })} /></div>
              <div><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={create} className="w-full">Crear borrador</Button>
            </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Table>
        <TableHeader><TableRow>
          <TableHead>OC</TableHead><TableHead>Proveedor</TableHead><TableHead>Fecha</TableHead>
          <TableHead>Líneas</TableHead><TableHead>Total</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {pos?.map((p: any) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{p.po_code ?? p.po_number ?? p.id.slice(0, 8)}</TableCell>
              <TableCell>{p.suppliers?.name}</TableCell>
              <TableCell>{new Date(p.created_at).toLocaleDateString("es-CO")}</TableCell>
              <TableCell>{p.purchase_order_items?.length ?? 0}</TableCell>
              <TableCell>${Number(p.total ?? 0).toLocaleString("es-CO")}</TableCell>
              <TableCell><Badge variant={p.status === "received" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
              <TableCell>
                {p.status !== "received" && (
                  <Button size="sm" variant="outline" onClick={() => setReceivePoId(p.id)}><PackageCheck className="w-4 h-4 mr-1" />Recibir</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!pos?.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aún no hay órdenes de compra.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <ReceivePOSheet
        open={!!receivePoId}
        onOpenChange={(o) => !o && setReceivePoId(null)}
        poId={receivePoId}
        orgId={orgId}
        warehouseId={warehouses?.[0]?.id}
      />
    </Card>
  );
}
