import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/context/AuthContext";
import { toast } from "sonner";

const ALL_ROLES: AppRole[] = ["superadmin", "admin", "editor", "agente", "user"];

interface SectionRow {
  section_key: string;
  label: string;
  allowed_roles: AppRole[];
  updated_at: string;
}

const AdminSectionAccess = () => {
  const { role } = useAuth();
  const isSuperadmin = role === "superadmin";
  const [rows, setRows] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("admin_section_access")
      .select("section_key, label, allowed_roles, updated_at")
      .order("section_key");
    if (error) toast.error("Error cargando secciones: " + error.message);
    else setRows((data as SectionRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleRole = async (section: string, current: AppRole[], r: AppRole) => {
    if (!isSuperadmin) {
      toast.error("Solo el superadmin puede modificar accesos");
      return;
    }
    const next = current.includes(r) ? current.filter((x) => x !== r) : [...current, r];
    if (!next.includes("superadmin")) next.push("superadmin"); // superadmin siempre
    setSaving(section);
    const { error } = await (supabase as any)
      .from("admin_section_access")
      .update({ allowed_roles: next })
      .eq("section_key", section);
    setSaving(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Permisos actualizados");
      setRows((rs) => rs.map((row) => (row.section_key === section ? { ...row, allowed_roles: next } : row)));
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Cargando configuración…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-primary">Control de acceso por sección</h2>
        <p className="text-xs text-muted-foreground">
          Define qué roles pueden acceder a cada sección del admin.
          {!isSuperadmin && " · Solo lectura (requiere superadmin para modificar)."}
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.section_key} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-sm">{row.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  <code>{row.section_key}</code> · actualizado {new Date(row.updated_at).toLocaleString()}
                </p>
              </div>
              {saving === row.section_key && <span className="text-xs text-muted-foreground">Guardando…</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((r) => {
                const active = row.allowed_roles.includes(r);
                const locked = r === "superadmin"; // superadmin siempre
                return (
                  <button
                    key={r}
                    disabled={!isSuperadmin || locked}
                    onClick={() => toggleRole(row.section_key, row.allowed_roles, r)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    } ${locked ? "opacity-70 cursor-not-allowed" : ""}`}
                  >
                    {r}{locked && " 🔒"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminSectionAccess;
