import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, X, MapPin, Upload, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shippingZoneSchema, type ShippingZoneFormValues } from "@/lib/schemas";
import { errorToMessage } from "@/lib/errors";

const useCities = () => useQuery({
  queryKey: ["admin-municipality-cities"],
  queryFn: async () => {
    const { data, error } = await supabase.from("municipality_settings").select("city").eq("is_active", true).order("city");
    if (error) throw error;
    return (data || []).map((m: any) => String(m.city));
  },
});

const DEFAULT_CITIES = ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta"];

const ShippingTab = ({ queryClient }: { queryClient: any }) => {
  const { data: cities = [] } = useCities();
  const CITIES = cities.length > 0 ? cities : DEFAULT_CITIES;

  const { data: zones, isLoading } = useQuery({
    queryKey: ["admin-shipping-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_zones").select("*").order("city").order("neighborhood");
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState("");
  const [search, setSearch] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const defaultValues: ShippingZoneFormValues = {
    city: CITIES[0] || "Bucaramanga",
    neighborhood: "",
    delivery_price: 0,
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ShippingZoneFormValues>({
    resolver: zodResolver(shippingZoneSchema),
    defaultValues,
    mode: "onBlur",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-shipping-zones"] });
    queryClient.invalidateQueries({ queryKey: ["shipping-zones"] });
  };

  const onSubmit = async (values: ShippingZoneFormValues) => {
    const payload = {
      city: values.city,
      neighborhood: values.neighborhood.trim(),
      delivery_price: values.delivery_price,
      is_active: true,
    };
    try {
      if (editing && editing !== "new") {
        const { error } = await supabase.from("shipping_zones").update(payload).eq("id", editing);
        if (error) throw error;
        toast.success("Zona actualizada");
      } else {
        const { error } = await supabase.from("shipping_zones").insert(payload);
        if (error) throw error;
        toast.success("Zona creada");
      }
      invalidate();
      setEditing(null);
      reset(defaultValues);
    } catch (err) {
      toast.error(errorToMessage(err));
    }
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar zona?")) return;
    try {
      const { error } = await supabase.from("shipping_zones").delete().eq("id", id);
      if (error) throw error;
      invalidate();
      toast.success("Zona eliminada");
    } catch (err) {
      toast.error(errorToMessage(err));
    }
  };

  const bulkImport = async () => {
    const lines = bulkText.split("\n").filter(l => l.trim());
    if (!lines.length) { toast.error("No hay líneas para importar"); return; }
    setBulkSaving(true);
    const rows: any[] = [];
    const errs: string[] = [];
    lines.forEach((line, idx) => {
      const parts = line.split(/[,;\t]/).map(s => s.trim());
      if (parts.length < 2) { errs.push(`Línea ${idx + 1}: faltan columnas`); return; }
      const [city, neighborhood, price] = parts;
      const matchedCity = CITIES.find(c => c.toLowerCase() === city.toLowerCase());
      if (!matchedCity) { errs.push(`Línea ${idx + 1}: ciudad "${city}" no válida`); return; }
      if (!neighborhood || neighborhood.length < 2) { errs.push(`Línea ${idx + 1}: barrio inválido`); return; }
      const priceNum = Number(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) { errs.push(`Línea ${idx + 1}: precio inválido`); return; }
      rows.push({ city: matchedCity, neighborhood, delivery_price: priceNum, is_active: true });
    });
    if (rows.length === 0) {
      toast.error(errs[0] || "No se encontraron filas válidas");
      setBulkSaving(false);
      return;
    }
    try {
      const { error } = await supabase.from("shipping_zones").insert(rows);
      if (error) throw error;
      const skipped = errs.length;
      toast.success(`${rows.length} zonas importadas${skipped ? ` · ${skipped} líneas ignoradas` : ""}`);
      invalidate();
      setShowBulk(false);
      setBulkText("");
    } catch (err) {
      toast.error(errorToMessage(err));
    } finally {
      setBulkSaving(false);
    }
  };

  const filtered = zones?.filter(z => {
    if (filterCity && z.city !== filterCity) return false;
    if (search && !z.neighborhood.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const fieldCls = (hasError: boolean) =>
    `w-full bg-muted rounded-lg px-3 py-2.5 text-sm border focus:outline-none transition-colors ${
      hasError ? "border-destructive" : "border-transparent focus:border-accent"
    }`;

  const Err = ({ msg }: { msg?: string }) =>
    msg ? <p className="text-[11px] text-destructive font-medium mt-0.5">{msg}</p> : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-lg text-foreground">Zonas de Envío</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(!showBulk)} className="text-xs px-3 py-2 bg-muted rounded-lg flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <Upload size={14} /> CSV
          </button>
          <button
            onClick={() => { reset(defaultValues); setEditing("new"); }}
            className="btn-surte text-xs px-3 py-2 flex items-center gap-1"
          >
            <Plus size={14} /> Nueva
          </button>
        </div>
      </div>

      {/* Bulk import */}
      {showBulk && (
        <div className="bg-card rounded-xl p-4 border border-border space-y-3">
          <p className="text-xs text-muted-foreground">Formato: <code className="bg-muted px-1 rounded">Ciudad, Barrio, Precio</code> (una línea por zona)</p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={5}
            placeholder={"Bucaramanga, Cabecera, 5000\nFloridablanca, Cañaveral, 6000"}
            className="w-full bg-muted rounded-lg px-3 py-2 text-sm font-mono border border-transparent focus:border-accent focus:outline-none transition-colors"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowBulk(false)} className="flex-1 bg-muted rounded-lg py-2 text-sm text-muted-foreground">Cancelar</button>
            <button onClick={bulkImport} disabled={bulkSaving} className="flex-1 btn-surte py-2 text-sm flex items-center justify-center gap-1 disabled:opacity-50">
              {bulkSaving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {bulkSaving ? "Importando..." : "Importar"}
            </button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="bg-card rounded-xl p-4 border border-accent/30 space-y-3">
          <div className="flex justify-between">
            <span className="font-heading font-semibold text-sm text-foreground">{editing === "new" ? "Nueva" : "Editar"} Zona</span>
            <button type="button" onClick={() => { setEditing(null); reset(defaultValues); }}><X size={18} className="text-muted-foreground" /></button>
          </div>
          <div>
            <select {...register("city")} aria-invalid={!!errors.city} className={fieldCls(!!errors.city)}>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <Err msg={errors.city?.message} />
          </div>
          <div>
            <input
              {...register("neighborhood")}
              placeholder="Barrio *"
              aria-invalid={!!errors.neighborhood}
              className={fieldCls(!!errors.neighborhood)}
            />
            <Err msg={errors.neighborhood?.message} />
          </div>
          <div>
            <input
              type="number"
              step="any"
              {...register("delivery_price", { valueAsNumber: true })}
              placeholder="Precio domicilio (COP)"
              aria-invalid={!!errors.delivery_price}
              className={fieldCls(!!errors.delivery_price)}
            />
            <Err msg={errors.delivery_price?.message} />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-surte w-full text-sm py-2.5 flex items-center justify-center gap-1 disabled:opacity-50">
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSubmitting ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors">
          <option value="">Todas las ciudades</option>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar barrio..." className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
      </div>

      {/* Zones list */}
      {isLoading && <p className="text-sm text-muted-foreground text-center py-6">Cargando zonas...</p>}
      <div className="space-y-2">
        {filtered?.length === 0 && !isLoading && <p className="text-sm text-muted-foreground text-center py-6">No hay zonas configuradas</p>}
        {filtered?.map((z: any) => (
          <div key={z.id} className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border">
            <MapPin size={16} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{z.neighborhood}</p>
              <p className="text-xs text-muted-foreground">{z.city}</p>
            </div>
            <span className="text-sm font-heading font-bold text-foreground">
              {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(z.delivery_price)}
            </span>
            <button
              onClick={() => { reset({ city: z.city, neighborhood: z.neighborhood, delivery_price: Number(z.delivery_price) || 0 }); setEditing(z.id); }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <Pencil size={14} />
            </button>
            <button onClick={() => del(z.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {zones?.length || 0} zonas en total · Área Metropolitana de Bucaramanga
      </p>
    </div>
  );
};

export default ShippingTab;
