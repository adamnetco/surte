import { useNavigate } from "react-router-dom";
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
  LogOut,
  ArrowRightLeft,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/modules/auth/context/AuthContext";

type NavLink = { path: string; label: string; icon: any };

const NAV_GROUPS: { title: string; items: NavLink[] }[] = [
  {
    title: "Tu día",
    items: [
      { path: "/admin/diario", label: "Diario", icon: Sparkles },
      { path: "/admin", label: "Panel admin", icon: LayoutDashboard },
    ],
  },
  {
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
    title: "Negocio",
    items: [
      { path: "/planes", label: "Planes", icon: CreditCard },
      { path: "/billing", label: "Billing", icon: Wallet },
      { path: "/onboarding", label: "Onboarding", icon: Rocket },
      { path: "/admin/health-logs", label: "Sync & salud", icon: Activity },
    ],
  },
];

const AdminMobileDrawer = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [open, setOpen] = useState(false);

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
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-1">
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </p>
              {group.items.map(({ path, label, icon: Icon }) => (
                <button
                  key={path}
                  onClick={() => go(path)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted active:bg-muted/70 min-h-[48px]"
                >
                  <Icon size={18} className="text-muted-foreground shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  <ChevronRight size={16} className="text-muted-foreground/60" />
                </button>
              ))}
            </div>
          ))}
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
