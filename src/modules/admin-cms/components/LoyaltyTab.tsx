import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gift, Save, Coins, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const fmtCop = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

type Program = {
  id?: string;
  mode: "points" | "cashback";
  accrual_rate: number;
  redemption_rate: number;
  min_redemption: number;
  expiration_days: number | null;
  is_active: boolean;
};

const DEFAULT: Program = {
  mode: "points",
  accrual_rate: 1,
  redemption_rate: 1,
  min_redemption: 100,
  expiration_days: 365,
  is_active: true,
};

const LoyaltyTab = () => {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const [form, setForm] = useState<Program | null>(null);

  const { data: program, isLoading } = useQuery({
    queryKey: ["loyalty-program", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_programs")
        .select("*")
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      const p = (data || { ...DEFAULT }) as Program;
      setForm(p);
      return p;
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["loyalty-accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_accounts")
        .select("id,profile_id,points_earned,points_redeemed,balance,last_activity_at,profiles!inner(full_name,phone,customer_code)")
        .eq("organization_id", orgId!)
        .order("balance", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form || !orgId) return;
      const payload = { ...form, organization_id: orgId };
      const { error } = program?.id
        ? await supabase.from("loyalty_programs").update(payload).eq("id", program.id)
        : await supabase.from("loyalty_programs").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Programa guardado");
      qc.invalidateQueries({ queryKey: ["loyalty-program", orgId] });
    },
    onError: (e: any) => toast.error(e.message || "Error al guardar"),
  });

  const totalBalance = (accounts || []).reduce((acc, a: any) => acc + Number(a.balance || 0), 0);
  const totalLiability = form ? totalBalance * form.redemption_rate : 0;

  if (isLoading || !form) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Programa de fidelización</h2>
        <Badge variant={form.is_active ? "default" : "secondary"} className="ml-2">
          {form.is_active ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard icon={<Coins className="h-4 w-4" />} label="Clientes activos" value={String(accounts?.length || 0)} />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Puntos en circulación" value={totalBalance.toLocaleString("es-CO")} />
        <KpiCard icon={<Gift className="h-4 w-4" />} label="Pasivo estimado" value={fmtCop(totalLiability)} />
      </div>

      <div className="rounded-lg border border-border p-4 bg-card space-y-4">
        <h3 className="font-semibold text-sm">Configuración</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Modalidad</Label>
            <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="points">Puntos por COP</SelectItem>
                <SelectItem value="cashback">Cashback (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-2">
            <Label className="cursor-pointer">Programa activo</Label>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </div>

          <div className="space-y-1.5">
            <Label>
              {form.mode === "points" ? "Puntos por cada $1.000 COP" : "Cashback (% de la venta)"}
            </Label>
            <Input
              type="number" step="0.01" min={0}
              value={form.accrual_rate}
              onChange={(e) => setForm({ ...form, accrual_rate: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Valor en COP de 1 punto al redimir</Label>
            <Input
              type="number" step="0.01" min={0}
              value={form.redemption_rate}
              onChange={(e) => setForm({ ...form, redemption_rate: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Mínimo de puntos para redimir</Label>
            <Input
              type="number" min={0}
              value={form.min_redemption}
              onChange={(e) => setForm({ ...form, min_redemption: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Vencimiento (días, vacío = sin vencer)</Label>
            <Input
              type="number" min={0}
              value={form.expiration_days ?? ""}
              onChange={(e) => setForm({ ...form, expiration_days: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
          <Save className="h-4 w-4" /> {save.isPending ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="p-3 border-b border-border font-semibold text-sm">Top 100 clientes por saldo</div>
        {(accounts || []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Aún no hay clientes con puntos acumulados.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(accounts || []).map((a: any) => (
              <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0 pr-2">
                  <div className="truncate font-medium">{a.profiles?.full_name || "Sin nombre"}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.profiles?.customer_code || ""} {a.profiles?.phone ? `· ${a.profiles.phone}` : ""}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="font-semibold">{Number(a.balance).toLocaleString("es-CO")} pts</div>
                  <div className="text-[11px] text-muted-foreground">
                    +{Number(a.points_earned).toLocaleString("es-CO")} / −{Number(a.points_redeemed).toLocaleString("es-CO")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const KpiCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border border-border p-3 bg-card">
    <div className="text-[11px] text-muted-foreground flex items-center gap-1">{icon} {label}</div>
    <div className="text-xl font-semibold mt-1">{value}</div>
  </div>
);

export default LoyaltyTab;
