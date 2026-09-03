import { useCallback, useEffect, useState } from "react";
import { tiendaPlusRepository } from "@/infrastructure/database/SupabaseTiendaPlusRepository";
import type {
  TiendaPlusConnection,
  TiendaPlusSyncLogEntry,
} from "@/core/ports/ITiendaPlusRepository";

/**
 * Hook de presentación para la integración Tienda Plus.
 * Habla únicamente con el puerto (`tiendaPlusRepository`), nunca con Supabase.
 */
export function useTiendaPlus(organizationId: string | null | undefined) {
  const [connection, setConnection] = useState<TiendaPlusConnection | null>(null);
  const [log, setLog] = useState<TiendaPlusSyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [conn, entries] = await Promise.all([
        tiendaPlusRepository.getConnection(organizationId),
        tiendaPlusRepository.listLog(organizationId, 25),
      ]);
      setConnection(conn);
      setLog(entries);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void reload(); }, [reload]);

  return { connection, log, loading, error, reload, repo: tiendaPlusRepository };
}
