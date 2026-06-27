import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users, Truck, Phone, Mail, MapPin, Loader2, Tag, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import Customer360Sheet from "./Customer360Sheet";

type TabKind = "customers" | "suppliers";

const ContactsTab = () => {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKind>("customers");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open360, setOpen360] = useState(false);

  const { data: customers, isLoading: lc } = useQuery({
    queryKey: ["admin-customers", orgId],
    enabled: tab === "customers" && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,user_id,full_name,phone,city,business_name,customer_code,price_list_id,created_at")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: priceLists } = useQuery({
    queryKey: ["org-price-lists", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("id,name,is_default,is_active")
        .eq("organization_id", orgId!)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: suppliers, isLoading: ls } = useQuery({
    queryKey: ["admin-suppliers", orgId],
    enabled: tab === "suppliers" && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id,name,tax_id,contact_name,phone,email,city,is_active,created_at")
        .eq("organization_id", orgId!)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const list = tab === "customers" ? customers : suppliers;
  const isLoading = tab === "customers" ? lc : ls;

  const filtered = useMemo(() => {
    if (!list) return [];
    const needle = q.toLowerCase().trim();
    if (!needle) return list;
    return list.filter((it: any) =>
      [it.full_name, it.name, it.phone, it.email, it.city, it.tax_id, it.customer_code, it.business_name]
        .filter(Boolean).some((v: string) => v.toLowerCase().includes(needle))
    );
  }, [list, q]);

  const { data: history, isLoading: lh } = useQuery({
    queryKey: ["contact-history", tab, selectedId, orgId],
    enabled: !!selectedId && !!orgId,
    queryFn: async () => {
      if (tab === "customers") {
        const customer = (customers || []).find((c: any) => c.id === selectedId);
        if (!customer) return { kind: "orders", rows: [] as any[] };
        const phone = (customer.phone || "").replace(/\D/g, "");
        let query = supabase
          .from("orders")
          .select("id,order_number,total,status,created_at,customer_phone,user_id")
          .eq("organization_id", orgId!)
          .order("created_at", { ascending: false })
          .limit(50);
        if (customer.user_id) {
          query = query.eq("user_id", customer.user_id);
        } else if (phone) {
          query = query.ilike("customer_phone", `%${phone.slice(-7)}%`);
        }
        const { data, error } = await query;
        if (error) throw error;
        return { kind: "orders" as const, rows: data || [] };
      } else {
        const { data, error } = await supabase
          .from("purchase_orders")
          .select("id,po_code,total,status,created_at,received_at")
          .eq("organization_id", orgId!)
          .eq("supplier_id", selectedId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return { kind: "purchases" as const, rows: data || [] };
      }
    },
  });

  const selected = filtered.find((it: any) => it.id === selectedId);

  const handleAssignPriceList = async (profileId: string, value: string) => {
    const price_list_id = value === "__none__" ? null : value;
    const { error } = await supabase
      .from("profiles")
      .update({ price_list_id })
      .eq("id", profileId);
    if (error) {
      toast.error("No se pudo asignar la lista de precios");
      return;
    }
    toast.success("Lista de precios actualizada");
    qc.invalidateQueries({ queryKey: ["admin-customers", orgId] });
  };

  if (!currentOrg) {
    return <div className="p-4 text-sm text-muted-foreground">Selecciona una organización para ver contactos.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> CRM y Contactos
          </h2>
          <p className="text-sm text-muted-foreground">Clientes y proveedores con historial unificado.</p>
        </div>
        <div className="flex border border-border rounded-lg overflow-hidden text-sm">
          <button
            onClick={() => { setTab("customers"); setSelectedId(null); }}
            className={`px-3 py-1.5 flex items-center gap-1 ${tab === "customers" ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            <Users className="h-3.5 w-3.5" /> Clientes
          </button>
          <button
            onClick={() => { setTab("suppliers"); setSelectedId(null); }}
            className={`px-3 py-1.5 flex items-center gap-1 ${tab === "suppliers" ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            <Truck className="h-3.5 w-3.5" /> Proveedores
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder={`Buscar ${tab === "customers" ? "clientes" : "proveedores"}...`} value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin resultados.</p>
          ) : (
            filtered.map((it: any) => {
              const isSel = selectedId === it.id;
              const name = it.full_name || it.name || "Sin nombre";
              const plName = tab === "customers"
                ? (priceLists || []).find((p: any) => p.id === it.price_list_id)?.name
                : null;
              const sub = tab === "customers"
                ? [it.customer_code, plName, it.city].filter(Boolean).join(" · ")
                : [it.tax_id, it.city, it.contact_name].filter(Boolean).join(" · ");
              return (
                <button
                  key={it.id}
                  onClick={() => setSelectedId(it.id)}
                  className={`w-full text-left p-2 rounded-lg border ${isSel ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                >
                  <div className="font-medium text-sm truncate">{name}</div>
                  <div className="text-xs text-muted-foreground truncate">{sub || "—"}</div>
                  {it.phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{it.phone}</div>}
                </button>
              );
            })
          )}
        </div>

        <div className="border border-border rounded-lg p-3 bg-card min-h-[300px]">
          {!selected ? (
            <p className="text-sm text-muted-foreground text-center py-12">Selecciona un contacto para ver su historial.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{(selected as any).full_name || (selected as any).name}</h3>
                  <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                    {(selected as any).phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{(selected as any).phone}</div>}
                    {(selected as any).email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{(selected as any).email}</div>}
                    {(selected as any).city && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{(selected as any).city}</div>}
                  </div>
                </div>
                {tab === "customers" && (
                  <Button size="sm" variant="outline" onClick={() => setOpen360(true)} className="gap-1 shrink-0">
                    <BarChart3 className="h-3.5 w-3.5" /> Ficha 360°
                  </Button>
                )}
              </div>

              {tab === "customers" && (
                <div className="border-t border-border pt-3">
                  <label className="text-xs font-medium flex items-center gap-1 mb-1">
                    <Tag className="h-3 w-3" /> Lista de precios
                  </label>
                  <select
                    value={(selected as any).price_list_id || "__none__"}
                    onChange={(e) => handleAssignPriceList((selected as any).id, e.target.value)}
                    className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background"
                  >
                    <option value="__none__">— Usar lista por defecto de la organización —</option>
                    {(priceLists || []).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.is_default ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                  {(!priceLists || priceLists.length === 0) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Aún no hay listas de precios. Créalas en Catálogo → Listas de precios.
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-border pt-3">
                <h4 className="text-sm font-medium mb-2">
                  {tab === "customers" ? "Historial de pedidos" : "Órdenes de compra"}
                </h4>
                {lh ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                ) : !history?.rows?.length ? (
                  <p className="text-xs text-muted-foreground">Sin movimientos.</p>
                ) : (
                  <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                    {history.rows.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between text-xs border border-border rounded p-2">
                        <div>
                          <div className="font-medium">{r.order_number || r.po_code || r.id.slice(0, 8)}</div>
                          <div className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${Number(r.total || 0).toLocaleString("es-CO")}</div>
                          <div className="text-muted-foreground">{r.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactsTab;
