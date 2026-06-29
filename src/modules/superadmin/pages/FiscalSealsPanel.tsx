import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ShieldAlert, RefreshCw, Hash } from "lucide-react";
import { toast } from "sonner";

interface Register { id: string; name: string }
interface ChainRow {
  sequence: number;
  seal_id: string;
  cash_session_id: string;
  current_hash: string;
  expected_prev_hash: string | null;
  stored_prev_hash: string | null;
  ok: boolean;
}

export default function FiscalSealsPanel() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? "";
  const [registerId, setRegisterId] = useState<string>("");

  const { data: registers, isLoading: loadingRegs } = useQuery({
    queryKey: ["fiscal-seals-registers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("id,name")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Register[];
    },
  });

  const { data: chain, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["fiscal-seals-chain", registerId],
    enabled: !!registerId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("cash_session_verify_chain", {
        _register_id: registerId,
        _limit: 200,
      });
      if (error) throw error;
      return (data ?? []) as ChainRow[];
    },
  });

  const broken = (chain ?? []).filter((r) => !r.ok);
  const integrityOk = chain && chain.length > 0 && broken.length === 0;

  if (!currentOrg) {
    return (
      <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
        Selecciona una tienda en el menú lateral para auditar sus sellos fiscales.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> Sellos fiscales por turno — {currentOrg.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada cierre Z genera un sello SHA-256 encadenado al anterior. Verifica la integridad de la cadena.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 border border-border rounded-lg p-4 bg-card">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs font-medium text-muted-foreground">Caja</label>
          {loadingRegs ? (
            <Skeleton className="h-10 w-full mt-1" />
          ) : (
            <select
              className="w-full border border-border rounded-md p-2 bg-background text-sm mt-1"
              value={registerId}
              onChange={(e) => setRegisterId(e.target.value)}
            >
              <option value="">— Selecciona una caja —</option>
              {(registers ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => { refetch(); toast.message("Re-verificando cadena…"); }}
          disabled={!registerId || isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Verificar
        </Button>
      </div>

      {registerId && (
        <>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !chain || chain.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
              Esta caja aún no tiene sellos. Cierra al menos un turno para empezar la cadena.
            </div>
          ) : (
            <>
              <div
                className={`rounded-lg p-4 flex items-center gap-3 border ${
                  integrityOk ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"
                }`}
              >
                {integrityOk ? (
                  <ShieldCheck className="w-6 h-6 text-success" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-destructive" />
                )}
                <div className="text-sm">
                  <div className="font-semibold">
                    {integrityOk
                      ? `Cadena íntegra · ${chain.length} sello(s)`
                      : `Cadena ROTA · ${broken.length} eslabón(es) inconsistente(s)`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Último sello: #{chain[chain.length - 1].sequence}
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Hash actual</th>
                      <th className="text-left p-2">Hash previo (almacenado)</th>
                      <th className="text-left p-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chain.map((row) => (
                      <tr key={row.seal_id} className="border-t border-border">
                        <td className="p-2 font-medium">{row.sequence}</td>
                        <td className="p-2 font-mono text-[11px] flex items-center gap-1">
                          <Hash className="w-3 h-3 text-muted-foreground" />
                          {row.current_hash.slice(0, 16)}…
                        </td>
                        <td className="p-2 font-mono text-[11px] text-muted-foreground">
                          {row.stored_prev_hash ? row.stored_prev_hash.slice(0, 16) + "…" : "— (génesis)"}
                        </td>
                        <td className="p-2">
                          {row.ok ? (
                            <Badge variant="outline" className="border-success/40 text-success">OK</Badge>
                          ) : (
                            <Badge variant="destructive">ROTO</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
