/**
 * Breadcrumb global + botón "Volver" reutilizable.
 *
 * UX:
 *  - Mobile: solo botón de volver (ahorra espacio).
 *  - Desktop: breadcrumb completo con rutas intermedias clickeables.
 *
 * A11y:
 *  - Usa `<nav aria-label>` y rol `list` (Breadcrumb de Radix).
 *  - El botón "Volver" tiene `aria-label` explícito y focus-ring.
 */
import { useLocation, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTE_LABELS, PARENT_ROUTE } from "@/lib/routeLabels";
import { cn } from "@/lib/utils";

interface Props {
  /** Override del label final (útil cuando el slug es dinámico, ej: nombre de tienda). */
  currentLabel?: string;
  className?: string;
}

function labelize(seg: string) {
  if (ROUTE_LABELS[seg]) return ROUTE_LABELS[seg];
  return seg.charAt(0).toUpperCase() + seg.slice(1).split("-").join(" ");
}

export function AppBreadcrumb({ currentLabel, className }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const segments = pathname.split("/").filter(Boolean);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      const fallback = PARENT_ROUTE[pathname] ?? "/pos";
      navigate(fallback);
    }
  };

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const isLast = idx === segments.length - 1;
    const label = isLast && currentLabel ? currentLabel : labelize(seg);
    return { href, label, isLast };
  });

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        aria-label="Volver a la pantalla anterior"
        className="h-9 w-9 p-0 shrink-0 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Button>

      <nav aria-label="Migas de pan" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1 text-sm text-muted-foreground overflow-hidden">
          <li className="hidden sm:flex items-center gap-1">
            <Link
              to="/pos"
              className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            >
              Inicio
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </li>
          {crumbs.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1 min-w-0">
              {c.isLast ? (
                <span
                  className="font-medium text-foreground truncate"
                  aria-current="page"
                >
                  {c.label}
                </span>
              ) : (
                <>
                  <Link
                    to={c.href}
                    className="hidden sm:inline hover:text-foreground transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
                  >
                    {c.label}
                  </Link>
                  {i < crumbs.length - 1 && (
                    <ChevronRight
                      className="hidden sm:inline h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

export default AppBreadcrumb;
