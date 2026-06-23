import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, Home, ChevronRight } from "lucide-react";
import { useMemo } from "react";

// Etiquetas legibles por segmento de ruta
const LABELS: Record<string, string> = {
  admin: "Admin",
  pos: "POS",
  vender: "Vender",
  fx: "Casa de Cambio",
  mesas: "Mesas",
  kds: "Cocina (KDS)",
  inventario: "Inventario",
  facturacion: "Facturación",
  "casas-de-cambio": "Casas de Cambio",
  reportes: "Reportes",
  "anti-fraude": "Anti-Fraude",
  pricing: "Pricing",
  tablero: "Tablero",
  compras: "Compras",
  "health-logs": "Health Logs",
  "gerente-ia": "Gerente IA",
  onboarding: "Onboarding",
  activacion: "Activación",
  billing: "Facturación SaaS",
  superadmin: "Superadmin",
  sitios: "Sitios",
  licencias: "Licencias",
  "catalogos-base": "Catálogos Base",
  diag: "Diagnóstico",
  "admin-diag": "Diagnóstico",
  "auth-status": "Estado Auth",
  catalogo: "Catálogo",
  carrito: "Carrito",
  categorias: "Categorías",
  menu: "Menú",
  ofertas: "Ofertas",
  producto: "Producto",
  p: "Producto",
  pedido: "Pedido",
  pedidos: "Mis Pedidos",
  favoritos: "Favoritos",
  perfil: "Perfil",
  ayuda: "Ayuda",
  configuracion: "Configuración",
  mi: "Mi cuenta",
  seguridad: "Seguridad",
  clientes: "Clientes",
  hub: "Hub",
  s: "Página",
  t: "Tenant",
  planes: "Planes",
  politicas: "Políticas",
  "tratamiento-datos": "Tratamiento de Datos",
  "reset-password": "Restablecer Contraseña",
  login: "Iniciar Sesión",
  user: "Usuario",
};

// Rutas donde NO mostramos breadcrumbs (home, login, storefront publico)
const HIDDEN_PREFIXES = [
  "/login",
  "/user/login",
  "/admin/login",
  "/superadmin/acceso",
  "/reset-password",
  "/unsubscribe",
  "/s/",
];
const HIDDEN_EXACT = new Set(["/", "/catalogo", "/menu", "/carrito"]);

function prettify(seg: string) {
  if (LABELS[seg]) return LABELS[seg];
  // UUID o ID numérico
  if (/^[0-9a-f-]{8,}$/i.test(seg) || /^\d+$/.test(seg)) return "Detalle";
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PageBreadcrumbs() {
  const location = useLocation();
  const navigate = useNavigate();

  const hidden =
    HIDDEN_EXACT.has(location.pathname) ||
    HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));

  const crumbs = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.map((seg, i) => ({
      label: prettify(decodeURIComponent(seg)),
      to: "/" + parts.slice(0, i + 1).join("/"),
      isLast: i === parts.length - 1,
    }));
  }, [location.pathname]);

  if (hidden || crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Migas de pan"
      className="sticky top-0 z-30 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 text-sm sm:px-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Volver atrás"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Atrás
        </button>

        <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <li className="flex items-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Inicio"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Inicio</span>
            </Link>
          </li>
          {crumbs.map((c) => (
            <li key={c.to} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              {c.isLast ? (
                <span
                  className="truncate font-medium text-foreground"
                  aria-current="page"
                >
                  {c.label}
                </span>
              ) : (
                <Link
                  to={c.to}
                  className="truncate rounded px-1.5 py-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  {c.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

export default PageBreadcrumbs;
