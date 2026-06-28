import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

interface DunningCase {
  id: string;
  status: string;
  attempt_count: number;
  next_retry_at: string | null;
  grace_until: string | null;
  total_amount_cop: number | null;
}

/**
 * Ola 18 · Slice 3 — Banner global de morosidad.
 * Se muestra cuando la organización actual tiene un dunning_case status='open'
 * (independiente del estado de la suscripción, que ya cubre SubscriptionStatusBanner).
 */
export function DunningBanner() {
  const { currentOrg } = useOrganization();
  const [c, setC] = useState<DunningCase | null>(null);

  useEffect(() => {
    if (!currentOrg?.id) {
      setC(null);
      return;
    }
    let alive = true;

    const load = async () => {
      const { data } = await supabase
        .from("dunning_cases")
        .select("id, status, attempt_count, next_retry_at, grace_until, total_amount_cop")
        .eq("organization_id", currentOrg.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (alive) setC((data as DunningCase) ?? null);
    };

    load();
    const ch = supabase
      .channel(`dunning-${currentOrg.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dunning_cases", filter: `organization_id=eq.${currentOrg.id}` },
        load,
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [currentOrg?.id]);

  if (!c) return null;

  const monto = c.total_amount_cop
    ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
        Number(c.total_amount_cop),
      )
    : null;
  const grace = c.grace_until ? new Date(c.grace_until) : null;
  const diasGracia = grace ? Math.max(0, Math.ceil((grace.getTime() - Date.now()) / 86400000)) : null;
  const tone = diasGracia !== null && diasGracia <= 2 ? "danger" : "warn";

  const bg = tone === "danger" ? "bg-red-600" : "bg-orange-500";

  return (
    <div className={`${bg} text-white text-sm`}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
        <AlertOctagon className="w-4 h-4 flex-shrink-0" />
        <span>
          Pago vencido{monto ? ` por ${monto}` : ""}. Intento {c.attempt_count}/4
          {diasGracia !== null ? ` · ${diasGracia} día${diasGracia === 1 ? "" : "s"} de gracia restantes` : ""}.
        </span>
        <Link to="/billing/recover" className="ml-auto underline font-semibold">
          Actualizar método de pago
        </Link>
      </div>
    </div>
  );
}
