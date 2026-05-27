import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Store, Users, Package, Boxes, Truck, BarChart3, ShoppingCart, DollarSign,
  Tag, Settings as SettingsIcon, LogOut, ShieldCheck, Calendar, ChefHat, Sparkles,
} from "lucide-react";

type Module = { module_key: string; enabled: boolean };

const MODULE_TILES: Record<string, { label: string; icon: any; href?: string }> = {
  pos: { label: "POS / Caja", icon: ShoppingCart, href: "/pos" },
  inventario: { label: "Inventario", icon: Boxes, href: "/inventario" },
  crm: { label: "Clientes", icon: Users },
  agenda: { label: "Agenda", icon: Calendar },
  horeca: { label: "Restaurante", icon: ChefHat },
  mesas: { label: "Mesas", icon: Store, href: "/mesas" },
  kds: { label: "KDS Cocina", icon: ChefHat, href: "/kds" },
  retail: { label: "Tienda online", icon: Tag },
  belleza: { label: "Belleza", icon: Sparkles },
  spa: { label: "Spa", icon: Sparkles },
  representantes: { label: "Representantes", icon: Truck },
  licencias: { label: "Licencias", icon: ShieldCheck, href: "/licencias" },
};

const FIXED_TILES = [
  { key: "productos", label: "Productos", icon: Package, href: "/admin?tab=products" },
  { key: "compras", label: "Compras", icon: Truck, href: "/admin?tab=purchases" },
  { key: "reportes", label: "Reportes", icon: BarChart3, href: "/admin?tab=overview" },
  { key: "precios", label: "Listas de precios", icon: DollarSign, href: "/admin?tab=products" },
];

const TenantWorkspace = () => {
  const { slug = "" } = useParams();
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [org, setOrg] = useState<{ id: string; name: string; logo_url: string | null } | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/", { replace: true }); return; }

    (async () => {
      setBusy(true);
      const { data: orgRow, error } = await supabase
        .from("organizations")
        .select("id, name, logo_url, is_active")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !orgRow || !orgRow.is_active) {
        toast.error("Tienda no encontrada");
        navigate("/", { replace: true });
        return;
      }
      setOrg({ id: orgRow.id, name: orgRow.name, logo_url: orgRow.logo_url });

      // Member check (superadmin bypass)
      if (role !== "superadmin") {
        const { data: mem } = await supabase
          .from("organization_members")
          .select("role")
          .eq("organization_id", orgRow.id)
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        if (!mem) {
          toast.error("No tienes acceso a esta tienda");
          navigate("/", { replace: true });
          return;
        }
        setOrgRole(mem.role);
      } else {
        setOrgRole("superadmin");
      }

      const { data: mods } = await supabase
        .from("organization_modules")
        .select("module_key, enabled")
        .eq("organization_id", orgRow.id)
        .eq("enabled", true);
      setModules(mods ?? []);
      setBusy(false);
    })();
  }, [slug, user, role, loading, navigate]);

  const activeTiles = useMemo(() => {
    return modules
      .map((m) => ({ key: m.module_key, ...(MODULE_TILES[m.module_key] ?? { label: m.module_key, icon: Boxes }) }))
      .filter((t) => t.label);
  }, [modules]);

  if (loading || busy || !org) {
    return <div className="min-h-[100dvh] flex items-center justify-center text-sm text-muted-foreground">Cargando workspace…</div>;
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white">
                <Store size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-base truncate">{org.name}</h1>
              <p className="text-[11px] text-muted-foreground">Workspace · {orgRole}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role === "superadmin" && (
              <button onClick={() => navigate("/superadmin")} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">
                ↩ Superadmin
              </button>
            )}
            <button onClick={async () => { await signOut(); navigate("/", { replace: true }); }} className="text-xs text-destructive flex items-center gap-1 px-2 py-1.5 rounded hover:bg-destructive/10">
              <LogOut size={12} /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Módulos activos</h2>
          {activeTiles.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No hay módulos activos. Pide al superadministrador habilitar al menos uno.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {activeTiles.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => t.href && navigate(t.href)}
                    disabled={!t.href}
                    className="group rounded-lg border border-border bg-card p-4 text-left hover:border-primary hover:bg-primary/5 transition disabled:opacity-60"
                  >
                    <Icon className="h-6 w-6 text-primary mb-2" />
                    <div className="font-medium text-sm">{t.label}</div>
                    {!t.href && <div className="text-[10px] text-muted-foreground mt-1">Próximamente</div>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Gestión del negocio</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FIXED_TILES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => navigate(t.href)}
                  className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary hover:bg-primary/5 transition"
                >
                  <Icon className="h-6 w-6 text-primary mb-2" />
                  <div className="font-medium text-sm">{t.label}</div>
                </button>
              );
            })}
            <button
              onClick={() => navigate("/admin?tab=settings")}
              className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary hover:bg-primary/5 transition"
            >
              <SettingsIcon className="h-6 w-6 text-primary mb-2" />
              <div className="font-medium text-sm">Configuración tienda</div>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TenantWorkspace;
