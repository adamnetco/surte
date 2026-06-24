import { useLocation, useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  LayoutDashboard,
  Sparkles,
  Monitor,
  Receipt,
  ShoppingBag,
  Warehouse,
  ChefHat,
  Utensils,
  CreditCard,
  Wallet,
  Rocket,
  Activity,
  FileCheck2,
  ChevronRight,
  ChevronDown,
  LogOut,
  ArrowRightLeft,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { cn } from "@/lib/utils";

type NavLink = { path: string; label: string; icon: any };
type NavGroup = { id: string; title: string; items: NavLink[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "dia",
    title: "Tu día",
    items: [
      { path: "/admin/diario", label: "Diario", icon: Sparkles },
      { path: "/admin", label: "Panel admin", icon: LayoutDashboard },
    ],
  },
  {
    id: "operacion",
    title: "Operación",
    items: [
      { path: "/pos", label: "POS", icon: Monitor },
      { path: "/mesas", label: "Mesas", icon: Utensils },
      { path: "/kds", label: "Cocina (KDS)", icon: ChefHat },
      { path: "/facturacion", label: "Facturación", icon: Receipt },
      { path: "/admin/innapsis", label: "Innapsis DIAN", icon: FileCheck2 },
      { path: "/casas-de-cambio", label: "Casas de cambio", icon: ArrowRightLeft },
      { path: "/compras", label: "Compras", icon: ShoppingBag },
      { path: "/inventario", label: "Inventario avanzado", icon: Warehouse },
    ],
  },
  {
    id: "negocio",
    title: "Negocio",
    items: [
      { path: "/planes", label: "Planes", icon: CreditCard },
      { path: "/billing", label: "Billing", icon: Wallet },
      { path: "/onboarding", label: "Onboarding", icon: Rocket },
      { path: "/admin/health-logs", label: "Sync & salud", icon: Activity },
    ],
  },
];

const STORAGE_KEY = "sistecpos:admin-drawer:open-groups";

const isActivePath = (current: string, path: string) =>
  current === path || current.startsWith(path + "/");

const AdminMobileDrawer = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const [open, setOpen] = useState(false);

  // Grupo que contiene la ruta activa — se abre por defecto
  const activeGroupId = useMemo(() => {
    return (
      NAV_GROUPS.find((g) => g.items.some((i) => isActivePath(pathname, i.path)))?.id ?? "dia"
    );
  }, [pathname]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved && typeof saved === "object") return saved;
    } catch {
      /* noop */
    }
    return { [activeGroupId]: true };
  });

  // Garantizar que el grupo activo esté visible al navegar
  useEffect(() => {
    setExpanded((prev) => (prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }));
  }, [activeGroupId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded));
    } catch {
      /* noop */
    }
  }, [expanded]);

  const toggleGroup = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="lg:hidden text-white/80 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88vw] max-w-sm p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-base font-heading">
            SURTÉ <span className="text-surte-naranja">YA</span>
          </SheetTitle>
          {user?.email && (
            <p className="text-[11px] text-muted-foreground truncate text-left">
              {user.email}
            </p>
          )}
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_GROUPS.map((group) => {
            const isOpen = !!expanded[group.id];
            const groupHasActive = group.items.some((i) => isActivePath(pathname, i.path));
            return (
              <div key={group.id} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  aria-controls={`group-${group.id}`}
                  className={cn(
                    "w-full flex items-center justify-between px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-wider transition",
                    groupHasActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {group.title}
                    {groupHasActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
                    )}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn("transition-transform", isOpen ? "rotate-0" : "-rotate-90")}
                  />
                </button>

                {isOpen && (
                  <div id={`group-${group.id}`}>
                    {group.items.map(({ path, label, icon: Icon }) => {
                      const active = isActivePath(pathname, path);
                      return (
                        <button
                          key={path}
                          onClick={() => go(path)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-sm min-h-[48px] transition relative",
                            active
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground hover:bg-muted active:bg-muted/70",
                          )}
                        >
                          {active && (
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                          )}
                          <Icon
                            size={18}
                            className={cn(
                              "shrink-0",
                              active ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          <span className="flex-1 text-left">{label}</span>
                          <ChevronRight
                            size={16}
                            className={cn(
                              active ? "text-primary/70" : "text-muted-foreground/60",
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t p-2">
          <button
            onClick={async () => {
              await signOut();
              setOpen(false);
              navigate("/");
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 rounded-md min-h-[48px]"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AdminMobileDrawer;
