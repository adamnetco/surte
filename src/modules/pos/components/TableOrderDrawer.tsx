import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, Minus, Trash2, Send, FileText, SplitSquareHorizontal, ArrowRightLeft, Ban } from "lucide-react";
import { toast } from "sonner";
import VoidItemDialog from "./VoidItemDialog";

interface Props {
  tableId: string;
  organizationId: string;
  userId: string;
  onClose: () => void;
}

interface TableOrder {
  id: string; location_id: string; status: string; subtotal: number; total: number;
  dining_table_id: string; guest_count: number;
  sub_label: string | null;
  parent_table_order_id: string | null;
}
interface Item {
  id: string; product_name: string; quantity: number; unit_price: number; total: number; status: string; notes: string | null;
}
interface Product { id: string; name: string; price: number; }

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function TableOrderDrawer({ tableId, organizationId, userId, onClose }: Props) {
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);
  const [defaultStation, setDefaultStation] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [voidItem, setVoidItem] = useState<Item | null>(null);

  const order = useMemo(
    () => orders.find((o) => o.id === activeOrderId) ?? null,
    [orders, activeOrderId]
  );

  const load = async () => {
    const { data: ords } = await supabase
      .from("table_orders")
      .select("id,location_id,status,subtotal,total,dining_table_id,guest_count,sub_label,parent_table_order_id,opened_at")
      .eq("organization_id", organizationId)
      .eq("dining_table_id", tableId)
      .in("status", ["open","sent","billed"])
      .order("sub_label", { ascending: true, nullsFirst: true })
      .order("opened_at", { ascending: true });

    const list = (ords as TableOrder[] | null) ?? [];
    setOrders(list);
    if (list.length === 0) {
      setActiveOrderId(null);
      setItems([]);
    } else {
      const stillThere = list.some((o) => o.id === activeOrderId);
      const next = stillThere ? activeOrderId! : list[0].id;
      setActiveOrderId(next);
      const [{ data: its }, { data: t }, { data: st }] = await Promise.all([
        supabase.from("table_order_items").select("id,product_name,quantity,unit_price,total,status,notes")
          .eq("organization_id", organizationId)
          .eq("table_order_id", next).order("created_at"),
        supabase.from("dining_tables").select("label").eq("organization_id", organizationId).eq("id", tableId).single(),
        supabase.from("kitchen_stations").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("sort_order"),
      ]);
      setItems((its as Item[]) ?? []);
      setTableLabel(t?.label ?? "");
      setStations(st ?? []);
      setDefaultStation((prev) => prev ?? st?.[0]?.id ?? null);
    }
  };

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.from("products").select("id,name,price")
        .eq("organization_id", organizationId)
        .eq("is_active", true).order("name").limit(120);
      setProducts((data as Product[]) ?? []);
    })();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(uniqueTopic(`table-${tableId}`))
        .on("postgres_changes", { event: "*", schema: "public", table: "table_order_items", filter: `organization_id=eq.${organizationId}` }, () => load())
        .on("postgres_changes", { event: "*", schema: "public", table: "table_orders", filter: `organization_id=eq.${organizationId}` }, () => load())
        .subscribe();
    } catch (err) {
      console.warn("[TableOrderDrawer] realtime subscribe failed", err);
    }
    return () => { safeRemoveChannel(ch); };
    // eslint-disable-next-line
  }, [tableId, organizationId, activeOrderId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const recalc = async (orderId: string) => {
    const { data } = await supabase.from("table_order_items").select("total")
      .eq("organization_id", organizationId).eq("table_order_id", orderId);
    const subtotal = (data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);
    await supabase.from("table_orders").update({ subtotal, total: subtotal })
      .eq("organization_id", organizationId).eq("id", orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, subtotal, total: subtotal } : o));
  };

  const addProduct = async (p: Product) => {
    if (!order) return;
    const { error } = await supabase.from("table_order_items").insert({
      organization_id: organizationId,
      table_order_id: order.id,
      product_id: p.id,
      product_name: p.name,
      kitchen_station_id: defaultStation,
      quantity: 1,
      unit_price: Number(p.price),
      total: Number(p.price),
      created_by: userId,
    });
    if (error) return toast.error(error.message);
    await recalc(order.id);
  };

  const changeQty = async (item: Item, delta: number) => {
    const q = Math.max(0, item.quantity + delta);
    if (q === 0) {
      await supabase.from("table_order_items").delete()
        .eq("organization_id", organizationId).eq("id", item.id);
    } else {
      await supabase.from("table_order_items").update({ quantity: q, total: q * item.unit_price })
        .eq("organization_id", organizationId).eq("id", item.id);
    }
    if (order) await recalc(order.id);
  };

  const transferItem = async (item: Item, destOrderId: string) => {
    const { error } = await (supabase.rpc as any)("transfer_table_item", { _item: item.id, _dest_order: destOrderId });
    if (error) return toast.error(error.message);
    if (order) await recalc(order.id);
    await recalc(destOrderId);
    toast.success(`Item movido a ${tableLabel}${orders.find(o => o.id === destOrderId)?.sub_label ?? ""}`);
  };

  const splitOrder = async () => {
    if (!order) return;
    setSplitting(true);
    const { data, error } = await (supabase.rpc as any)("split_table_order", { _source: order.id });
    setSplitting(false);
    if (error) return toast.error(error.message);
    toast.success("Nueva sub-cuenta creada");
    setActiveOrderId(data as string);
    await load();
  };

  const sendToKitchen = async () => {
    if (!order) return;
    const pendingItems = items.filter(i => i.status === "pending");
    if (pendingItems.length === 0) return toast.info("Nada nuevo que enviar");

    const { data, error } = await supabase.rpc("pos_dispatch_table_order", { p_order_id: order.id });
    if (error) return toast.error(error.message);
    const res = (data ?? {}) as { tickets?: number; print_jobs?: number };
    toast.success(`Comanda enviada · ${res.tickets ?? 0} estación(es) · ${res.print_jobs ?? 0} impresión(es)`);
    load();
  };

  const closeBill = async () => {
    if (!order) return;
    const remaining = orders.filter((o) => o.id !== order.id).length;
    const msg = remaining > 0
      ? `¿Cerrar esta sub-cuenta? Quedan ${remaining} sub-cuenta(s) abierta(s) en la mesa.`
      : "¿Cerrar y liberar mesa? (cobrar en POS)";
    if (!confirm(msg)) return;
    await supabase.from("table_orders").update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("organization_id", organizationId).eq("id", order.id);
    if (remaining === 0) {
      await supabase.from("dining_tables").update({ status: "available" })
        .eq("organization_id", organizationId).eq("id", tableId);
      toast.success("Mesa liberada");
      onClose();
    } else {
      toast.success("Sub-cuenta cerrada");
      await load();
    }
  };

  const otherOrders = orders.filter((o) => o.id !== activeOrderId);

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              Mesa {tableLabel}
              {order?.sub_label && (
                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {order.sub_label}
                </span>
              )}
            </span>
            {order && <span className="text-sm font-normal text-muted-foreground">#{order.status}</span>}
          </SheetTitle>
          {/* Sub-cuenta tabs */}
          {orders.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-2">
              {orders.map((o) => {
                const isActive = o.id === activeOrderId;
                return (
                  <button
                    key={o.id}
                    onClick={() => setActiveOrderId(o.id)}
                    className={`text-xs font-mono px-2.5 py-1 rounded-md border transition ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:border-primary/40"
                    }`}
                    title={`Sub-cuenta ${o.sub_label ?? "única"} · ${COP(o.total)}`}
                  >
                    {tableLabel}{o.sub_label ?? ""} · {COP(o.total)}
                  </button>
                );
              })}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={splitOrder}
                disabled={splitting || !order}
              >
                <SplitSquareHorizontal className="w-3.5 h-3.5 mr-1" />
                Dividir
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
          {/* Catálogo */}
          <div className="border-r flex flex-col min-h-0">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              {stations.length > 0 && (
                <div className="flex gap-1 mt-2 overflow-x-auto">
                  {stations.map(s => (
                    <button key={s.id} onClick={() => setDefaultStation(s.id)}
                      className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap border ${defaultStation === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2">
              {filtered.map(p => (
                <button key={p.id} onClick={() => addProduct(p)}
                  className="bg-card rounded-lg border p-2 text-left hover:border-primary active:scale-95">
                  <p className="text-xs font-medium line-clamp-2 min-h-[2rem]">{p.name}</p>
                  <p className="text-sm font-bold text-primary mt-1">{COP(Number(p.price))}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Comanda */}
          <div className="flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Sin productos</p>
              ) : items.map(it => (
                <div key={it.id} className="bg-muted/40 rounded-lg p-2 space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{it.product_name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${it.status === "pending" ? "bg-accent/30" : it.status === "ready" ? "bg-secondary/40" : "bg-primary/20"}`}>
                        {it.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {it.status === "pending" && otherOrders.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-muted-foreground hover:text-primary" title="Mover a otra sub-cuenta">
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {otherOrders.map((o) => (
                              <DropdownMenuItem key={o.id} onClick={() => transferItem(it, o.id)}>
                                Mover a {tableLabel}{o.sub_label ?? ""}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {it.status === "pending" && (
                        <button onClick={() => changeQty(it, -it.quantity)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => changeQty(it, -1)} disabled={it.status !== "pending"}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-xs">{it.quantity}</span>
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => changeQty(it, 1)} disabled={it.status !== "pending"}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-semibold">{COP(it.total)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-3 space-y-2">
              {order && (
                <div className="flex justify-between text-lg font-bold">
                  <span>Total {order.sub_label ? `(${order.sub_label})` : ""}</span>
                  <span className="text-primary">{COP(order.total)}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={sendToKitchen} className="h-11" style={{ background: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}>
                  <Send className="w-4 h-4 mr-1" /> Enviar
                </Button>
                <Button onClick={closeBill} variant="outline" className="h-11">
                  <FileText className="w-4 h-4 mr-1" /> Cobrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
