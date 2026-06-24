import { FileText, Receipt, FileCheck2, FileMinus, FileQuestion } from "lucide-react";
import { useMemo } from "react";
import { useOrgDocumentTypes, type DocumentTypeOption } from "../hooks/useOrgDocumentTypes";
import { useOrgDefaultDocTypes } from "../hooks/useOrgDefaultDocTypes";

interface Props {
  organizationId: string;
  value: string | null;                       // document_type code
  onChange: (code: string, opt: DocumentTypeOption) => void;
  module?: "pos" | "fx";
  hasCustomerId?: boolean;                    // si el cliente tiene NIT/CC, sugerir factura
  compact?: boolean;
}

function iconFor(family: string) {
  switch (family) {
    case "factura":     return FileText;
    case "equivalente": return Receipt;
    case "nota":        return FileMinus;
    case "soporte":     return FileCheck2;
    default:            return FileQuestion;
  }
}

/**
 * Selector dinámico de tipo de documento (catálogo `document_types`).
 * Reemplaza el enum cerrado. Persiste el `code` elegido.
 */
export default function DocumentTypeSelector({
  organizationId,
  value,
  onChange,
  module = "pos",
  hasCustomerId = false,
  compact = false,
}: Props) {
  const { data: options = [], isLoading } = useOrgDocumentTypes(organizationId, module);

  // Selección sugerida: si hay NIT y existe factura electrónica, sugerirla;
  // si no, usar el default de la org; si no hay default, primer item.
  const suggested = useMemo(() => {
    if (!options.length) return null;
    if (hasCustomerId) {
      const fe = options.find((o) => o.code === "factura_electronica");
      if (fe) return fe;
    }
    return options.find((o) => o.is_default) ?? options[0];
  }, [options, hasCustomerId]);

  // Auto-asignar la sugerencia cuando aún no hay valor
  if (!value && suggested) {
    queueMicrotask(() => onChange(suggested.code, suggested));
  }

  if (isLoading) {
    return <div className="h-9 rounded-md bg-muted/50 animate-pulse" aria-label="Cargando tipos de documento" />;
  }
  if (!options.length) {
    return (
      <div className="text-[11px] text-muted-foreground border border-dashed rounded-md p-2">
        Sin tipos de documento configurados. Actívalos en <span className="font-semibold">Admin · Facturación</span>.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        Tipo de documento
      </div>
      <div className={`grid gap-1.5 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {options.map((opt) => {
          const Icon = iconFor(opt.family);
          const active = value === opt.code;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.code, opt)}
              className={`inline-flex items-center gap-1.5 px-2 h-9 rounded-md border text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-left ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-accent/20 border-border text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{opt.label}</span>
              {opt.dian_code && (
                <span className={`ml-auto text-[10px] font-mono ${active ? "opacity-80" : "text-muted-foreground"}`}>
                  {opt.dian_code}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {value && options.find((o) => o.code === value)?.requires_customer_id && !hasCustomerId && (
        <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1">
          Este documento requiere identificación del cliente (NIT/CC).
        </div>
      )}
    </div>
  );
}
