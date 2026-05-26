import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useOrganization } from "@/context/OrganizationContext";
import { toast } from "sonner";
import { Loader2, LockKeyhole } from "lucide-react";
import OpenSessionPanel from "@/components/pos/OpenSessionPanel";
import POSWorkspace from "@/components/pos/POSWorkspace";
import POSErrorBoundary from "@/components/pos/POSErrorBoundary";

interface Location { id: string; name: string; }
interface Register { id: string; name: string; location_id: string; }
interface Session {
  id: string; location_id: string; cash_register_id: string;
  opening_amount: number; opened_at: string; status: string;
}

export default function POS() {
  const { user, loading: authLoading } = useAuth();
  const { currentOrg, hasModule, loading: orgLoading } = useOrganization();
  const navigate = useNavigate();

  const [locations, setLocations] = useState<Location[]>([]);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    document.title = "POS · SurteYa";
  }, []);

  const orgId = currentOrg?.id;

  const load = async () => {
    if (!orgId || !user) return;
    setLoading(true);
    const [{ data: locs }, { data: regs }, { data: ses }] = await Promise.all([
      supabase.from("locations").select("id,name").eq("organization_id", orgId).eq("is_active", true).order("name"),
      supabase.from("cash_registers").select("id,name,location_id").eq("organization_id", orgId).eq("is_active", true),
      supabase.from("cash_sessions").select("id,location_id,cash_register_id,opening_amount,opened_at,status")
        .eq("organization_id", orgId).eq("opened_by", user.id).eq("status", "open").maybeSingle(),
    ]);
    setLocations(locs ?? []);
    setRegisters(regs ?? []);
    setActiveSession((ses as Session) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId, user?.id]);

  if (authLoading || orgLoading || loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6 text-center">
        <p className="text-muted-foreground">No tienes organización activa.</p>
      </div>
    );
  }

  if (!hasModule("pos_counter")) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <LockKeyhole className="w-8 h-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Módulo POS no activo</h1>
          <p className="text-sm text-muted-foreground">
            Activa el módulo <code className="bg-muted px-1 rounded">pos_counter</code> para tu organización.
          </p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <OpenSessionPanel
        organizationId={currentOrg.id}
        locations={locations}
        registers={registers}
        userId={user!.id}
        onOpened={(s) => setActiveSession(s)}
      />
    );
  }

  return (
    <POSWorkspace
      session={activeSession}
      organizationId={currentOrg.id}
      userId={user!.id}
      onClosed={() => { setActiveSession(null); toast.success("Sesión cerrada"); }}
    />
  );
}
