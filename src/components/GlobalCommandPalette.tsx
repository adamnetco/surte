import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  BarChart3, ShoppingCart, CalendarDays, Package, Tag, Handshake, Box, Settings, FileUp,
  Users, MessageSquare, Map, Bell, FileText, Layers, Star, Globe, Search, Ticket, Code,
  MapPin, Truck, Printer, ChefHat, Monitor, Utensils, Receipt, ShoppingBag, Warehouse,
  CreditCard, Wallet, Sparkles, Rocket, Building2, Home, LayoutGrid,
} from "lucide-react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import type { AppRole } from "@/modules/auth/context/AuthContext";

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

/**
 * Paleta de comandos global (⌘K / Ctrl+K). Accesible desde cualquier pantalla.
 * Filtra acciones por rol del usuario y navega a la ruta correspondiente.
 * Las tabs del admin se abren con `?tab=<id>` que AdminDashboard sincroniza con su estado.
 */
export default function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { role, user } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // Evitar pisar el ⌘K del POS cuando esté montado: si hay un input activo dentro
        // de un dialog de cmdk, dejamos que ese lo maneje. Caso normal: abrimos global.
        const target = e.target as HTMLElement | null;
        if (target?.closest?.("[cmdk-root]")) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!user) return null;

  const allowed = ACTIONS.filter((a) => !a.roles || a.roles.includes(role));
  const grouped = allowed.reduce<Record<string, Action[]>>((acc, a) => {
    (acc[a.group] ||= []).push(a);
    return acc;
  }, {});
  const groupOrder = Array.from(new Set(allowed.map((a) => a.group)));

  const run = (a: Action) => {
    setOpen(false);
    navigate(a.to);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar tab, módulo o ruta… (⌘K)" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Sin resultados.</CommandEmpty>
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
