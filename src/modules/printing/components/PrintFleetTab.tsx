import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Plus, Radio, Trash2, AlertTriangle } from "lucide-react";

type AgentRow = {
  id: string;
  agent_code: string;
  label: string | null;
  version: string | null;
  last_seen_at: string | null;
  last_ip: string | null;
  status: "online" | "stale" | "offline" | "never";
  seconds_since_seen: number | null;
  capabilities: any;
  printer_ids: string[];
};

const STATUS_STYLES: Record<AgentRow["status"], { label: string; className: string }> = {
  online: { label: "En línea", className: "bg-success/15 text-success border-success/30" },
  stale: { label: "Inestable", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  offline: { label: "Sin conexión", className: "bg-destructive/10 text-destructive border-destructive/30" },
  never: { label: "Sin reportes", className: "bg-muted text-muted-foreground" },
};

function fmtAgo(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `hace ${seconds}s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
  return `hace ${Math.floor(seconds / 86400)}d`;
}

interface Props {
  organizationId: string;
}

export function PrintFleetTab({ organizationId }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [issuedSecret, setIssuedSecret] = useState<{ id: string; secret: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["print_agents", organizationId],
    enabled: !!organizationId,
    refetchInterval: 15_000,
    queryFn: async (): Promise<AgentRow[]> => {
      const { data, error } = await supabase
        .from("print_agents_status" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .order("agent_code");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  useEffect(() => {
    if (!organizationId) return;
    const ch = supabase
      .channel(`print_agents:${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "print_agents", filter: `organization_id=eq.${organizationId}` },
        () => qc.invalidateQueries({ queryKey: ["print_agents", organizationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [organizationId, qc]);

  async function handleRegister() {
    if (!code.trim()) {
      toast.error("Código requerido");
      return;
    }
    const { data, error } = await supabase.rpc("print_agent_register" as any, {
      p_org: organizationId,
      p_code: code.trim(),
      p_label: label.trim() || null,
      p_printer_ids: [],
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? (data[0] as any) : (data as any);
    setIssuedSecret({ id: row.agent_id, secret: row.secret });
    setCode("");
    setLabel("");
    qc.invalidateQueries({ queryKey: ["print_agents", organizationId] });
  }

  async function handleDelete(id: string, codeLabel: string) {
    if (!window.confirm(`¿Eliminar agente "${codeLabel}"? Dejará de poder enviar heartbeats.`)) return;
    const { error } = await supabase.from("print_agents").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Agente eliminado");
    qc.invalidateQueries({ queryKey: ["print_agents", organizationId] });
  }

  function closeDialog() {
    setDialogOpen(false);
    setIssuedSecret(null);
  }

  const onlineCount = data?.filter((a) => a.status === "online").length ?? 0;
  const offlineCount = data?.filter((a) => a.status === "offline" || a.status === "never").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-heading font-semibold flex items-center gap-2">
            <Radio className="text-primary" size={20} />
            Fleet de impresión
          </h2>
          <p className="text-sm text-muted-foreground">
            Agentes registrados y su estado en tiempo real (heartbeat &lt; 60s = en línea).
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2" size={16} /> Registrar agente
            </Button>
          </DialogTrigger>
          <DialogContent>
            {!issuedSecret ? (
              <>
                <DialogHeader>
                  <DialogTitle>Registrar nuevo agente</DialogTitle>
                  <DialogDescription>
                    Generamos un secreto único que debes copiar al agente. <strong>Solo se muestra una vez.</strong>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="agent-code">Código *</Label>
                    <Input
                      id="agent-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="pos-caja-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="agent-label">Etiqueta</Label>
                    <Input
                      id="agent-label"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="PC mostrador principal"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={closeDialog}>Cancelar</Button>
                  <Button onClick={handleRegister}>Generar credenciales</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="text-amber-500" size={18} />
                    Guarda este secreto ahora
                  </DialogTitle>
                  <DialogDescription>
                    No podrás verlo de nuevo. Cópialo a la configuración del agente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Agent ID</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={issuedSecret.id} className="font-mono text-xs" />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(issuedSecret.id);
                          toast.success("Copiado");
                        }}
                      >
                        <Copy size={14} />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Secret</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={issuedSecret.secret} className="font-mono text-xs" />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(issuedSecret.secret);
                          toast.success("Copiado");
                        }}
                      >
                        <Copy size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={closeDialog}>Listo</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">{data?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">En línea</p>
            <p className="text-2xl font-semibold text-success">{onlineCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sin conexión</p>
            <p className="text-2xl font-semibold text-destructive">{offlineCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Endpoint</p>
            <p className="text-xs font-mono break-all">/functions/v1/print-agent-heartbeat</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agentes registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Cargando…</div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hay agentes registrados. Empieza con <strong>Registrar agente</strong>.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.map((a) => {
                const styles = STATUS_STYLES[a.status];
                return (
                  <li key={a.id} className="flex items-center gap-3 py-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{a.agent_code}</span>
                        <Badge variant="outline" className={styles.className}>
                          {styles.label}
                        </Badge>
                        {a.version && (
                          <span className="text-[10px] text-muted-foreground">v{a.version}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.label || "Sin etiqueta"} · {fmtAgo(a.seconds_since_seen)}
                        {a.last_ip ? ` · ${a.last_ip}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDelete(a.id, a.agent_code)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
