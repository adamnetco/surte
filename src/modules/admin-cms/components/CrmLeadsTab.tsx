import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, Building2, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-accent text-accent-foreground",
  contacted: "bg-primary text-primary-foreground",
  qualified: "bg-secondary text-secondary-foreground",
  won: "bg-emerald-600 text-white",
  lost: "bg-muted text-muted-foreground",
};

export default function CrmLeadsTab() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-muted-foreground p-4">Cargando leads…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-bold">CRM · Leads sistecpos.com</h2>
        <Badge variant="outline">{leads?.length ?? 0} leads</Badge>
      </div>

      {(!leads || leads.length === 0) && (
        <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
          Aún no llegan leads. Conecta el formulario de sistecpos.com a la edge function <code>lead-capture</code>.
        </div>
      )}

      <div className="grid gap-3">
        {leads?.map((l: any) => (
          <div key={l.id} className="p-4 rounded-lg border bg-card flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{l.full_name}</p>
                {l.business_name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 size={12} /> {l.business_name} {l.business_type ? `· ${l.business_type}` : ""}
                  </p>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[l.status] ?? "bg-muted"}`}>
                {l.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {l.email && (
                <a href={`mailto:${l.email}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Mail size={14} /> {l.email}
                </a>
              )}
              {l.phone && (
                <a href={`https://wa.me/57${l.phone}`} target="_blank" className="flex items-center gap-1 text-primary hover:underline">
                  <Phone size={14} /> {l.phone}
                </a>
              )}
              {l.plan_interest && <Badge variant="secondary">{l.plan_interest}</Badge>}
              {l.source && <Badge variant="outline">{l.source}</Badge>}
            </div>
            {l.message && <p className="text-sm text-muted-foreground">{l.message}</p>}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar size={12} /> {new Date(l.created_at).toLocaleString("es-CO")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
