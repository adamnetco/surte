import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabasePosSessionRepository } from "@/infrastructure/database/SupabasePosSessionRepository";
import type {
  PosCashRegister,
  PosLocation,
  PosSession as Session,
} from "@/core/ports/IPosSessionRepository";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import OpenSessionPanel from "@/modules/pos/components/OpenSessionPanel";
import POSWorkspace from "@/modules/pos/components/POSWorkspace";
import POSErrorBoundary from "@/modules/pos/components/POSErrorBoundary";
import ModuleInactiveScreen from "@/components/ModuleInactiveScreen";

type Location = PosLocation;
type Register = PosCashRegister;

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
    document.title = `POS · ${currentOrg?.name ?? "Mi Negocio"}`;
  }, [currentOrg?.name]);

  const orgId = currentOrg?.id;

  const load = async () => {
    if (!orgId || !user) return;
    setLoading(true);
    const { locations: locs, registers: regs, activeSession: ses } =
      await supabasePosSessionRepository.loadBootstrap({
        organizationId: orgId,
        userId: user.id,
      });
    setLocations(locs);
    setRegisters(regs);
    setActiveSession(ses);
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
    return <ModuleInactiveScreen moduleKey="pos_counter" moduleLabel="POS / Caja" />;
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
    <POSErrorBoundary sessionId={activeSession?.id}>
      <POSWorkspace
        session={activeSession}
        organizationId={currentOrg.id}
        userId={user!.id}
        onClosed={() => { setActiveSession(null); toast.success("Sesión cerrada"); }}
      />
    </POSErrorBoundary>
  );
}
