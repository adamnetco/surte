import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Brain, Sparkles, Upload, FileImage, RefreshCw, CheckCircle2, Trash2 } from "lucide-react";

type Insight = {
  id: string; category: string; severity: string; title: string;
  message: string; status: string; generated_at: string; payload: any;
};
type Scan = {
  id: string; supplier_name: string | null; invoice_number: string | null;
  invoice_date: string | null; total: number | null; status: string;
  created_at: string; image_url: string | null;
};
type ScanItem = {
  id: string; description: string; quantity: number; unit_cost: number;
  total: number | null; matched_product_id: string | null; applied: boolean;
};
type Warehouse = { id: string; name: string };

export default function GerenteIA() {
  const { currentOrg } = useOrganization();
  const [tab, setTab] = useState("insights");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [openScan, setOpenScan] = useState<Scan | null>(null);
  const [scanItems, setScanItems] = useState<ScanItem[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { if (currentOrg) loadAll(); }, [currentOrg]);

  async function loadAll() {
    if (!currentOrg) return;
    const [i, s, w] = await Promise.all([
      supabase.from("ai_insights").select("*").eq("organization_id", currentOrg.id)
        .order("generated_at", { ascending: false }).limit(50),
      supabase.from("invoice_scans").select("*").eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false }).limit(30),
      supabase.from("warehouses").select("id,name").eq("organization_id", currentOrg.id).eq("is_active", true),
    ]);
    setInsights((i.data as any) ?? []);
    setScans((s.data as any) ?? []);
    setWarehouses((w.data as any) ?? []);
    if (w.data?.[0] && !warehouseId) setWarehouseId(w.data[0].id);
  }

  async function generateInsights() {
    if (!currentOrg) return;
    setLoadingAI(true);
    const { data, error } = await supabase.functions.invoke("ai-manager", {
      body: { organization_id: currentOrg.id },
    });
    setLoadingAI(false);
    if (error) return toast.error(error.message);
    toast.success(`${(data as any)?.count ?? 0} recomendaciones generadas`);
    await loadAll();
  }

  async function setInsightStatus(id: string, status: string) {
    await supabase.from("ai_insights").update({ status }).eq("id", id);
    await loadAll();
  }

  async function uploadInvoice(file: File) {
    if (!currentOrg) return;
    setLoadingOCR(true);
    try {
      // 1) Sube al bucket privado
      const path = `${currentOrg.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("invoices").upload(path, file);
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("invoices").createSignedUrl(path, 3600);

      // 2) base64 para enviar a OCR
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("invoice-ocr", {
        body: { organization_id: currentOrg.id, image_base64: b64, image_url: signed?.signedUrl, mime_type: file.type },
      });
      if (error) throw error;
      toast.success(`Factura procesada: ${(data as any)?.items_extracted} ítems`);
      await loadAll();
      setTab("invoices");
    } catch (e: any) {
      toast.error(e.message ?? "Error procesando factura");
    } finally {
      setLoadingOCR(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function openScanDetail(s: Scan) {
    setOpenScan(s);
    const { data } = await supabase.from("invoice_scan_items").select("*").eq("scan_id", s.id).order("line_no");
    setScanItems((data as any) ?? []);
  }

  async function updateItemMatch(itemId: string, productId: string | null) {
    await supabase.from("invoice_scan_items").update({ matched_product_id: productId }).eq("id", itemId);
    setScanItems(p => p.map(i => i.id === itemId ? { ...i, matched_product_id: productId } : i));
  }

  async function applyScan() {
    if (!openScan || !warehouseId) return toast.error("Selecciona bodega");
    const { data, error } = await supabase.rpc("apply_invoice_scan", {
      _scan_id: openScan.id, _warehouse_id: warehouseId,
    });
    if (error) return toast.error(error.message);
    const r = data as any;
    toast.success(`${r.applied} ítems aplicados al inventario · ${r.skipped} sin vincular`);
    setOpenScan(null);
    await loadAll();
  }

  async function deleteScan(s: Scan) {
    if (!confirm("¿Eliminar este escaneo?")) return;
    await supabase.from("invoice_scans").delete().eq("id", s.id);
    await loadAll();
  }

  if (!currentOrg) return <div className="p-8 text-center">Selecciona una organización</div>;

  const sevColor: Record<string, string> = { critical: "destructive", warn: "default", info: "secondary" };

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Brain className="h-7 w-7 text-primary" /> Gerente IA
        </h1>
        <p className="text-sm text-muted-foreground">Recomendaciones inteligentes y OCR de facturas para alimentar el inventario.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="insights">Insights ({insights.filter(i => i.status === "new").length})</TabsTrigger>
          <TabsTrigger value="invoices">Facturas OCR ({scans.filter(s => s.status !== "applied").length})</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Últimas recomendaciones</h2>
            <Button onClick={generateInsights} disabled={loadingAI}>
              {loadingAI ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generar análisis
            </Button>
          </div>
          <div className="grid gap-3">
            {insights.map(i => (
              <Card key={i.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={sevColor[i.severity] as any}>{i.severity}</Badge>
                      <Badge variant="outline">{i.category}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(i.generated_at).toLocaleString()}</span>
                    </div>
                    <div className="font-semibold">{i.title}</div>
                    <p className="text-sm text-muted-foreground mt-1">{i.message}</p>
                  </div>
                  <div className="flex gap-1">
                    {i.status === "new" && <Button size="sm" variant="outline" onClick={() => setInsightStatus(i.id, "seen")}>Visto</Button>}
                    {i.status !== "applied" && <Button size="sm" onClick={() => setInsightStatus(i.id, "applied")}><CheckCircle2 className="h-4 w-4" /></Button>}
                    {i.status !== "dismissed" && <Button size="sm" variant="ghost" onClick={() => setInsightStatus(i.id, "dismissed")}>×</Button>}
                  </div>
                </div>
              </Card>
            ))}
            {insights.length === 0 && <p className="text-center text-muted-foreground p-8">Sin recomendaciones aún. Pulsa "Generar análisis".</p>}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-3">
          <Card className="p-4">
            <Label className="font-semibold flex items-center gap-2 mb-2"><Upload className="h-4 w-4" /> Subir factura para OCR</Label>
            <div className="flex gap-2 items-center flex-wrap">
              <input ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadInvoice(f); }} />
              <Button onClick={() => fileInput.current?.click()} disabled={loadingOCR}>
                {loadingOCR ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <FileImage className="h-4 w-4 mr-1" />}
                {loadingOCR ? "Procesando..." : "Seleccionar imagen / PDF"}
              </Button>
              <span className="text-xs text-muted-foreground">Soporta JPG, PNG, PDF. La IA extrae ítems, costos y proveedor.</span>
            </div>
          </Card>

          {openScan && (
            <Card className="p-4 border-primary">
              <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold">{openScan.supplier_name ?? "Proveedor desconocido"}</h3>
                  <p className="text-xs text-muted-foreground">
                    Factura {openScan.invoice_number ?? "?"} · {openScan.invoice_date ?? "?"} · Total ${openScan.total?.toLocaleString("es-CO") ?? "?"}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Bodega" /></SelectTrigger>
                    <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={applyScan} disabled={openScan.status === "applied"}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Aplicar al inventario
                  </Button>
                  <Button variant="ghost" onClick={() => setOpenScan(null)}>Cerrar</Button>
                </div>
              </div>
              <ItemMatcher items={scanItems} onMatchChange={updateItemMatch} />
            </Card>
          )}

          <div className="grid gap-2">
            {scans.map(s => (
              <Card key={s.id} className="p-3 flex items-center justify-between flex-wrap gap-2 cursor-pointer hover:bg-accent"
                onClick={() => openScanDetail(s)}>
                <div>
                  <div className="font-medium text-sm">{s.supplier_name ?? "Sin proveedor"} <Badge variant={s.status === "applied" ? "default" : "outline"}>{s.status}</Badge></div>
                  <div className="text-xs text-muted-foreground">
                    Factura {s.invoice_number ?? "?"} · {s.invoice_date ?? new Date(s.created_at).toLocaleDateString()} · ${s.total?.toLocaleString("es-CO") ?? "?"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteScan(s); }}><Trash2 className="h-4 w-4" /></Button>
              </Card>
            ))}
            {scans.length === 0 && <p className="text-center text-muted-foreground p-8">Sin facturas escaneadas aún.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ItemMatcher({ items, onMatchChange, orgId }: {
  items: ScanItem[];
  onMatchChange: (id: string, productId: string | null) => void;
  orgId: string;
}) {
  const [search, setSearch] = useState<Record<string, any[]>>({});

  async function searchProducts(itemId: string, q: string) {
    if (!q || q.length < 2) return setSearch(p => ({ ...p, [itemId]: [] }));
    const { data } = await supabase.from("products").select("id,name,brand")
      .eq("organization_id", orgId)
      .ilike("name", `%${q}%`).limit(8);
    setSearch(p => ({ ...p, [itemId]: data ?? [] }));
  }

  return (
    <div className="space-y-2">
      {items.map(it => (
        <div key={it.id} className="grid grid-cols-12 gap-2 items-center text-sm border-b pb-2">
          <div className="col-span-12 md:col-span-5">
            <div className="font-medium truncate">{it.description}</div>
            <div className="text-xs text-muted-foreground">{it.quantity} × ${it.unit_cost.toLocaleString("es-CO")}</div>
          </div>
          <div className="col-span-12 md:col-span-7 relative">
            {it.matched_product_id
              ? <div className="flex items-center gap-2">
                  <Badge>Vinculado</Badge>
                  <Button size="sm" variant="ghost" onClick={() => onMatchChange(it.id, null)}>Cambiar</Button>
                </div>
              : <>
                  <Input placeholder="Buscar producto…" onChange={(e) => searchProducts(it.id, e.target.value)} />
                  {search[it.id]?.length > 0 && (
                    <div className="absolute z-10 bg-popover border rounded-md mt-1 w-full max-h-40 overflow-auto shadow">
                      {search[it.id].map((p: any) => (
                        <button key={p.id} className="block w-full text-left px-2 py-1 hover:bg-accent text-xs"
                          onClick={() => { onMatchChange(it.id, p.id); setSearch(s => ({ ...s, [it.id]: [] })); }}>
                          {p.name} <span className="text-muted-foreground">{p.brand ?? ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>}
          </div>
        </div>
      ))}
    </div>
  );
}
