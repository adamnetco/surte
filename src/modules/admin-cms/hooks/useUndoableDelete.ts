/**
 * Ola 6 — Slice H (AC11)
 * Borrado optimista con "Deshacer" en toast (sonner).
 *
 * Flujo:
 *  1. Snapshot del cache + remove inmediato (UI responde en <16ms).
 *  2. Toast con acción "Deshacer" (5s).
 *  3. Si NO se deshace, se ejecuta el DELETE real contra Supabase.
 *  4. Si se deshace, se restaura el snapshot y no hay round-trip.
 *
 * Pensado para listas administradas por `useQuery` con query-key estable.
 */
import { useCallback, useRef } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errorToMessage } from "@/lib/errors";

interface Options {
  queryClient: QueryClient;
  queryKey: QueryKey;
  table: string;
  /** Texto del toast de éxito (e.g. "Marca eliminada"). */
  label: string;
  /** Invalidaciones adicionales tras commit (consumers públicos, etc). */
  invalidateOnCommit?: QueryKey[];
  /** Ventana para deshacer en ms. Default 5000. */
  undoMs?: number;
}

export function useUndoableDelete({
  queryClient,
  queryKey,
  table,
  label,
  invalidateOnCommit,
  undoMs = 5000,
}: Options) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  return useCallback(
    (id: string) => {
      const previous = queryClient.getQueryData<any[]>(queryKey);
      queryClient.setQueryData<any[] | undefined>(queryKey, (old) =>
        old?.filter((row) => row.id !== id),
      );

      let undone = false;
      const commit = async () => {
        timers.current.delete(id);
        if (undone) return;
        const { error } = await supabase.from(table as any).delete().eq("id", id);
        if (error) {
          queryClient.setQueryData(queryKey, previous);
          toast.error(errorToMessage(error));
          return;
        }
        invalidateOnCommit?.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
      };

      const t = setTimeout(commit, undoMs);
      timers.current.set(id, t);

      toast.success(label, {
        duration: undoMs,
        action: {
          label: "Deshacer",
          onClick: () => {
            undone = true;
            const pending = timers.current.get(id);
            if (pending) {
              clearTimeout(pending);
              timers.current.delete(id);
            }
            queryClient.setQueryData(queryKey, previous);
            toast.info("Eliminación cancelada");
          },
        },
      });
    },
    [queryClient, queryKey, table, label, invalidateOnCommit, undoMs],
  );
}
