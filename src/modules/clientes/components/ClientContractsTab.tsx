import { useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ExternalLink, ScrollText } from "lucide-react";

interface Contract {
  id: string;
  title: string;
  contract_type: string;
  signed_at: string | null;
  expires_at: string | null;
  pdf_url: string | null;
  status: string;
  notes: string | null;
}

const typeLabels: Record<string, string> = {
  sla_soporte: "SLA de Soporte",
  licencia: "Licencia",
  otro: "Otro",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Vigente", className: "bg-green-600 text-white" },
  expired: { label: "Vencido", className: "bg-destructive text-destructive-foreground" },
  cancelled: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

export default function ClientContractsTab() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("contracts").select("*")
      .order("signed_at", { ascending: false })
      .then(({ data }: any) => {
        setContracts((data as Contract[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Mis Contratos</h3>
      </div>

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No tienes contratos registrados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => {
            const st = statusConfig[c.status] ?? statusConfig.active;
            return (
              <Card key={c.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium truncate">{c.title}</h4>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {typeLabels[c.contract_type] ?? c.contract_type}
                        </Badge>
                        <Badge className={st.className}>{st.label}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                        {c.signed_at && <span>Firmado: {new Date(c.signed_at).toLocaleDateString("es-CO")}</span>}
                        {c.expires_at && <span>Vence: {new Date(c.expires_at).toLocaleDateString("es-CO")}</span>}
                      </div>
                    </div>
                    {c.pdf_url && (
                      <Button variant="outline" size="sm" asChild className="shrink-0">
                        <a href={c.pdf_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Ver PDF
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
