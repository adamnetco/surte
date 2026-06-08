import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, HelpCircle, Clock, RefreshCw, Trash2, FileText, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  CLOUD_TASKS,
  loadHistory,
  appendHistory,
  clearHistory,
  type CloudTask,
  type EnvKey,
  type EnvResult,
  type HistoryEntry,
  type TaskStatus,
} from "@/modules/superadmin/lib/cloudTasks";

/**
 * Panel de estado de tareas Lovable Cloud pendientes.
 * - Lista cada tarea (migración / seed / secret / edge fn / UI / dominio).
 * - Verifica su estado en Test y Live con un checker liviano.
 * - Guarda historial local de cada chequeo + permite reintentar.
 *
 * Diseño: pure frontend. Sin escritura en DB; el reintento solo re-ejecuta el
 * checker. Para correr realmente la tarea, el usuario usa los botones de acción
 * (que abren el archivo de referencia o copian la instrucción).
 */

type Results = Record<string, Partial<Record<EnvKey, EnvResult>>>;

const STATUS_META: Record<TaskStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  done: { label: "Listo", cls: "text-success bg-success/10 border-success/30", Icon: CheckCircle2 },
  pending: { label: "Pendiente", cls: "text-accent bg-accent/10 border-accent/30", Icon: Clock },
  partial: { label: "Parcial", cls: "text-accent bg-accent/10 border-accent/30", Icon: AlertCircle },
  error: { label: "Error", cls: "text-destructive bg-destructive/10 border-destructive/30", Icon: AlertCircle },
  unknown: { label: "Sin datos", cls: "text-muted-foreground bg-muted border-border", Icon: HelpCircle },
};

const GROUP_LABEL: Record<CloudTask["group"], string> = {
  migration: "Migración",
  seed: "Seed",
  secret: "Secret",
  edge_function: "Edge function",
  ui: "UI",
  domain: "Dominio",
};

export default function CloudTasksStatusPage() {
  const [results, setResults] = useState<Results>({});
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  const runCheck = async (task: CloudTask, env: EnvKey) => {
    const key = `${task.id}:${env}`;
    setRunning((s) => new Set(s).add(key));
    try {
      const res = await task.check(env);
      setResults((r) => ({ ...r, [task.id]: { ...(r[task.id] ?? {}), [env]: res } }));
      const entry: HistoryEntry = { taskId: task.id, env, status: res.status, detail: res.detail, at: res.checkedAt };
      appendHistory(entry);
      setHistory((h) => [entry, ...h].slice(0, 200));
    } catch (e: any) {
      toast.error(`Falló verificación: ${e?.message ?? "error"}`);
    } finally {
      setRunning((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  const runAll = async (env: EnvKey) => {
    toast.info(`Verificando ${CLOUD_TASKS.length} tareas en ${env === "test" ? "Test" : "Live"}…`);
    await Promise.all(CLOUD_TASKS.map((t) => runCheck(t, env)));
  };

  useEffect(() => {
    // Auto-check inicial en Test (cheap, no spam).
    runAll("test");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const counts: Record<TaskStatus, number> = { done: 0, pending: 0, partial: 0, error: 0, unknown: 0 };
    for (const t of CLOUD_TASKS) {
      const s = results[t.id]?.test?.status ?? "unknown";
      counts[s] += 1;
    }
    return counts;
  }, [results]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold flex items-center gap-2">
            <Zap size={18} className="text-primary" /> Estado de tareas Cloud
          </h1>
          <p className="text-sm text-muted-foreground">
            Migraciones, seeds, secrets y edge functions pendientes. Verifica si ya corrieron en Test y Live.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => runAll("test")} className="btn-surte text-xs px-3 py-1.5 flex items-center gap-1.5">
            <RefreshCw size={12} /> Re-verificar Test
          </button>
          <button
            onClick={() => runAll("live")}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted flex items-center gap-1.5"
          >
            <RefreshCw size={12} /> Verificar Live
          </button>
        </div>
      </header>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => {
          const meta = STATUS_META[s];
          return (
            <div key={s} className={`rounded-lg border px-3 py-2 ${meta.cls}`}>
              <div className="flex items-center gap-1.5 text-xs">
                <meta.Icon size={12} /> {meta.label}
              </div>
              <p className="font-heading text-xl font-bold mt-0.5">{summary[s]}</p>
            </div>
          );
        })}
      </div>

      {/* Lista de tareas */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {CLOUD_TASKS.map((task) => {
          const testRes = results[task.id]?.test;
          const liveRes = results[task.id]?.live;
          return (
            <div key={task.id} className="p-4 grid gap-3 md:grid-cols-[1fr_auto] items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {GROUP_LABEL[task.group]}
                  </span>
                  <h3 className="font-medium text-sm">{task.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                {task.reference && (
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <FileText size={10} /> {task.reference}
                  </p>
                )}
                {task.howToRun && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 italic">→ {task.howToRun}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5 md:items-end text-xs">
                <EnvBadge env="test" res={testRes} busy={running.has(`${task.id}:test`)} onRetry={() => runCheck(task, "test")} />
                <EnvBadge env="live" res={liveRes} busy={running.has(`${task.id}:live`)} onRetry={() => runCheck(task, "live")} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Historial */}
      <section className="rounded-xl border border-border bg-card">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-heading font-semibold text-sm">Historial de verificaciones ({history.length})</h2>
          <button
            onClick={() => {
              clearHistory();
              setHistory([]);
              toast.success("Historial limpio");
            }}
            className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
          >
            <Trash2 size={11} /> Limpiar
          </button>
        </header>
        {history.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">Sin verificaciones aún.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y divide-border">
            {history.slice(0, 50).map((h, i) => {
              const meta = STATUS_META[h.status];
              const task = CLOUD_TASKS.find((t) => t.id === h.taskId);
              return (
                <li key={i} className="px-4 py-2 text-xs flex items-center gap-2">
                  <meta.Icon size={12} className={meta.cls.split(" ")[0]} />
                  <span className="font-mono text-[10px] text-muted-foreground w-32 shrink-0">
                    {new Date(h.at).toLocaleString()}
                  </span>
                  <span className="text-[10px] uppercase px-1 rounded bg-muted text-muted-foreground">
                    {h.env}
                  </span>
                  <span className="font-medium truncate">{task?.title ?? h.taskId}</span>
                  <span className="text-muted-foreground truncate ml-auto">{h.detail}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function EnvBadge({
  env,
  res,
  busy,
  onRetry,
}: {
  env: EnvKey;
  res?: EnvResult;
  busy: boolean;
  onRetry: () => void;
}) {
  const status = res?.status ?? "unknown";
  const meta = STATUS_META[status];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase text-muted-foreground w-9">{env}</span>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] ${meta.cls}`}>
        <meta.Icon size={10} /> {meta.label}
      </span>
      <span className="text-[10px] text-muted-foreground max-w-[220px] truncate" title={res?.detail}>
        {res?.detail ?? "—"}
      </span>
      <button
        onClick={onRetry}
        disabled={busy}
        className="text-muted-foreground hover:text-foreground disabled:opacity-50"
        title="Reintentar verificación"
      >
        <RefreshCw size={11} className={busy ? "animate-spin" : ""} />
      </button>
    </div>
  );
}
