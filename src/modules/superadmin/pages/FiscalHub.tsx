import { Link, useParams } from "react-router-dom";
import { Receipt, ShieldCheck, BookOpen, FileDown, Banknote, Inbox, ArrowRight } from "lucide-react";

interface Feature {
  to: string;
  icon: typeof Receipt;
  title: string;
  desc: string;
  badge?: string;
}

export default function FiscalHub() {
  const { slug = "" } = useParams();
  const base = `/superadmin/t/${slug}/fiscal`;

  const features: Feature[] = [
    {
      to: `${base}/config`,
      icon: Receipt,
      title: "Resolución DIAN",
      desc: "Personaliza prefijos, rangos de numeración y tu resolución vigente.",
    },
    {
      to: `${base}/seals`,
      icon: ShieldCheck,
      title: "Sellos fiscales",
      desc: "Verifica la cadena SHA-256 encadenada de cada cierre Z por caja.",
      badge: "Nuevo",
    },
    {
      to: `${base}/cash-book`,
      icon: BookOpen,
      title: "Libro auxiliar de caja",
      desc: "Histórico de turnos con apertura, ventas, esperado, contado y diferencia.",
      badge: "Nuevo",
    },
    {
      to: `${base}/cash-book?export=dian`,
      icon: FileDown,
      title: "Exportar a DIAN",
      desc: "Descarga el libro auxiliar en formato CSV/TXT para reportes fiscales.",
    },
    {
      to: `${base}/seals`,
      icon: Banknote,
      title: "Arqueo & conteo ciego",
      desc: "Conteo por denominaciones con foto firmada y hash de integridad.",
    },
    {
      to: `/superadmin/t/${slug}/sync`,
      icon: Inbox,
      title: "Buzón electrónico",
      desc: "Estado de envíos, notas crédito/débito y documentos soporte DIAN.",
    },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_2fr] items-start">
      {/* Hero */}
      <div className="space-y-6 lg:sticky lg:top-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Más que solo facturación
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Centraliza el cumplimiento fiscal de tu pyme: sellos por turno,
            libro auxiliar de caja y exportes oficiales a la DIAN — todo en un
            mismo lugar.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 grid place-items-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">Cumplimiento garantizado</div>
              <div className="text-xs text-muted-foreground">Trazabilidad fiscal end-to-end</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cada cierre Z genera un sello SHA-256 inmutable encadenado al
            anterior. Auditable y reproducible en cualquier revisión DIAN.
          </p>
        </div>

        <Link
          to={`${base}/cash-book`}
          className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition px-6 py-3 text-sm font-semibold shadow-sm"
        >
          Explorar libro auxiliar
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Feature cards (2 cols) */}
      <div className="grid sm:grid-cols-2 gap-4">
        {features.map((f) => (
          <Link
            key={f.title}
            to={f.to}
            className="group relative rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition p-5 flex flex-col"
          >
            {f.badge && (
              <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {f.badge}
              </span>
            )}
            <div className="w-10 h-10 rounded-lg bg-primary/10 grid place-items-center mb-3 group-hover:bg-primary/15 transition">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold">{f.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed flex-1">
              {f.desc}
            </p>
            <span className="mt-3 text-xs font-medium text-primary inline-flex items-center gap-1 opacity-80 group-hover:opacity-100">
              Ver más <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
