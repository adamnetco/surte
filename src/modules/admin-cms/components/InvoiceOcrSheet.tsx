import { useState, useRef, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Scan, Upload, Loader2, CheckCircle2, AlertCircle, Package, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Item = {
  id: string;
  line_no: number;
  supplier_sku: string | null;
  description: string;
  gtin: string | null;
  quantity: number;
  unit: string | null;
  unit_cost: number;
  total: number | null;
  matched_product_id: string | null;
  applied: boolean;
};

type Scan = {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_nit: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  status: string;
};

interface Props {
  orgId: string;
  trigger?: React.ReactNode;
}

export default function InvoiceOcrSheet({ orgId, trigger }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-mini", orgId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id,name").eq("organization_id", orgId).order("name");
      return data ?? [];
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses-mini", orgId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id,name").eq("organization_id", orgId).order("name");
      const list = data ?? [];
      if (list.length && !warehouseId) setWarehouseId(list[0].id);
      return list;
    },
  });

  const { data: scan } = useQuery<Scan | null>({
    queryKey: ["invoice-scan", activeScanId],
    enabled: !!activeScanId,
    queryFn: async () => {
      const { data } = await supabase.from("invoice_scans").select("*").eq("id", activeScanId).maybeSingle();
      return data as any;
    },
  });

  const { data: items, refetch: refetchItems } = useQuery<Item[]>({
    queryKey: ["invoice-scan-items", activeScanId],
    enabled: !!activeScanId,
    queryFn: async () => {
      const { data } = await supabase.from("invoice_scan_items").select("*").eq("scan_id", activeScanId).order("line_no");
      return (data ?? []) as any;
    },
  });

  const { data: recentScans } = useQuery<Scan[]>({
    queryKey: ["invoice-scans-recent", orgId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_scans")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as any;
    },
  });

  const handleFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) return toast.error("Máx 8 MB");
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      setPreview(b64);
      const { data, error } = await supabase.functions.invoke("invoice-ocr", {
        body: {
          organization_id: orgId,
          supplier_id: supplierId || undefined,
          image_base64: b64.split(",")[1],
          mime_type: file.type || "image/jpeg",
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`OCR completado: ${(data as any).items_extracted} renglones`);
      setActiveScanId((data as any).scan_id);
      qc.invalidateQueries({ queryKey: ["invoice-scans-recent", orgId] });
    } catch (e: any) {
      toast.error(e.message ?? "Error en OCR");
    } finally {
      setBusy(false);
    }
  };

  const updateMatch = async (itemId: string, productId: string | null) => {
    const { error } = await supabase
      .from("invoice_scan_items")
      .update({ matched_product_id: productId })
      .eq("id", itemId);
    if (error) toast.error(error.message);
    else refetchItems();
  };

  const applyScan = async () => {
    if (!scan || !items?.length) return;
    if (!warehouseId) return toast.error("Selecciona bodega");
    const eligible = items.filter((i) => i.matched_product_id && !i.applied);
    if (!eligible.length) return toast.error("No hay renglones con producto matcheado");
    if (!confirm(`Aplicar ${eligible.length} ingresos al inventario?`)) return;
    setBusy(true);
    let ok = 0;
    for (const it of eligible) {
      const { error } = await supabase.rpc("apply_stock_movement", {
        _organization_id: orgId,
        _warehouse_id: warehouseId,
        _product_id: it.matched_product_id,
        _presentation_id: null,
        _movement_type: "purchase",
        _quantity: it.quantity,
        _unit_cost: it.unit_cost,
        _reference_type: "invoice_scan",
        _reference_id: scan.id,
        _notes: `Fact. ${scan.invoice_number ?? scan.id.slice(0, 8)} L${it.line_no}`,
      } as any);
      if (!error) {
        await supabase.from("invoice_scan_items").update({ applied: true }).eq("id", it.id);
        ok++;
      }
    }
    await supabase.from("invoice_scans").update({ status: "applied", applied_at: new Date().toISOString() }).eq("id", scan.id);
    setBusy(false);
    toast.success(`${ok}/${eligible.length} renglones aplicados`);
    refetchItems();
    qc.invalidateQueries({ queryKey: ["invoice-scans-recent", orgId] });
    qc.invalidateQueries({ queryKey: ["product_stock"] });
  };

  const totals = useMemo(() => {
    const matched = items?.filter((i) => i.matched_product_id).length ?? 0;
    const applied = items?.filter((i) => i.applied).length ?? 0;
    return { matched, applied, total: items?.length ?? 0 };
  }, [items]);

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setActiveScanId(null); setPreview(null); } }}>
      <SheetTrigger asChild>{trigger ?? <Button variant="outline"><Scan className="w-4 h-4 mr-2" />Escanear factura</Button>}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>OCR de factura de proveedor</SheetTitle>
        </SheetHeader>

        {!activeScanId ? (
          <div className="space-y-4 mt-4">
            <Card className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Proveedor (opcional)</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Auto-detectar por NIT" /></SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Bodega destino</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger><SelectValue placeholder="Bodega" /></SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />Archivo
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-2" />Cámara
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </div>

              {busy && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />Analizando imagen…
                </div>
              )}
              {preview && !busy && <img src={preview} alt="preview" className="max-h-48 mx-auto rounded border" />}
            </Card>

            <div>
              <h3 className="text-sm font-semibold mb-2">Escaneos recientes</h3>
              <div className="space-y-2">
                {recentScans?.length ? recentScans.map((s) => (
                  <Card key={s.id} className="p-3 cursor-pointer hover:bg-muted/50" onClick={() => setActiveScanId(s.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.supplier_name ?? "Sin proveedor"}</p>
                        <p className="text-xs text-muted-foreground">Fact. {s.invoice_number ?? "—"} · {s.invoice_date ?? ""}</p>
                      </div>
                      <Badge variant={s.status === "applied" ? "default" : "secondary"}>{s.status}</Badge>
                    </div>
                  </Card>
                )) : <p className="text-xs text-muted-foreground">Aún no hay escaneos.</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveScanId(null)}>← Volver</Button>

            <Card className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{scan?.supplier_name ?? "Proveedor"}</p>
                  <p className="text-xs text-muted-foreground">NIT {scan?.supplier_nit ?? "—"} · Fact. {scan?.invoice_number ?? "—"}</p>
                </div>
                <Badge variant={scan?.status === "applied" ? "default" : "secondary"}>{scan?.status}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-2">
                <span>Subtotal: ${Number(scan?.subtotal ?? 0).toLocaleString("es-CO")}</span>
                <span>IVA: ${Number(scan?.tax ?? 0).toLocaleString("es-CO")}</span>
                <span className="font-semibold text-foreground">Total: ${Number(scan?.total ?? 0).toLocaleString("es-CO")}</span>
              </div>
            </Card>

            <div className="flex items-center justify-between text-xs">
              <span>
                <span className="font-semibold">{totals.matched}/{totals.total}</span> matcheados · <span className="font-semibold">{totals.applied}</span> aplicados
              </span>
              <Button size="sm" disabled={busy || scan?.status === "applied" || !totals.matched} onClick={applyScan}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Aplicar al inventario
              </Button>
            </div>

            <div className="space-y-2">
              {items?.length ? items.map((it) => (
                <ItemRow key={it.id} item={it} orgId={orgId} onMatch={(pid) => updateMatch(it.id, pid)} />
              )) : <Skeleton className="h-20" />}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ItemRow({ item, orgId, onMatch }: { item: Item; orgId: string; onMatch: (pid: string | null) => void }) {
  const [query, setQuery] = useState("");
  const { data: matchedProduct } = useQuery({
    queryKey: ["product-name", item.matched_product_id],
    enabled: !!item.matched_product_id,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,name,sku").eq("id", item.matched_product_id).maybeSingle();
      return data;
    },
  });
  const { data: searchResults } = useQuery({
    queryKey: ["product-search", orgId, query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,sku")
        .eq("organization_id", orgId)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <Card className={`p-3 space-y-2 ${item.applied ? "bg-success/5 border-success/30" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">{item.description}</p>
          <p className="text-xs text-muted-foreground">
            {item.quantity} {item.unit ?? "u"} × ${Number(item.unit_cost).toLocaleString("es-CO")}
            {item.supplier_sku && ` · SKU ${item.supplier_sku}`}
            {item.gtin && ` · ${item.gtin}`}
          </p>
        </div>
        {item.applied ? (
          <Badge variant="default" className="bg-success"><CheckCircle2 className="w-3 h-3 mr-1" />Aplicado</Badge>
        ) : item.matched_product_id ? (
          <Badge variant="secondary"><Package className="w-3 h-3 mr-1" />Matcheado</Badge>
        ) : (
          <Badge variant="outline" className="text-warning border-warning"><AlertCircle className="w-3 h-3 mr-1" />Sin match</Badge>
        )}
      </div>

      {!item.applied && (
        <div className="space-y-1">
          {matchedProduct && (
            <div className="flex items-center justify-between bg-muted/50 px-2 py-1 rounded text-xs">
              <span>→ {matchedProduct.name} {matchedProduct.sku && `(${matchedProduct.sku})`}</span>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => onMatch(null)}>Cambiar</Button>
            </div>
          )}
          {!item.matched_product_id && (
            <>
              <Input
                placeholder="Buscar producto…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 text-xs"
              />
              {searchResults?.length ? (
                <div className="max-h-32 overflow-y-auto border rounded divide-y">
                  {searchResults.map((p: any) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => { onMatch(p.id); setQuery(""); }}
                    >
                      {p.name} {p.sku && <span className="text-muted-foreground">({p.sku})</span>}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
