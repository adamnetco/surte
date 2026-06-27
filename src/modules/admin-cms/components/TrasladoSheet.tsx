import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRightLeft, Search, Loader2, Plus, Minus, Trash2, PackageCheck, Truck, X, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";

type Warehouse = { id: string; name: string; is_default: boolean };
type StockRow = {
  product_id: string;
  presentation_id: string | null;
  quantity: number;
  avg_cost: number;
  product?: { name: string; sku: string | null; image_url: string | null };
};
type Line = {
  product_id: string;
  presentation_id: string | null;
  name: string;
  sku: string | null;
  available: number;
  qty: number;
};
type PendingTransfer = {
  id: string;
  transfer_number: number;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  sent_at: string | null;
  requested_at: string | null;
  notes: string | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  orgId: string;
  fromWarehouseId: string;
  fromWarehouseName?: string;
  warehouses: Warehouse[];
  onApplied?: () => void;
}

type Tab = "crear" | "aprobar" | "recibir";
type SendMode = "direct" | "request";

export default function TrasladoSheet({
  open, onClose, orgId, fromWarehouseId, fromWarehouseName, warehouses, onApplied,
}: Props) {
  const [tab, setTab] = useState<Tab>("crear");
  const [sendMode, setSendMode] = useState<SendMode>("direct");
  const [toWarehouseId, setToWarehouseId] = useState<string>("");
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingTransfer[]>([]);
  const [requested, setRequested] = useState<PendingTransfer[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const destinations = useMemo(
    () => warehouses.filter((w) => w.id !== fromWarehouseId),
    [warehouses, fromWarehouseId],
  );

  useEffect(() => {
    if (!open) return;
    setLines([]); setNotes(""); setSearch("");
    setToWarehouseId(destinations[0]?.id ?? "");
  }, [open, fromWarehouseId]);

  useEffect(() => {
    if (!open || tab !== "crear" || !fromWarehouseId) return;
    (async () => {
      setLoadingStock(true);
      const { data: stk } = await supabase
        .from("product_stock")
        .select("product_id, presentation_id, quantity, avg_cost")
        .eq("organization_id", orgId)
        .eq("warehouse_id", fromWarehouseId)
        .gt("quantity", 0);
      const ids = [...new Set((stk ?? []).map((s: any) => s.product_id))];
      let map: Record<string, any> = {};
      if (ids.length) {
        const { data: pdata } = await supabase
          .from("products").select("id, name, sku, image_url").in("id", ids);
        map = Object.fromEntries((pdata ?? []).map((p: any) => [p.id, p]));
      }
      setStock((stk ?? []).map((s: any) => ({ ...s, product: map[s.product_id] })));
      setLoadingStock(false);
    })();
  }, [open, tab, fromWarehouseId, orgId]);

  useEffect(() => {
    if (!open) return;
    if (tab !== "recibir" && tab !== "aprobar") return;
    (async () => {
      setLoadingPending(true);
      if (tab === "recibir") {
        const { data } = await supabase
          .from("stock_transfers")
          .select("id, transfer_number, from_warehouse_id, to_warehouse_id, status, sent_at, requested_at, notes")
          .eq("organization_id", orgId)
          .eq("status", "in_transit")
          .order("sent_at", { ascending: false })
          .limit(50);
        setPending((data ?? []) as PendingTransfer[]);
      } else {
        const { data } = await supabase
          .from("stock_transfers")
          .select("id, transfer_number, from_warehouse_id, to_warehouse_id, status, sent_at, requested_at, notes")
          .eq("organization_id", orgId)
          .eq("status", "requested")
          .order("requested_at", { ascending: false })
          .limit(50);
        setRequested((data ?? []) as PendingTransfer[]);
      }
      setLoadingPending(false);
    })();
  }, [open, tab, orgId]);

  const filteredStock = useMemo(() => {
    const q = search.toLowerCase().trim();
    const taken = new Set(lines.map((l) => `${l.product_id}|${l.presentation_id ?? ""}`));
    return stock
      .filter((s) => !taken.has(`${s.product_id}|${s.presentation_id ?? ""}`))
      .filter((s) =>
        !q || s.product?.name?.toLowerCase().includes(q) || s.product?.sku?.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [stock, search, lines]);

  const addLine = (s: StockRow) => {
    setLines((prev) => [
      ...prev,
      {
        product_id: s.product_id,
        presentation_id: s.presentation_id,
        name: s.product?.name ?? "Producto",
        sku: s.product?.sku ?? null,
        available: Number(s.quantity),
        qty: 1,
      },
    ]);
    setSearch("");
  };

  const setQty = (idx: number, val: number) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, qty: Math.max(0, Math.min(val, l.available)) } : l)),
    );
  };

  const removeLine = (idx: number) =>
    setLines((prev) => prev.filter((_, i) => i !== idx));

  const validLines = lines.filter((l) => l.qty > 0);

  const submit = async () => {
    if (!toWarehouseId) { toast.error("Selecciona bodega destino"); return; }
    if (!validLines.length) { toast.error("Agrega al menos un producto"); return; }
    setSubmitting(true);

    const isRequest = sendMode === "request";
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: tr, error: trErr } = await supabase
        .from("stock_transfers")
        .insert({
          organization_id: orgId,
          from_warehouse_id: fromWarehouseId,
          to_warehouse_id: toWarehouseId,
          status: isRequest ? "requested" : "in_transit",
          notes: notes || null,
          sent_at: isRequest ? null : new Date().toISOString(),
          requested_at: isRequest ? new Date().toISOString() : null,
          requested_by: isRequest ? user?.id ?? null : null,
        })
        .select("id, transfer_number")
        .single();
      if (trErr || !tr) throw trErr;

      const itemsPayload = validLines.map((l) => ({
        transfer_id: tr.id,
        organization_id: orgId,
        product_id: l.product_id,
        presentation_id: l.presentation_id,
        quantity_sent: l.qty,
      }));
      const { error: itErr } = await supabase.from("stock_transfer_items").insert(itemsPayload);
      if (itErr) throw itErr;

      if (!isRequest) {
        let fail = 0;
        for (const l of validLines) {
          const { error } = await supabase.rpc("apply_stock_movement", {
            _org_id: orgId,
            _warehouse_id: fromWarehouseId,
            _product_id: l.product_id,
            _presentation_id: l.presentation_id,
            _movement_type: "out",
            _quantity: l.qty,
            _unit_cost: 0,
            _reference_type: "transfer_out",
            _reference_id: tr.id,
            _notes: `Traslado #${tr.transfer_number} → bodega destino`,
          });
          if (error) fail++;
        }
        if (fail > 0) toast.warning(`Traslado #${tr.transfer_number} creado, ${fail} salida(s) fallaron`);
        else toast.success(`Traslado #${tr.transfer_number} enviado`);
      } else {
        toast.success(`Solicitud #${tr.transfer_number} creada · pendiente de aprobación`);
      }

      setLines([]); setNotes("");
      onApplied?.();
      setTab(isRequest ? "aprobar" : "recibir");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el traslado");
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async (t: PendingTransfer) => {
    setSubmitting(true);
    try {
      const { data: items, error: iErr } = await supabase
        .from("stock_transfer_items")
        .select("id, product_id, presentation_id, quantity_sent")
        .eq("transfer_id", t.id);
      if (iErr) throw iErr;

      let fail = 0;
      for (const it of items ?? []) {
        const { error } = await supabase.rpc("apply_stock_movement", {
          _org_id: orgId,
          _warehouse_id: t.from_warehouse_id,
          _product_id: it.product_id,
          _presentation_id: it.presentation_id,
          _movement_type: "out",
          _quantity: Number(it.quantity_sent),
          _unit_cost: 0,
          _reference_type: "transfer_out",
          _reference_id: t.id,
          _notes: `Traslado #${t.transfer_number} aprobado · salida origen`,
        });
        if (error) fail++;
      }

      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("stock_transfers")
        .update({
          status: "in_transit",
          sent_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: user?.id ?? null,
        })
        .eq("id", t.id);

      if (fail === 0) toast.success(`Traslado #${t.transfer_number} aprobado y en tránsito`);
      else toast.warning(`Aprobado con ${fail} error(es) de stock`);

      setRequested((prev) => prev.filter((p) => p.id !== t.id));
      onApplied?.();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo aprobar");
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async (t: PendingTransfer) => {
    const reason = window.prompt(`Motivo del rechazo de #${t.transfer_number}:`, "");
    if (reason === null) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("stock_transfers")
        .update({
          status: "rejected",
          rejected_reason: reason || "Sin motivo",
          approved_by: user?.id ?? null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", t.id);
      toast.success(`Traslado #${t.transfer_number} rechazado`);
      setRequested((prev) => prev.filter((p) => p.id !== t.id));
      onApplied?.();
    } finally {
      setSubmitting(false);
    }
  };

  const receive = async (t: PendingTransfer) => {
    setSubmitting(true);
    try {
      const { data: items, error: iErr } = await supabase
        .from("stock_transfer_items")
        .select("id, product_id, presentation_id, quantity_sent")
        .eq("transfer_id", t.id);
      if (iErr) throw iErr;

      let fail = 0;
      for (const it of items ?? []) {
        const { error } = await supabase.rpc("apply_stock_movement", {
          _org_id: orgId,
          _warehouse_id: t.to_warehouse_id,
          _product_id: it.product_id,
          _presentation_id: it.presentation_id,
          _movement_type: "in",
          _quantity: Number(it.quantity_sent),
          _unit_cost: 0,
          _reference_type: "transfer_in",
          _reference_id: t.id,
          _notes: `Recepción traslado #${t.transfer_number}`,
        });
        if (error) fail++;
        else {
          await supabase
            .from("stock_transfer_items")
            .update({ quantity_received: it.quantity_sent })
            .eq("id", it.id);
        }
      }

      await supabase
        .from("stock_transfers")
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("id", t.id);

      if (fail === 0) toast.success(`Traslado #${t.transfer_number} recibido`);
      else toast.warning(`Recibido con ${fail} error(es)`);

      setPending((prev) => prev.filter((p) => p.id !== t.id));
      onApplied?.();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo recibir");
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (t: PendingTransfer) => {
    if (!window.confirm(`¿Cancelar traslado #${t.transfer_number} y devolver el stock al origen?`)) return;
    setSubmitting(true);
    try {
      const { data: items } = await supabase
        .from("stock_transfer_items")
        .select("product_id, presentation_id, quantity_sent")
        .eq("transfer_id", t.id);
      for (const it of items ?? []) {
        await supabase.rpc("apply_stock_movement", {
          _org_id: orgId,
          _warehouse_id: t.from_warehouse_id,
          _product_id: it.product_id,
          _presentation_id: it.presentation_id,
          _movement_type: "in",
          _quantity: Number(it.quantity_sent),
          _unit_cost: 0,
          _reference_type: "transfer_cancel",
          _reference_id: t.id,
          _notes: `Cancelación traslado #${t.transfer_number}`,
        });
      }
      await supabase
        .from("stock_transfers")
        .update({ status: "cancelled" })
        .eq("id", t.id);
      toast.success(`Traslado #${t.transfer_number} cancelado`);
      setPending((prev) => prev.filter((p) => p.id !== t.id));
      onApplied?.();
    } finally {
      setSubmitting(false);
    }
  };

  const warehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "—";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border bg-card">
          <SheetTitle className="flex items-center gap-2 text-base font-heading">
            <ArrowRightLeft size={18} className="text-primary" />
            Traslados entre bodegas
          </SheetTitle>
          <SheetDescription className="text-xs">
            Mueve stock entre {fromWarehouseName ?? "bodega origen"} y otras bodegas activas.
          </SheetDescription>
          <div className="flex gap-1.5 pt-2">
            {([
              { k: "crear", label: "Crear" },
              { k: "aprobar", label: `Aprobar (${requested.length || "·"})` },
              { k: "recibir", label: `Recibir (${pending.length || "·"})` },
            ] as { k: Tab; label: string }[]).map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition ${
                  tab === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </SheetHeader>

        {tab === "crear" && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b border-border bg-card space-y-2">
              <div className="flex gap-1.5">
                {([
                  { v: "direct" as const, label: "Envío directo", icon: Truck },
                  { v: "request" as const, label: "Solicitar aprobación", icon: ShieldCheck },
                ]).map(({ v, label, icon: Icon }) => (
                  <button
                    key={v}
                    onClick={() => setSendMode(v)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                      sendMode === v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Bodega destino</label>
                <select
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-background border border-border text-sm"
                >
                  {destinations.length === 0 && <option value="">— Sin bodegas destino —</option>}
                  {destinations.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}{w.is_default ? " ⭐" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto en bodega origen..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-background border border-border text-sm"
                />
              </div>
              {search && (
                <div className="max-h-60 overflow-y-auto rounded-xl border border-border bg-background">
                  {loadingStock && <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 size={12} className="animate-spin"/>Cargando…</div>}
                  {!loadingStock && filteredStock.length === 0 && (
                    <div className="p-3 text-xs text-muted-foreground">Sin coincidencias con stock disponible.</div>
                  )}
                  {filteredStock.map((s) => (
                    <button
                      key={`${s.product_id}-${s.presentation_id ?? "base"}`}
                      onClick={() => addLine(s)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 text-left border-b border-border last:border-b-0"
                    >
                      <img src={s.product?.image_url || "/placeholder.svg"} alt="" className="w-9 h-9 rounded-md object-cover bg-muted" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.product?.name}</p>
                        <p className="text-[11px] text-muted-foreground">SKU {s.product?.sku ?? "—"} · {Number(s.quantity)} disp.</p>
                      </div>
                      <Plus size={14} className="text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {lines.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Busca productos arriba para armar el traslado.
                </div>
              )}
              {lines.map((l, idx) => (
                <div key={`${l.product_id}-${l.presentation_id ?? "base"}`} className="bg-card rounded-xl p-3 border border-border flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{l.name}</p>
                    <p className="text-[11px] text-muted-foreground">SKU {l.sku ?? "—"} · Disp. {l.available}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setQty(idx, l.qty - 1)} className="p-1.5 rounded-lg bg-muted"><Minus size={12} /></button>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={l.qty}
                      onChange={(e) => setQty(idx, Number(e.target.value))}
                      className="w-14 text-center px-1 py-1 rounded-lg bg-background border border-border text-sm"
                    />
                    <button onClick={() => setQty(idx, l.qty + 1)} className="p-1.5 rounded-lg bg-muted"><Plus size={12} /></button>
                  </div>
                  <button onClick={() => removeLine(idx)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-border bg-card space-y-2">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas (opcional)"
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{validLines.length} producto(s) · {validLines.reduce((a, l) => a + l.qty, 0)} unidades</span>
              </div>
              <button
                onClick={submit}
                disabled={submitting || !validLines.length || !toWarehouseId}
                className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : sendMode === "request" ? <ShieldCheck size={14} /> : <Truck size={14} />}
                {sendMode === "request" ? "Crear solicitud" : "Enviar traslado"}
              </button>
            </div>
          </div>
        )}

        {tab === "aprobar" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingPending && (
              <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 size={12} className="animate-spin"/>Cargando solicitudes…</div>
            )}
            {!loadingPending && requested.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Sin solicitudes pendientes de aprobación.
              </div>
            )}
            {requested.map((t) => (
              <div key={t.id} className="bg-card rounded-xl p-3 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Solicitud #{t.transfer_number}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 font-semibold flex items-center gap-1">
                    <Clock size={10} /> PENDIENTE
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {warehouseName(t.from_warehouse_id)} → <strong>{warehouseName(t.to_warehouse_id)}</strong>
                </p>
                {t.notes && <p className="text-[11px] italic text-muted-foreground">"{t.notes}"</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => approve(t)}
                    disabled={submitting}
                    className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <ShieldCheck size={13} /> Aprobar
                  </button>
                  <button
                    onClick={() => reject(t)}
                    disabled={submitting}
                    className="px-3 rounded-lg border border-border text-xs font-semibold text-destructive flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <X size={13} /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "recibir" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingPending && (
              <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 size={12} className="animate-spin"/>Cargando pendientes…</div>
            )}
            {!loadingPending && pending.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Sin traslados en tránsito.
              </div>
            )}
            {pending.map((t) => (
              <div key={t.id} className="bg-card rounded-xl p-3 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Traslado #{t.transfer_number}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-semibold">EN TRÁNSITO</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {warehouseName(t.from_warehouse_id)} → <strong>{warehouseName(t.to_warehouse_id)}</strong>
                </p>
                {t.notes && <p className="text-[11px] italic text-muted-foreground">"{t.notes}"</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => receive(t)}
                    disabled={submitting}
                    className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <PackageCheck size={13} /> Recibir
                  </button>
                  <button
                    onClick={() => cancel(t)}
                    disabled={submitting}
                    className="px-3 rounded-lg border border-border text-xs font-semibold text-destructive flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <X size={13} /> Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
