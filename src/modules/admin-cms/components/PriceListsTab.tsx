import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, Trash2, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

const PriceListsTab = () => {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: lists, isLoading } = useQuery({
    queryKey: ["price-lists", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("id,name,code,currency,is_default,is_active,created_at")
        .eq("organization_id", orgId!)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const create = async () => {
    if (!orgId || !name.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("price_lists").insert({
      organization_id: orgId,
      name: name.trim(),
      code: code.trim() || null,
      currency: "COP",
      is_default: !lists?.length,
      is_active: true,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName(""); setCode("");
    toast.success("Lista creada");
    qc.invalidateQueries({ queryKey: ["price-lists", orgId] });
  };

  const setDefault = async (id: string) => {
    if (!orgId) return;
    // Unset others first (partial unique index allows only one default per org)
    const { error: e1 } = await supabase
      .from("price_lists")
      .update({ is_default: false })
      .eq("organization_id", orgId)
      .neq("id", id);
    if (e1) { toast.error(e1.message); return; }
    const { error } = await supabase
      .from("price_lists")
      .update({ is_default: true })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lista por defecto actualizada");
    qc.invalidateQueries({ queryKey: ["price-lists", orgId] });
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("price_lists").update({ is_active: !is_active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["price-lists", orgId] });
  };

  const remove = async (id: string) => {
    if (!window.confirm("¿Eliminar esta lista de precios? Los clientes asignados volverán a la lista por defecto.")) return;
    const { error } = await supabase.from("price_lists").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lista eliminada");
    qc.invalidateQueries({ queryKey: ["price-lists", orgId] });
  };

  if (!currentOrg) {
    return <div className="p-4 text-sm text-muted-foreground">Selecciona una organización.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5" /> Listas de precios
        </h2>
        <p className="text-sm text-muted-foreground">
          Define listas (Detal, Mayorista, Distribuidor…) y asígnalas a cada cliente en Contactos.
        </p>
      </div>

      <div className="border border-border rounded-lg p-3 bg-card space-y-2">
        <div className="grid sm:grid-cols-[1fr,160px,auto] gap-2">
          <Input placeholder="Nombre (ej. Mayorista)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Código (opcional)" value={code} onChange={(e) => setCode(e.target.value)} />
          <button
            onClick={create}
            disabled={!name.trim() || creating}
            className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm flex items-center gap-1 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : !lists?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aún no hay listas. Crea la primera arriba (será la lista por defecto).
          </p>
        ) : (
          lists.map((l: any) => (
            <div key={l.id} className="flex items-center gap-2 border border-border rounded-lg p-2 bg-card">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm flex items-center gap-2">
                  {l.name}
                  {l.is_default && (
                    <span className="text-[10px] uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      por defecto
                    </span>
                  )}
                  {!l.is_active && (
                    <span className="text-[10px] uppercase bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      inactiva
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[l.code, l.currency].filter(Boolean).join(" · ")}
                </div>
              </div>
              {!l.is_default && (
                <button
                  onClick={() => setDefault(l.id)}
                  title="Marcar como por defecto"
                  className="p-1.5 hover:bg-muted rounded"
                >
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => toggleActive(l.id, l.is_active)}
                className="text-xs px-2 py-1 rounded border border-border"
              >
                {l.is_active ? "Desactivar" : "Activar"}
              </button>
              <button
                onClick={() => remove(l.id)}
                className="p-1.5 hover:bg-destructive/10 text-destructive rounded"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Próximamente: precios por producto dentro de cada lista (price_list_items).
      </p>
    </div>
  );
};

export default PriceListsTab;
