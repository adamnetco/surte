import { Wifi, WifiOff, CloudUpload } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { flushOutbox } from "@/lib/offline/outbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function OfflineIndicator({ compact = false }: { compact?: boolean }) {
  const { online, pending } = useOnlineStatus();

  const handleSync = async () => {
    const { sent, failed } = await flushOutbox();
    if (sent > 0) toast.success(`${sent} operación(es) sincronizadas`);
    if (failed > 0) toast.error(`${failed} fallaron, reintentaremos`);
    if (sent === 0 && failed === 0) toast.info("Sin operaciones pendientes");
  };

  if (online && pending === 0) {
    return compact ? null : (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <Wifi className="h-3 w-3" /> En línea
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-md border bg-amber-50 px-2 py-1 text-xs text-amber-900">
      {online ? <CloudUpload className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      <span>{online ? `${pending} pendientes` : `Sin conexión${pending ? ` · ${pending} en cola` : ""}`}</span>
      {online && pending > 0 && (
        <Button size="sm" variant="ghost" className="h-5 px-1 text-xs" onClick={handleSync}>
          Sincronizar
        </Button>
      )}
    </div>
  );
}
