import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  BarChart3, ShoppingCart, CalendarDays, Package, Tag, Handshake, Box, Settings, FileUp,
  Users, MessageSquare, Map as MapIcon, Bell, FileText, Layers, Star, Globe, Search, Ticket, Code,
  MapPin, Truck, Printer, ChefHat, Monitor, Utensils, Receipt, ShoppingBag, Warehouse,
  CreditCard, Wallet, Sparkles, Rocket, Building2, Home, LayoutGrid, History, PackageSearch,
} from "lucide-react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import type { AppRole } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";

type Action = {
  id: string;
  label: string;
  icon: any;
  group: string;
  roles?: AppRole[];
  /** Route to navigate to. For admin tabs, includes ?tab=... */
  to: string;
  keywords?: string;
};

const ACTIONS: Action[] = [
  // Admin tabs
  { id: "tab-overview", label: "Resumen", icon: BarChart3, group: "Admin · Ventas", to: "/admin?tab=overview", roles: ["superadmin","admin"] },
  { id: "tab-orders", label: "Pedidos", icon: ShoppingCart, group: "Admin · Ventas", to: "/admin?tab=orders" },
  { id: "tab-agenda", label: "Agenda", icon: CalendarDays, group: "Admin · Ventas", to: "/admin?tab=agenda" },
  { id: "tab-products", label: "Productos / Inventario", icon: Package, group: "Admin · Catálogo", to: "/admin?tab=products" },
  { id: "tab-categories", label: "Categorías", icon: Tag, group: "Admin · Catálogo", to: "/admin?tab=categories", roles: ["superadmin","admin"] },
  { id: "tab-brands", label: "Marcas", icon: Handshake, group: "Admin · Catálogo", to: "/admin?tab=brands", roles: ["superadmin","admin"] },
  { id: "tab-presentations", label: "Presentaciones", icon: Box, group: "Admin · Catálogo", to: "/admin?tab=presentations", roles: ["superadmin","admin"] },
  { id: "tab-modifiers", label: "Modificadores", icon: Settings, group: "Admin · Catálogo", to: "/admin?tab=modifiers", roles: ["superadmin","admin"] },
  { id: "tab-inventory", label: "Importar CSV", icon: FileUp, group: "Admin · Catálogo", to: "/admin?tab=inventory", roles: ["superadmin","admin"], keywords: "csv import datos" },
  { id: "tab-users", label: "Usuarios", icon: Users, group: "Admin · Clientes", to: "/admin?tab=users", roles: ["superadmin","admin"] },
  { id: "tab-contacts", label: "Contactos", icon: Users, group: "Admin · Clientes", to: "/admin?tab=contacts", roles: ["superadmin","admin"] },
  { id: "tab-crm", label: "CRM Leads", icon: MessageSquare, group: "Admin · Clientes", to: "/admin?tab=crm", roles: ["superadmin","admin"] },
  { id: "tab-reviews", label: "Comentarios", icon: MessageSquare, group: "Admin · Clientes", to: "/admin?tab=reviews" },
  { id: "tab-google-reviews", label: "Reseñas Google", icon: Map, group: "Admin · Clientes", to: "/admin?tab=google-reviews" },
  { id: "tab-notifications", label: "Alertas / Notificaciones", icon: Bell, group: "Admin · Clientes", to: "/admin?tab=notifications", roles: ["superadmin","admin"] },
  { id: "tab-content", label: "Contenido", icon: FileText, group: "Admin · Contenido", to: "/admin?tab=content", roles: ["superadmin","admin"] },
  { id: "tab-hero", label: "Hero", icon: Layers, group: "Admin · Contenido", to: "/admin?tab=hero", roles: ["superadmin","admin"] },
  { id: "tab-featured", label: "Destacados", icon: Star, group: "Admin · Contenido", to: "/admin?tab=featured", roles: ["superadmin","admin"] },
  { id: "tab-landing", label: "Landing / SEO Pages", icon: Globe, group: "Admin · Contenido", to: "/admin?tab=landing", roles: ["superadmin","admin"] },
  { id: "tab-seo", label: "SEO", icon: Search, group: "Admin · Marketing", to: "/admin?tab=seo", roles: ["superadmin","admin"] },
  { id: "tab-seo-content", label: "SEO Long-form", icon: FileText, group: "Admin · Marketing", to: "/admin?tab=seo-content" },
  { id: "tab-coupons", label: "Cupones", icon: Ticket, group: "Admin · Marketing", to: "/admin?tab=coupons", roles: ["superadmin","admin"] },
  { id: "tab-scripts", label: "Scripts / Píxeles", icon: Code, group: "Admin · Marketing", to: "/admin?tab=scripts", roles: ["superadmin","admin"] },
  { id: "tab-municipalities", label: "Ciudades", icon: MapPin, group: "Admin · Operación", to: "/admin?tab=municipalities", roles: ["superadmin","admin"] },
  { id: "tab-shipping", label: "Logística / Envíos", icon: Truck, group: "Admin · Operación", to: "/admin?tab=shipping", roles: ["superadmin","admin"] },
  { id: "tab-printers", label: "Impresoras", icon: Printer, group: "Admin · Operación", to: "/admin?tab=printers", roles: ["superadmin","admin"] },
  { id: "tab-kitchen-routing", label: "Ruteo Cocina", icon: ChefHat, group: "Admin · Operación", to: "/admin?tab=kitchen-routing", roles: ["superadmin","admin"] },

  // Operativa
  { id: "go-pos", label: "Ir al POS", icon: Monitor, group: "Operación", to: "/pos", keywords: "vender caja" },
  { id: "go-vender", label: "Vender (POS)", icon: Monitor, group: "Operación", to: "/pos/vender" },
  { id: "go-mesas", label: "Mesas", icon: Utensils, group: "Operación", to: "/mesas" },
  { id: "go-kds", label: "KDS Cocina", icon: ChefHat, group: "Operación", to: "/kds" },
  { id: "go-facturacion", label: "Facturación electrónica", icon: Receipt, group: "Operación", to: "/facturacion", roles: ["superadmin","admin"] },
  { id: "go-compras", label: "Compras", icon: ShoppingBag, group: "Operación", to: "/compras", roles: ["superadmin","admin"] },
  { id: "go-inventario", label: "Inventario avanzado", icon: Warehouse, group: "Operación", to: "/inventario", roles: ["superadmin","admin"] },
  { id: "go-billing", label: "Billing", icon: Wallet, group: "Operación", to: "/billing", roles: ["superadmin","admin"] },
  { id: "go-planes", label: "Planes", icon: CreditCard, group: "Operación", to: "/planes" },
  { id: "go-gerente-ia", label: "Gerente IA", icon: Sparkles, group: "Operación", to: "/gerente-ia", roles: ["superadmin","admin"] },
  { id: "go-onboarding", label: "Onboarding", icon: Rocket, group: "Operación", to: "/onboarding", roles: ["superadmin","admin"] },

  // Superadmin
  { id: "sa-dashboard", label: "Superadmin · Dashboard", icon: Building2, group: "Superadmin", to: "/superadmin", roles: ["superadmin"] },
  { id: "sa-sitios", label: "Superadmin · Sitios", icon: Globe, group: "Superadmin", to: "/sitios", roles: ["superadmin"] },
  { id: "sa-licencias", label: "Superadmin · Licencias", icon: Ticket, group: "Superadmin", to: "/licencias", roles: ["superadmin"] },
  { id: "sa-catalogos", label: "Superadmin · Catálogos base", icon: LayoutGrid, group: "Superadmin", to: "/catalogos-base", roles: ["superadmin"] },

  // Cuenta / portal
  { id: "go-home", label: "Ir al inicio", icon: Home, group: "Navegación", to: "/" },
  { id: "go-admin", label: "Ir al Admin", icon: BarChart3, group: "Navegación", to: "/admin" },
  { id: "go-clientes", label: "Portal de cliente", icon: Users, group: "Navegación", to: "/clientes" },
  { id: "go-perfil", label: "Mi perfil", icon: Users, group: "Navegación", to: "/perfil" },
];

const RECENTS_KEY = "cmdk:recent-actions:v1";
const RECENTS_MAX = 5;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    const cur = loadRecents().filter((x) => x !== id);
    const next = [id, ...cur].slice(0, RECENTS_MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

/** Debounce a value (UI-only, no deps). */
function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Paleta de comandos global (⌘K / Ctrl+K). Accesible desde cualquier pantalla.
 * - Filtra acciones por rol del usuario y navega a la ruta correspondiente.
 * - Las tabs del admin se abren con `?tab=<id>` que AdminDashboard sincroniza con su estado.
 * - Recientes: últimas 5 acciones ejecutadas (localStorage).
 * - Búsqueda dinámica de productos en la organización actual (debounced 200ms).
 */
export default function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const { currentOrg } = useOrganization();
  const [recents, setRecents] = useState<string[]>(() => loadRecents());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // El POS tiene su propia paleta (productos). No pisamos ⌘K dentro de /pos*.
        if (window.location.pathname.startsWith("/pos")) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest?.("[cmdk-root]")) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset query al cerrar y refrescar recientes al abrir.
  useEffect(() => {
    if (!open) setQuery("");
    else setRecents(loadRecents());
  }, [open]);

  const debouncedQuery = useDebounced(query.trim(), 200);
  const orgId = currentOrg?.id;

  const { data: productResults = [] } = useQuery({
    queryKey: ["cmdk-products", orgId, debouncedQuery],
    enabled: open && !!orgId && debouncedQuery.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const q = debouncedQuery.replace(/[%,]/g, " ");
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id, name, slug, sku, is_active")
        .eq("organization_id", orgId)
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
        .order("name", { ascending: true })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; slug: string | null; sku: string | null; is_active: boolean }>;
    },
  });

  if (!user) return null;

  const allowed = useMemo(
    () => ACTIONS.filter((a) => !a.roles || a.roles.includes(role)),
    [role]
  );
  const allowedById = useMemo(() => new Map(allowed.map((a) => [a.id, a])), [allowed]);
  const recentActions = useMemo(
    () => recents.map((id) => allowedById.get(id)).filter(Boolean) as Action[],
    [recents, allowedById]
  );

  const grouped = allowed.reduce<Record<string, Action[]>>((acc, a) => {
    (acc[a.group] ||= []).push(a);
    return acc;
  }, {});
  const groupOrder = Array.from(new Set(allowed.map((a) => a.group)));

  const run = (a: Action) => {
    pushRecent(a.id);
    setOpen(false);
    navigate(a.to);
  };

  const goToProduct = (p: { id: string; slug: string | null }) => {
    setOpen(false);
    // Editar producto desde el admin (más útil que el detalle público para roles admin).
    if (role === "superadmin" || role === "admin") {
      navigate(`/admin?tab=products&edit=${p.id}`);
    } else if (p.slug) {
      navigate(`/producto/${p.slug}`);
    } else {
      navigate(`/admin?tab=products`);
    }
  };

  const showRecents = !debouncedQuery && recentActions.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar producto, tab o módulo… (⌘K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Sin resultados.</CommandEmpty>

        {showRecents && (
          <>
            <CommandGroup heading="Recientes">
              {recentActions.map((a) => {
                const Icon = a.icon;
                return (
                  <CommandItem
                    key={`recent-${a.id}`}
                    value={`recientes ${a.label} ${a.group}`}
                    onSelect={() => run(a)}
                    className="flex items-center gap-2"
                  >
                    <History className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{a.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[40%]">{a.to}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {productResults.length > 0 && (
          <>
            <CommandGroup heading="Productos">
              {productResults.map((p) => (
                <CommandItem
                  key={`prod-${p.id}`}
                  value={`producto ${p.name} ${p.sku ?? ""}`}
                  onSelect={() => goToProduct(p)}
                  className="flex items-center gap-2"
                >
                  <PackageSearch className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.sku && (
                    <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[30%]">{p.sku}</span>
                  )}
                  {!p.is_active && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">inactivo</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {groupOrder.map((g, idx) => (
          <div key={g}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={g}>
              {grouped[g].map((a) => {
                const Icon = a.icon;
                return (
                  <CommandItem
                    key={a.id}
                    value={`${a.label} ${a.group} ${a.keywords ?? ""}`}
                    onSelect={() => run(a)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{a.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[40%]">{a.to}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
