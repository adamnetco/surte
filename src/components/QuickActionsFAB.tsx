import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, ShoppingCart, FileText, Users, Package, X, Command, Calendar, ArrowLeftRight, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

type Action = {
  id: string;
  label: string;
  icon: typeof Plus;
  to?: string;
  onClick?: () => void;
};

/**
 * Ola 6 — Slice B
 * Quick Actions FAB contextual. Floating action button that adapts
 * its options to the current route + role. Hidden on /pos (full-screen
 * workspace) and on storefront/public routes.
 */
export default function QuickActionsFAB() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  const path = location.pathname;
  const role = currentOrg?.role ?? null;

  // Hidden contexts: POS workspace, storefront, auth, onboarding
  const hidden = useMemo(() => {
    if (!user) return true;
    if (path.startsWith("/pos")) return true;
    if (path.startsWith("/user/")) return true;
    if (path.startsWith("/auth")) return true;
    if (path.startsWith("/onboarding")) return true;
    if (path === "/" || path.startsWith("/catalogo") || path.startsWith("/producto")) return true;
    return false;
  }, [path, user]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const actions = useMemo<Action[]>(() => {
    const list: Action[] = [];
    const isAdminCtx = path.startsWith("/admin") || path.startsWith("/diario");
    const isFxCtx = path.startsWith("/fx") || path.startsWith("/casas-de-cambio");
    const canAdmin = role === "owner" || role === "admin" || role === "manager";

    // Universal: open Cmd+K
    list.push({
      id: "cmdk",
      label: "Buscar (⌘K)",
      icon: Command,
      onClick: () => {
        window.dispatchEvent(new CustomEvent("open-command-palette"));
      },
    });

    if (isFxCtx) {
      list.push({ id: "fx-new", label: "Nueva operación FX", icon: ArrowLeftRight, to: "/pos/fx" });
      return list;
    }

    if (isAdminCtx && canAdmin) {
      list.push({ id: "new-order", label: "Nuevo pedido", icon: ShoppingCart, to: "/pos" });
      list.push({ id: "diario", label: "Diario", icon: Calendar, to: "/admin/diario" });
      list.push({ id: "facturacion", label: "Facturación", icon: FileText, to: "/admin/facturacion" });
      list.push({ id: "inventario", label: "Inventario", icon: Package, to: "/admin/inventario" });
      const hasPin = !!user && !!localStorage.getItem(`pos:pin:${user.id}`);
      list.push({
        id: "lock",
        label: hasPin ? "Bloquear pantalla" : "Configurar PIN",
        icon: hasPin ? Lock : ShieldCheck,
        onClick: () => {
          window.dispatchEvent(new Event(hasPin ? "pin-lock:lock" : "pin-lock:setup"));
        },
      });
      return list;
    }

    // Default authenticated (client/portal)
    list.push({ id: "pedidos", label: "Mis pedidos", icon: ShoppingCart, to: "/mis-pedidos" });
    list.push({ id: "perfil", label: "Perfil", icon: Users, to: "/perfil" });
    return list;
  }, [path, role, user]);

  if (hidden) return null;

  return (
    <div
      data-tour="quick-actions"
      className="fixed bottom-20 right-4 z-[55] md:bottom-6 md:right-6 print:hidden"
    >

      {/* Action menu */}
      {open && (
        <div className="mb-3 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => {
                  setOpen(false);
                  if (a.onClick) a.onClick();
                  else if (a.to) navigate(a.to);
                }}
                className="group flex items-center gap-2 rounded-full bg-card border border-border shadow-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                aria-label={a.label}
              >
                <span className="text-foreground">{a.label}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Cerrar acciones rápidas" : "Acciones rápidas"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
