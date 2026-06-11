import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Code, Loader2, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

const POSITIONS = [
  { value: "head", label: "Head (antes de </head>)" },
  { value: "body_start", label: "Body inicio (después de <body>)" },
  { value: "body_end", label: "Body final (antes de </body>)" },
];

const ScriptsTab = ({ queryClient }: { queryClient: any }) => {
  const { currentOrg } = useOrganization();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", script_content: "", position: "head", is_active: true, sort_order: 0 });

  const { data: scripts, isLoading } = useQuery({
    queryKey: ["admin-custom-scripts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_scripts").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setForm({ name: "", script_content: "", position: "head", is_active: true, sort_order: 0 });
    setEditing(null);
  };

  const editScript = (s: any) => {
    setForm({
      name: s.name,
      script_content: s.script_content,
      position: s.position,
      is_active: s.is_active,
      sort_order: s.sort_order || 0,
    });
    setEditing(s.id);
  };

  const saveScript = async () => {
    if (!form.name.trim() || !form.script_content.trim()) {
      toast.error("Nombre y contenido del script son obligatorios");
      return;
    }
    try {
      const payload = { ...form, sort_order: Number(form.sort_order) || 0 };
      if (editing && editing !== "new") {
        const { error } = await supabase.from("custom_scripts").update(payload).eq("id", editing);
        if (error) throw error;
        toast.success("Script actualizado");
      } else {
        if (!currentOrg?.id) { toast.error("Selecciona una organización"); return; }
        const { error } = await supabase.from("custom_scripts").insert({ ...payload, organization_id: currentOrg.id });
        if (error) throw error;
        toast.success("Script creado");
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["admin-custom-scripts"] });
      queryClient.invalidateQueries({ queryKey: ["custom-scripts"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteScript = async (id: string) => {
    if (!confirm("¿Eliminar este script?")) return;
    const { error } = await supabase.from("custom_scripts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Script eliminado");
    queryClient.invalidateQueries({ queryKey: ["admin-custom-scripts"] });
    queryClient.invalidateQueries({ queryKey: ["custom-scripts"] });
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("custom_scripts").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-custom-scripts"] });
    queryClient.invalidateQueries({ queryKey: ["custom-scripts"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-base text-foreground">Scripts de Terceros</h2>
          <p className="text-xs text-muted-foreground">Inyecta Google Analytics, Merchant Center, Pixel y más</p>
        </div>
        <button onClick={() => { resetForm(); setEditing("new"); }} className="flex items-center gap-1 bg-accent text-accent-foreground px-3 py-2 rounded-xl text-xs font-semibold">
          <Plus size={14} /> Añadir
        </button>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { name: "Google Merchant Widget", content: `<script id="merchantWidgetScript" src="https://www.gstatic.com/shopping/merchant/merchantwidget.js" defer></script>\n<script>\n  document.getElementById('merchantWidgetScript').addEventListener('load', function() {\n    merchantwidget.start({ merchant_id: 5758181755 });\n  });\n</script>`, pos: "body_end" },
          { name: "Google Customer Reviews", content: `<script src="https://apis.google.com/js/platform.js?onload=renderBadge" async defer></script>\n<script>\n  window.renderBadge = function() {\n    var ratingBadgeContainer = document.createElement("div");\n    document.body.appendChild(ratingBadgeContainer);\n    window.gapi.load('ratingbadge', function() {\n      window.gapi.ratingbadge.render(ratingBadgeContainer, { merchant_id: 5758181755, position: "BOTTOM_RIGHT" });\n    });\n  };\n</script>`, pos: "body_end" },
        ].map((preset) => (
          <button
            key={preset.name}
            onClick={() => {
              setForm({ name: preset.name, script_content: preset.content, position: preset.pos, is_active: true, sort_order: 0 });
              setEditing("new");
            }}
            className="text-left bg-card border border-border rounded-xl p-2.5 hover:border-accent/40 transition-colors"
          >
            <p className="text-xs font-semibold text-foreground">{preset.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Añadir preset</p>
          </button>
        ))}
      </div>

      {/* Form */}
      {editing && (
        <div className="bg-card border border-accent/30 rounded-xl p-3 space-y-2.5">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre del script (ej: Google Analytics)"
            className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none"
          >
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <textarea
            value={form.script_content}
            onChange={(e) => setForm({ ...form, script_content: e.target.value })}
            placeholder="<script>...</script>"
            rows={6}
            className="w-full bg-muted rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <span className="text-xs text-muted-foreground">Activo</span>
          </div>
          <div className="flex gap-2">
            <button onClick={resetForm} className="flex-1 bg-muted rounded-xl py-2 text-sm text-muted-foreground font-medium flex items-center justify-center gap-1">
              <X size={14} /> Cancelar
            </button>
            <button onClick={saveScript} className="flex-1 bg-accent text-accent-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1">
              <Save size={14} /> Guardar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {scripts?.map((s: any) => (
          <div key={s.id} className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Code size={14} className={s.is_active ? "text-secondary" : "text-muted-foreground"} />
              <span className="text-sm font-medium text-foreground flex-1">{s.name}</span>
              <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">
              Posición: {POSITIONS.find((p) => p.value === s.position)?.label || s.position}
            </p>
            <pre className="bg-muted rounded-lg p-2 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-20 overflow-y-auto whitespace-pre-wrap">
              {s.script_content.slice(0, 200)}{s.script_content.length > 200 ? "..." : ""}
            </pre>
            <div className="flex gap-1.5 mt-2">
              <button onClick={() => editScript(s)} className="flex items-center gap-1 text-[11px] text-accent hover:underline">
                <Pencil size={11} /> Editar
              </button>
              <button onClick={() => deleteScript(s.id)} className="flex items-center gap-1 text-[11px] text-destructive hover:underline">
                <Trash2 size={11} /> Eliminar
              </button>
            </div>
          </div>
        ))}
        {!isLoading && (!scripts || scripts.length === 0) && !editing && (
          <p className="text-center text-sm text-muted-foreground py-8">No hay scripts configurados</p>
        )}
      </div>
    </div>
  );
};

export default ScriptsTab;
