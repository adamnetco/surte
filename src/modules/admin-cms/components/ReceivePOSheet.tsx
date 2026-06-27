import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, CameraOff, Plus, Minus, Search, PackageCheck, Scale } from "lucide-react";
import { toast } from "sonner";

interface POItem {
  id: string;
  product_id: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  supplier_sku: string | null;
  description: string | null;
  applied: boolean;
  products?: { name: string; sku: string | null; gtin: string | null; image_url: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string | null;
  orgId: string;
  warehouseId?: string;
  onReceived?: () => void;
}

// BarcodeDetector type (native Chrome / Android)
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

export default function ReceivePOSheet({ open, onOpenChange, poId, orgId, warehouseId, onReceived }: Props) {
  const qc = useQueryClient();
  const [received, setReceived] = useState<Record<string, number>>({});
  const [adjustTo, setAdjustTo] = useState<Record<string, string>>({});
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const scanLoopRef = useRef<number | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["po-items", poId],
    queryFn: async () => {
      if (!poId) return [];
      const { data: rows, error } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("organization_id", orgId)
        .eq("purchase_order_id", poId)
        .order("description");
      if (error) throw error;
      const productIds = (rows ?? []).map((r: any) => r.product_id).filter(Boolean);
      let prodMap: Record<string, any> = {};
      if (productIds.length) {
        const { data: prods } = await supabase
          .from("products")
          .select("id,name,sku,gtin,image_url")
          .in("id", productIds);
        (prods ?? []).forEach((p: any) => { prodMap[p.id] = p; });
      }
      return (rows ?? []).map((r: any) => ({ ...r, products: r.product_id ? prodMap[r.product_id] ?? null : null })) as POItem[];
    },
    enabled: !!poId && open,
  });

  // Stock actual por producto en la bodega de recepción (para pre-ajuste)
  const productIds = (items ?? []).map((i) => i.product_id).filter(Boolean) as string[];
  const { data: stockMap } = useQuery({
    queryKey: ["po-stock", warehouseId, productIds.sort().join(",")],
    queryFn: async () => {
      if (!warehouseId || !productIds.length) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from("product_stock")
        .select("product_id, quantity")
        .eq("organization_id", orgId)
        .eq("warehouse_id", warehouseId)
        .in("product_id", productIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        map[r.product_id] = (map[r.product_id] ?? 0) + Number(r.quantity ?? 0);
      });
      return map;
    },
    enabled: !!warehouseId && productIds.length > 0 && open,
  });

  const applyPreAdjust = async (it: POItem) => {
    if (!it.product_id || !warehouseId) return;
    const target = Number(adjustTo[it.id]);
    if (Number.isNaN(target) || target < 0) {
      toast.error("Cantidad real inválida");
      return;
    }
    const current = stockMap?.[it.product_id] ?? 0;
    const diff = target - current;
    if (diff === 0) {
      toast.info("El stock ya coincide");
      return;
    }
    setAdjustingId(it.id);
    try {
      const { error } = await supabase.rpc("apply_stock_movement", {
        _org_id: orgId,
        _warehouse_id: warehouseId,
        _product_id: it.product_id,
        _presentation_id: null,
        _movement_type: diff > 0 ? "adjustment" : "out",
        _quantity: Math.abs(diff),
        _unit_cost: 0,
        _reference_type: "pre_receive_adjustment",
        _reference_id: poId,
        _notes: `Ajuste previo a recepción OC. Conteo físico: ${target} (antes ${current})`,
      });
      if (error) throw error;
      toast.success(`Stock ajustado a ${target}`);
      setAdjustTo((p) => ({ ...p, [it.id]: "" }));
      qc.invalidateQueries({ queryKey: ["po-stock", warehouseId] });
    } catch (e: any) {
      toast.error(e.message ?? "Error al ajustar");
    } finally {
      setAdjustingId(null);
    }
  };

  // Reset state on open change
  useEffect(() => {
    if (!open) {
      stopScanner();
      setReceived({});
      setSearch("");
    }
  }, [open]);

  const stopScanner = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const startScanner = async () => {
    if (!("BarcodeDetector" in window)) {
      toast.error("Tu navegador no soporta escaneo nativo. Usa la búsqueda manual.");
      return;
    }
    try {
      detectorRef.current = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      scanLoop();
    } catch (e: any) {
      toast.error("No se pudo acceder a la cámara: " + (e.message ?? "permiso denegado"));
    }
  };

  const scanLoop = async () => {
    if (!videoRef.current || !detectorRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes && codes.length) {
        handleScannedCode(codes[0].rawValue);
      }
    } catch {
      // ignore
    }
    scanLoopRef.current = requestAnimationFrame(scanLoop);
  };

  const handleScannedCode = (code: string) => {
    if (!items) return;
    // Match by GTIN, SKU, or supplier_sku
    const match = items.find(
      (it) =>
        it.products?.gtin === code ||
        it.products?.sku === code ||
        it.supplier_sku === code,
    );
    if (match) {
      incrementItem(match.id, 1);
      // Feedback haptic
      if (navigator.vibrate) navigator.vibrate(50);
      toast.success(`+1 ${match.products?.name ?? "item"}`);
    } else {
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      toast.error(`Código ${code} no está en esta OC`);
    }
  };

  const incrementItem = (itemId: string, delta: number) => {
    setReceived((prev) => {
      const item = items?.find((i) => i.id === itemId);
      if (!item) return prev;
      const remaining = item.quantity_ordered - (item.quantity_received ?? 0);
      const current = prev[itemId] ?? 0;
      const next = Math.max(0, Math.min(remaining, current + delta));
      return { ...prev, [itemId]: next };
    });
  };

  const setItemQty = (itemId: string, qty: number) => {
    setReceived((prev) => {
      const item = items?.find((i) => i.id === itemId);
      if (!item) return prev;
      const remaining = item.quantity_ordered - (item.quantity_received ?? 0);
      return { ...prev, [itemId]: Math.max(0, Math.min(remaining, qty)) };
    });
  };

  const filteredItems = (items ?? []).filter((it) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      it.products?.name?.toLowerCase().includes(q) ||
      it.products?.sku?.toLowerCase().includes(q) ||
      it.supplier_sku?.toLowerCase().includes(q) ||
      it.description?.toLowerCase().includes(q)
    );
  });

  const totalSelected = Object.values(received).reduce((a, b) => a + b, 0);

  const submit = async () => {
    if (!poId || !warehouseId) return toast.error("Bodega no definida");
    const lines = Object.entries(received)
      .filter(([_, qty]) => qty > 0)
      .map(([item_id, qty]) => ({ item_id, qty }));
    if (!lines.length) return toast.error("Marca al menos una cantidad recibida");

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("receive_purchase_order_partial", {
        _po_id: poId,
        _warehouse_id: warehouseId,
        _lines: lines,
      });
      if (error) throw error;
      const res = data as any;
      toast.success(
        res?.pending_lines > 0
          ? `Recibido parcialmente. Quedan ${res.pending_lines} líneas pendientes.`
          : `OC recibida completamente (${res?.applied_lines} líneas)`,
      );
      qc.invalidateQueries({ queryKey: ["purchase-orders", orgId] });
      qc.invalidateQueries({ queryKey: ["po-items", poId] });
      onReceived?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Error al recibir");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-background border-b">
          <SheetHeader className="p-4">
            <SheetTitle className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-primary" />
              Recepción de mercancía
            </SheetTitle>
          </SheetHeader>

          {scanning && (
            <div className="relative bg-black aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-x-12 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 shadow-[0_0_10px_rgba(255,0,0,0.8)]" />
              <Button
                size="sm"
                variant="destructive"
                onClick={stopScanner}
                className="absolute top-2 right-2"
              >
                <CameraOff className="w-4 h-4 mr-1" />Detener
              </Button>
            </div>
          )}

          <div className="p-4 flex gap-2">
            {!scanning ? (
              <Button onClick={startScanner} variant="default" className="flex-1">
                <Camera className="w-4 h-4 mr-1" />Escanear
              </Button>
            ) : null}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {isLoading && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}

          {!isLoading && !filteredItems.length && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              {items?.length ? "Sin resultados" : "Esta OC no tiene líneas con producto."}
            </Card>
          )}

          {filteredItems.map((it) => {
            const remaining = it.quantity_ordered - (it.quantity_received ?? 0);
            const fullyReceived = it.applied || remaining <= 0;
            const qty = received[it.id] ?? 0;
            return (
              <Card key={it.id} className={`p-3 ${fullyReceived ? "opacity-50" : ""}`}>
                <div className="flex items-start gap-2">
                  {it.products?.image_url && (
                    <img src={it.products.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {it.products?.name ?? it.description ?? "(producto)"}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                      {it.supplier_sku && <span>SKU prov: {it.supplier_sku}</span>}
                      {it.products?.gtin && <span>GTIN: {it.products.gtin}</span>}
                    </div>
                    <div className="text-xs mt-1">
                      Pedido: <strong>{it.quantity_ordered}</strong> · Recibido prev:{" "}
                      <strong>{it.quantity_received ?? 0}</strong> · Pendiente:{" "}
                      <Badge variant={remaining > 0 ? "default" : "secondary"} className="text-[10px]">
                        {remaining}
                      </Badge>
                    </div>
                  </div>
                </div>

                {it.product_id && warehouseId && (
                  <div className="mt-2 rounded-md border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                        <Scale className="w-3 h-3" /> Stock actual en bodega
                      </span>
                      <strong className="text-amber-900 dark:text-amber-200">
                        {stockMap?.[it.product_id] ?? 0}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="Conteo real ahora…"
                        value={adjustTo[it.id] ?? ""}
                        onChange={(e) => setAdjustTo((p) => ({ ...p, [it.id]: e.target.value }))}
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs whitespace-nowrap"
                        disabled={adjustingId === it.id || !adjustTo[it.id]}
                        onClick={() => applyPreAdjust(it)}
                      >
                        {adjustingId === it.id ? "…" : "Ajustar"}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Corrige merma/faltantes antes de sumar la factura.
                    </p>
                  </div>
                )}

                {!fullyReceived && (
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="icon" variant="outline" onClick={() => incrementItem(it.id, -1)} className="h-9 w-9">
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      value={qty}
                      onChange={(e) => setItemQty(it.id, +e.target.value || 0)}
                      className="h-9 text-center font-semibold"
                    />
                    <Button size="icon" variant="outline" onClick={() => incrementItem(it.id, 1)} className="h-9 w-9">
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setItemQty(it.id, remaining)}
                      className="text-xs"
                    >
                      Todo ({remaining})
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-background border-t p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Unidades a recibir</span>
            <strong>{totalSelected}</strong>
          </div>
          <Button onClick={submit} disabled={submitting || totalSelected === 0} className="w-full" size="lg">
            <PackageCheck className="w-5 h-5 mr-2" />
            {submitting ? "Procesando…" : "Confirmar recepción"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
