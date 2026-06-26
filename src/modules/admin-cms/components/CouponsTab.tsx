import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Ticket, Loader2, Copy } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { couponSchema, type CouponFormValues } from "@/lib/schemas";
import { errorToMessage } from "@/lib/errors";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { scopedFrom } from "@/modules/tenant/lib/tenantScope";
import { useUndoableDelete } from "@/modules/admin-cms/hooks/useUndoableDelete";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const defaultValues: CouponFormValues = {
  code: "",
  discount_type: "percentage",
  discount_value: 0 as unknown as number, // se reemplaza al escribir
  min_order_amount: undefined,
  max_uses: undefined,
  is_active: true,
  expires_at: "",
};

const CouponsTab = ({ queryClient }: { queryClient: any }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const { currentOrg } = useOrganization();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues,
    mode: "onBlur",
  });

  const discountType = watch("discount_type");
  const isActive = watch("is_active");

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["admin-coupons", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await scopedFrom("coupons", currentOrg!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    reset(defaultValues);
    setEditing(null);
  };

  const editCoupon = (c: any) => {
    reset({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: Number(c.discount_value),
      min_order_amount: c.min_order_amount ?? undefined,
      max_uses: c.max_uses ?? undefined,
      is_active: !!c.is_active,
      expires_at: c.expires_at ? c.expires_at.split("T")[0] : "",
    });
    setEditing(c.id);
  };

  const onSubmit = async (values: CouponFormValues) => {
    try {
      const payload = {
        code: values.code.toUpperCase().trim(),
        discount_type: values.discount_type,
        discount_value: values.discount_value,
        min_order_amount: values.min_order_amount ?? 0,
        max_uses: values.max_uses ?? null,
        is_active: values.is_active,
        expires_at: values.expires_at ? new Date(values.expires_at + "T23:59:59").toISOString() : null,
      };
      if (editing && editing !== "new") {
        const { error } = await supabase.from("coupons").update(payload).eq("id", editing);
        if (error) throw error;
        toast.success("Cupón actualizado");
      } else {
        if (!currentOrg?.id) { toast.error("Selecciona una organización"); return; }
        const { error } = await supabase.from("coupons").insert({ ...payload, organization_id: currentOrg.id });
        if (error) throw error;
        toast.success("Cupón creado");
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
    } catch (err) {
      toast.error(errorToMessage(err));
    }
  };

  const undoableDelete = useUndoableDelete({
    queryClient,
    queryKey: ["admin-coupons", currentOrg?.id],
    table: "coupons",
    label: "Cupón eliminado",
    invalidateOnCommit: [["admin-coupons"]],
    matchOnDelete: currentOrg?.id ? { organization_id: currentOrg.id } : undefined,
  });
  const deleteCoupon = (id: string) => undoableDelete(id);

  const fieldCls = (hasError: boolean, extra = "") =>
    `w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none border focus:ring-2 focus:ring-ring ${
      hasError ? "border-destructive ring-destructive/30" : "border-transparent"
    } ${extra}`;

  const Err = ({ msg }: { msg?: string }) =>
    msg ? <p className="text-[11px] text-destructive font-medium mt-0.5">{msg}</p> : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-base text-foreground">Cupones de Descuento</h2>
          <p className="text-xs text-muted-foreground">Gestiona códigos promocionales</p>
        </div>
        <button onClick={() => { reset(defaultValues); setEditing("new"); }} className="flex items-center gap-1 bg-accent text-accent-foreground px-3 py-2 rounded-xl text-xs font-semibold">
          <Plus size={14} /> Crear Cupón
        </button>
      </div>

      {/* Form */}
      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="bg-card border border-accent/30 rounded-xl p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Código *</label>
              <input
                {...register("code", {
                  onChange: (e) => setValue("code", e.target.value.toUpperCase(), { shouldValidate: true }),
                })}
                placeholder="SURTE20"
                aria-invalid={!!errors.code}
                className={fieldCls(!!errors.code, "uppercase font-mono")}
              />
              <Err msg={errors.code?.message} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Tipo</label>
              <select
                {...register("discount_type")}
                aria-invalid={!!errors.discount_type}
                className={fieldCls(!!errors.discount_type)}
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto Fijo ($)</option>
              </select>
              <Err msg={errors.discount_type?.message} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">
                Valor * {discountType === "percentage" ? "(%)" : "(COP)"}
              </label>
              <input
                type="number"
                step="any"
                {...register("discount_value", { valueAsNumber: true })}
                placeholder={discountType === "percentage" ? "20" : "10000"}
                aria-invalid={!!errors.discount_value}
                className={fieldCls(!!errors.discount_value)}
              />
              <Err msg={errors.discount_value?.message} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Pedido Mínimo (COP)</label>
              <input
                type="number"
                step="any"
                {...register("min_order_amount")}
                placeholder="50000"
                aria-invalid={!!errors.min_order_amount}
                className={fieldCls(!!errors.min_order_amount)}
              />
              <Err msg={errors.min_order_amount?.message} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Máx. Usos</label>
              <input
                type="number"
                step="1"
                {...register("max_uses")}
                placeholder="Ilimitado"
                aria-invalid={!!errors.max_uses}
                className={fieldCls(!!errors.max_uses)}
              />
              <Err msg={errors.max_uses?.message} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Expira</label>
              <input
                type="date"
                {...register("expires_at")}
                aria-invalid={!!errors.expires_at}
                className={fieldCls(!!errors.expires_at)}
              />
              <Err msg={errors.expires_at?.message} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={(v) => setValue("is_active", v, { shouldDirty: true })} />
            <span className="text-xs text-muted-foreground">{isActive ? "Activo" : "Inactivo"}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={resetForm} className="flex-1 bg-muted rounded-xl py-2 text-sm text-muted-foreground font-medium flex items-center justify-center gap-1">
              <X size={14} /> Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-accent text-accent-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-60">
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
            </button>
          </div>
        </form>
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
