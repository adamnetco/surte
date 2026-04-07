import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Ticket, Loader2, Copy } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const CouponsTab = ({ queryClient }: { queryClient: any }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "", discount_type: "percentage", discount_value: "", min_order_amount: "",
    max_uses: "", is_active: true, expires_at: "",
  });

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setForm({ code: "", discount_type: "percentage", discount_value: "", min_order_amount: "", max_uses: "", is_active: true, expires_at: "" });
    setEditing(null);
  };

  const editCoupon = (c: any) => {
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      min_order_amount: c.min_order_amount ? String(c.min_order_amount) : "",
      max_uses: c.max_uses ? String(c.max_uses) : "",
      is_active: c.is_active,
      expires_at: c.expires_at ? c.expires_at.split("T")[0] : "",
    });
    setEditing(c.id);
  };

  const saveCoupon = async () => {
    if (!form.code.trim() || !form.discount_value) {
      toast.error("Código y valor de descuento son obligatorios");
      return;
    }
    try {
      const payload = {
        code: form.code.toUpperCase().trim(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : 0,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        is_active: form.is_active,
        expires_at: form.expires_at ? new Date(form.expires_at + "T23:59:59").toISOString() : null,
      };
      if (editing && editing !== "new") {
        const { error } = await supabase.from("coupons").update(payload).eq("id", editing);
        if (error) throw error;
        toast.success("Cupón actualizado");
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
        toast.success("Cupón creado");
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("¿Eliminar este cupón?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cupón eliminado");
    queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-base text-foreground">Cupones de Descuento</h2>
          <p className="text-xs text-muted-foreground">Gestiona códigos promocionales</p>
        </div>
        <button onClick={() => { resetForm(); setEditing("new"); }} className="flex items-center gap-1 bg-accent text-accent-foreground px-3 py-2 rounded-xl text-xs font-semibold">
          <Plus size={14} /> Crear Cupón
        </button>
      </div>

      {/* Form */}
      {editing && (
        <div className="bg-card border border-accent/30 rounded-xl p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Código *</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SURTE20"
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm uppercase font-mono outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Tipo</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto Fijo ($)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">
                Valor * {form.discount_type === "percentage" ? "(%)" : "(COP)"}
              </label>
              <input
                type="number"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                placeholder={form.discount_type === "percentage" ? "20" : "10000"}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Pedido Mínimo (COP)</label>
              <input
                type="number"
                value={form.min_order_amount}
                onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                placeholder="50000"
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Máx. Usos</label>
              <input
                type="number"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder="Ilimitado"
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Expira</label>
              <input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <span className="text-xs text-muted-foreground">Activo</span>
          </div>
          <div className="flex gap-2">
            <button onClick={resetForm} className="flex-1 bg-muted rounded-xl py-2 text-sm text-muted-foreground font-medium flex items-center justify-center gap-1">
              <X size={14} /> Cancelar
            </button>
            <button onClick={saveCoupon} className="flex-1 bg-accent text-accent-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1">
              <Save size={14} /> Guardar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {coupons?.map((c: any) => {
          const expired = c.expires_at && new Date(c.expires_at) < new Date();
          const exhausted = c.max_uses && c.current_uses >= c.max_uses;
          return (
            <div key={c.id} className={`bg-card border rounded-xl p-3 ${!c.is_active || expired || exhausted ? "border-border opacity-60" : "border-secondary/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Ticket size={14} className="text-accent" />
                <span className="font-mono font-bold text-sm text-foreground">{c.code}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Código copiado"); }}
                  className="ml-auto"
                >
                  <Copy size={12} className="text-muted-foreground" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span className="bg-muted px-1.5 py-0.5 rounded">
                  {c.discount_type === "percentage" ? `${c.discount_value}%` : formatPrice(c.discount_value)}
                </span>
                {c.min_order_amount > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">Min: {formatPrice(c.min_order_amount)}</span>}
                <span className="bg-muted px-1.5 py-0.5 rounded">Usos: {c.current_uses}{c.max_uses ? `/${c.max_uses}` : ""}</span>
                {expired && <span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Expirado</span>}
                {exhausted && <span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Agotado</span>}
              </div>
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => editCoupon(c)} className="flex items-center gap-1 text-[11px] text-accent hover:underline">
                  <Pencil size={11} /> Editar
                </button>
                <button onClick={() => deleteCoupon(c.id)} className="flex items-center gap-1 text-[11px] text-destructive hover:underline">
                  <Trash2 size={11} /> Eliminar
                </button>
              </div>
            </div>
          );
        })}
        {!isLoading && (!coupons || coupons.length === 0) && !editing && (
          <p className="text-center text-sm text-muted-foreground py-8">No hay cupones creados</p>
        )}
      </div>
    </div>
  );
};

export default CouponsTab;
