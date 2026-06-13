import { useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import {
  ShoppingCart, Wallet, FileText, Boxes, Truck, BarChart3, Megaphone,
  Users, UserPlus, Settings, Shield, LogOut, Loader2, Utensils, ChefHat, Power, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import POSWorkspaceNav from "@/modules/pos/components/POSWorkspaceNav";
import POSStatusBar from "@/modules/pos/components/POSStatusBar";
import MaxUsersMeter from "@/modules/pos/components/MaxUsersMeter";

type TileColor =
  | "primary" | "secondary" | "accent" | "destructive"
  | "primary-soft" | "accent-soft" | "muted" | "card-dark";

interface Tile {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  onClick?: () => void;
  color: TileColor;
  size?: "lg" | "md" | "sm";
  roles?: string[]; // si vacío → visible para todos los roles operativos
  module?: string;  // si está, requiere hasModule(module)
}

interface Group {
  title: string;
  tiles: Tile[];
}

const colorClasses: Record<TileColor, string> = {
  primary:       "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary:     "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  accent:        "bg-accent text-accent-foreground hover:bg-accent/90",
  destructive:   "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  "primary-soft":"bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30",
  "accent-soft": "bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30",
  muted:         "bg-muted text-foreground hover:bg-muted/70 border border-border",
  "card-dark":   "bg-foreground text-background hover:bg-foreground/90",
};

export default function PosHub() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading, signOut } = useAuth();
  const { currentOrg, hasModule, loading: orgLoading } = useOrganization();

  useEffect(() => { document.title = "Panel POS · SistecPOS"; }, []);
  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [user, authLoading, navigate]);

  const isOwnerOrAdmin = role === "superadmin" || role === "admin";

  const groups = useMemo<Group[]>(() => [
    {
      title: "Venta rápida",
      tiles: [
        { title: "Crear venta",   subtitle: "Generar boleta o factura",   icon: ShoppingCart, to: "/pos/vender", color: "primary", size: "lg", module: "pos_counter" },
        { title: "Caja diaria",   subtitle: "Apertura, arqueo y cierre",  icon: Wallet,       to: "/pos/vender?caja=1", color: "accent", size: "md", module: "pos_counter" },
        { title: "Mesas",         subtitle: "Salón y comandas",           icon: Utensils,     to: "/mesas",      color: "primary-soft", size: "sm", module: "tables" },
        { title: "Cotizaciones",  subtitle: "Presupuestos para clientes", icon: FileText,     to: "/admin?tab=quotes", color: "card-dark", size: "lg" },
      ],
    },
    {
      title: "Operaciones",
      tiles: [
        { title: "Inventario",       subtitle: "Existencias y bodegas",     icon: Boxes,    to: "/inventario", color: "primary", size: "md" },
        { title: "Orden de compra",  subtitle: "Pedidos a proveedores",     icon: Truck,    to: "/compras",    color: "card-dark", size: "md" },
        { title: "Reportes de venta",subtitle: "Análisis de rendimiento",   icon: BarChart3,to: "/admin?tab=reports", color: "muted", size: "lg" },
        { title: "KDS cocina",       subtitle: "Pantalla de pedidos",       icon: ChefHat,  to: "/kds",        color: "primary-soft", size: "sm", module: "kds" },
        { title: "Promociones",      subtitle: "Ofertas y campañas",        icon: Megaphone,to: "/admin?tab=promotions", color: "accent", size: "lg" },
      ],
    },
    {
      title: "Gestión de clientes",
      tiles: [
        { title: "Clientes",       subtitle: "Base de datos y fidelización", icon: UserPlus, to: "/admin?tab=customers", color: "secondary", size: "md" },
        { title: "Domicilios",     subtitle: "Pedidos a domicilio",          icon: Truck,    to: "/pedidos",    color: "secondary", size: "md" },
        { title: "Soporte técnico",subtitle: "Gestión de incidencias",       icon: Shield,   to: "/ayuda",      color: "card-dark", size: "lg" },
      ],
    },
    {
      title: "Configuración",
      tiles: [
        { title: "Ajustes del sistema", subtitle: "Configuración general",   icon: Settings, to: "/admin",       color: "primary-soft", size: "lg", roles: ["superadmin","admin","owner","manager"] },
        { title: "Sitios web del negocio", subtitle: "Astro + WordPress headless por tienda", icon: Globe, to: "/sitios", color: "accent-soft", size: "md", roles: ["superadmin","admin","owner"] },
        { title: "Usuarios",            subtitle: "Permisos y accesos",      icon: Users,    to: "/admin?tab=users", color: "accent-soft", size: "md", roles: ["superadmin","admin","owner"] },
        { title: "Facturación",         subtitle: "Documentos electrónicos", icon: FileText, to: "/facturacion", color: "muted", size: "md" },
        { title: "Salir",               subtitle: "Cerrar sesión",           icon: LogOut,   onClick: async () => { await signOut?.(); navigate("/login"); }, color: "destructive", size: "lg" },
      ],
    },
  ], [navigate, signOut]);

  // Bypass de módulos para roles con visión completa: el hub no debe verse
  // vacío en tenants recién creados ni para el superadmin maestro.
  const moduleBypass = role === "superadmin" || role === "admin";

  const canRender = (t: Tile) => {
    if (t.roles && !t.roles.includes(role ?? "")) return false;
    if (t.module && !moduleBypass && !hasModule(t.module)) return false;
    return true;
  };

  const sizeClasses: Record<NonNullable<Tile["size"]>, string> = {
    lg: "col-span-2 row-span-2 min-h-[160px]",
    md: "col-span-1 row-span-2 min-h-[160px]",
    sm: "col-span-1 row-span-1 min-h-[76px]",
  };

  if (authLoading || orgLoading) {
    return <div className="min-h-[100dvh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!currentOrg) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6 text-center">
        <p className="text-muted-foreground">No tienes organización activa.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-muted/40">
      {/* Topbar */}
      <header className="bg-card border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">S</div>
            <div className="hidden sm:block leading-tight">
              <p className="text-sm font-bold">SistecPOS</p>
              <p className="text-[11px] text-muted-foreground">{currentOrg.name}</p>
            </div>
          </div>
          <span className="ml-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold hidden sm:inline">
            Punto de venta
          </span>
          {/* Switcher operativo — acceso 1-click a las 4 vistas POS */}
          <POSWorkspaceNav className="ml-2 hidden md:flex" />
          <nav className="ml-auto hidden lg:flex items-center gap-1 text-sm">
            <Link to="/perfil"     className="px-3 py-1.5 rounded hover:bg-muted">Mi cuenta</Link>
            {isOwnerOrAdmin && <Link to="/admin" className="px-3 py-1.5 rounded hover:bg-muted">Administración</Link>}
          </nav>
          <div className="ml-auto lg:ml-2 flex items-center gap-2">
            <POSStatusBar organizationId={currentOrg.id} className="hidden md:flex" />
            <Button variant="ghost" size="icon" onClick={async () => { await signOut?.(); navigate("/login"); }} title="Salir">
              <Power className="w-5 h-5" />
            </Button>
          </div>
        </div>
        {/* Switcher visible siempre en móvil/tablet */}
        <div className="md:hidden border-t bg-muted/30 px-3 py-2 overflow-x-auto space-y-2">
          <POSWorkspaceNav />
          <POSStatusBar organizationId={currentOrg.id} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-6">
        <div className="mb-4 sm:mb-6 text-center">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Punto de venta <span className="text-muted-foreground">— Acceso rápido</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Toca una opción para continuar. También puedes saltar directo a <Link to="/pos/vender" className="text-primary font-medium hover:underline">Vender</Link>, <Link to="/mesas" className="text-primary font-medium hover:underline">Mesas</Link> o <Link to="/kds" className="text-primary font-medium hover:underline">KDS</Link> desde la barra superior.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
          {groups.map((g) => {
            const visible = g.tiles.filter(canRender);
            if (visible.length === 0) return null;
            return (
              <section key={g.title} className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                  {g.title}
                </h2>
                <div className="grid grid-cols-2 auto-rows-[76px] gap-3">
                  {visible.map((t) => {
                    const cls = `${colorClasses[t.color]} ${sizeClasses[t.size ?? "md"]} group relative rounded-xl p-3 sm:p-4 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 flex flex-col justify-between overflow-hidden`;
                    const Icon = t.icon;
                    const content = (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold uppercase text-sm sm:text-base leading-tight truncate">{t.title}</p>
                            {t.size !== "sm" && (
                              <p className="text-[11px] sm:text-xs opacity-80 mt-1 line-clamp-2">{t.subtitle}</p>
                            )}
                          </div>
                          <Icon className="w-5 h-5 sm:w-6 sm:h-6 opacity-90 shrink-0" />
                        </div>
                        {t.size === "lg" && (
                          <Icon className="absolute -bottom-2 -right-2 w-16 h-16 opacity-10 pointer-events-none" />
                        )}
                      </>
                    );
                    return t.to ? (
                      <Link key={t.title} to={t.to} className={cls}>{content}</Link>
                    ) : (
                      <button key={t.title} onClick={t.onClick} className={cls}>{content}</button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-8 max-w-xs mx-auto">
          <MaxUsersMeter />
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          ¿Necesitas la gestión avanzada? Ve a{" "}
          <Link to="/admin" className="text-primary font-medium hover:underline">Administración</Link>.
        </p>
      </main>
    </div>
  );
}
