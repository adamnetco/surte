import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FlaskConical, Save } from "lucide-react";
import { toast } from "sonner";

interface Variant {
  id: string;
  sequence: string;
  step: number;
  variant_key: string;
  subject: string;
  weight: number;
  is_active: boolean;
}

const SEQUENCES = [
  { value: "trial_onboarding", label: "Trial onboarding" },
  { value: "trial_ending", label: "Trial por vencer" },
  { value: "winback_inactive", label: "Win-back inactivos" },
  { value: "approaching_limit", label: "Cerca del límite" },
  { value: "cancellation_followup", label: "Post-cancelación" },
  { value: "payment_recovered", label: "Pago recuperado" },
];

export default function SubjectVariantsManager() {
  const [rows, setRows] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lifecycle_subject_variants" as never)
      .select("*")
      .order("sequence")
      .order("step")
      .order("variant_key");
    if (error) toast.error(error.message);
    setRows((data as unknown as Variant[]) ?? []);
    setDirty(new Set());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (id: string, patch: Partial<Variant>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty((d) => new Set(d).add(id));
  };

  const addRow = () => {
    const tempId = `new-${Date.now()}`;
    setRows((rs) => [
      ...rs,
      { id: tempId, sequence: "trial_onboarding", step: 0, variant_key: "v1", subject: "", weight: 1, is_active: true },
    ]);
    setDirty((d) => new Set(d).add(tempId));
  };

  const remove = async (id: string) => {
    if (id.startsWith("new-")) {
      setRows((rs) => rs.filter((r) => r.id !== id));
      return;
    }
    if (!confirm("¿Eliminar variante?")) return;
    const { error } = await supabase.from("lifecycle_subject_variants" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Variante eliminada");
    load();
  };

  const save = async () => {
    setSaving(true);
    const toUpsert = rows.filter((r) => dirty.has(r.id));
    const payload = toUpsert.map(({ id, ...rest }) => (id.startsWith("new-") ? rest : { id, ...rest }));
    const { error } = await supabase.from("lifecycle_subject_variants" as never).upsert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${payload.length} variante(s) guardada(s)`);
    load();
  };

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold flex items-center gap-1">
          <FlaskConical className="w-4 h-4 text-primary" /> Variantes de asunto (A/B)
        </h2>
        <div className="flex gap-2">
          <Button onClick={addRow} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1" /> Nueva
          </Button>
          <Button onClick={save} size="sm" disabled={saving || dirty.size === 0}>
            <Save className="w-4 h-4 mr-1" /> Guardar ({dirty.size})
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sin variantes. Crea una para iniciar pruebas A/B.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 pr-2">Secuencia</th>
                <th className="py-1.5 pr-2">Paso</th>
                <th className="py-1.5 pr-2">Clave</th>
                <th className="py-1.5 pr-2">Asunto</th>
                <th className="py-1.5 pr-2">Peso</th>
                <th className="py-1.5 pr-2">Activa</th>
                <th className="py-1.5 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="py-1 pr-2">
                    <select
                      value={r.sequence}
                      onChange={(e) => update(r.id, { sequence: e.target.value })}
                      className="h-8 rounded border border-border bg-background px-1 text-xs"
                    >
                      {SEQUENCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <Input type="number" value={r.step} min={0} onChange={(e) => update(r.id, { step: parseInt(e.target.value) || 0 })} className="h-8 w-14 text-xs" />
                  </td>
                  <td className="py-1 pr-2">
                    <Input value={r.variant_key} onChange={(e) => update(r.id, { variant_key: e.target.value })} className="h-8 w-20 text-xs" />
                  </td>
                  <td className="py-1 pr-2">
                    <Input value={r.subject} onChange={(e) => update(r.id, { subject: e.target.value })} className="h-8 min-w-[260px] text-xs" />
                  </td>
                  <td className="py-1 pr-2">
                    <Input type="number" min={1} value={r.weight} onChange={(e) => update(r.id, { weight: parseInt(e.target.value) || 1 })} className="h-8 w-14 text-xs" />
                  </td>
                  <td className="py-1 pr-2">
                    <Switch checked={r.is_active} onCheckedChange={(v) => update(r.id, { is_active: v })} />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    {dirty.has(r.id) && <Badge variant="outline" className="text-[10px] mr-1">sin guardar</Badge>}
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)} className="h-7 w-7">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-2">
        El orchestrator elige aleatoriamente entre las variantes activas para cada (secuencia, paso), ponderado por <code>peso</code>.
      </p>
    </Card>
  );
}
