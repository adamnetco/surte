/**
 * WizardShell — shell conversacional (una pregunta por pantalla) compartido
 * por el wizard del Superadmin y el onboarding del Dueño.
 *
 * Patrón: stepper minimalista arriba, eyebrow + título + subtítulo grandes,
 * contenido animado, footer fijo con "Continuar" + atajo Enter.
 * Mobile-first, 100dvh, max-w-xl centrado.
 */
import { type ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WizardShellProps {
  /** 1-indexed current step */
  step: number;
  totalSteps: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  /** Texto suave bajo el botón principal (microcopy de seguridad). */
  reassurance?: string;
  /** Permite Enter para avanzar. true por defecto. */
  submitOnEnter?: boolean;
  /** Oculta el footer (último paso celebratorio, por ejemplo). */
  hideFooter?: boolean;
}

export function WizardShell({
  step,
  totalSteps,
  eyebrow,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "Continuar",
  nextDisabled,
  loading,
  reassurance,
  submitOnEnter = true,
  hideFooter,
}: WizardShellProps) {
  // Enter → next, Escape → back
  useEffect(() => {
    if (!submitOnEnter && !onBack) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // Permitir Enter dentro de textarea
      if (tag === "TEXTAREA") return;
      if (e.key === "Enter" && submitOnEnter && onNext && !nextDisabled && !loading) {
        e.preventDefault();
        onNext();
      } else if (e.key === "Escape" && onBack) {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack, onNext, nextDisabled, loading, submitOnEnter]);

  const progress = Math.min(100, Math.round((step / totalSteps) * 100));

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-background to-muted/40 flex flex-col">
      {/* Top bar */}
      <header className="px-4 md:px-8 py-4 flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          disabled={!onBack || loading}
          className="rounded-full"
          aria-label="Atrás"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/70"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 24 }}
            />
          </div>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground min-w-[3rem] text-right">
          {step} / {totalSteps}
        </span>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start md:items-center justify-center px-4 md:px-8 py-6">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              {eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {eyebrow}
                </p>
              ) : null}
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <div className="pt-2">{children}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      {!hideFooter && (
        <footer className="sticky bottom-0 left-0 right-0 border-t border-border/60 bg-background/80 backdrop-blur px-4 md:px-8 py-4">
          <div className="max-w-xl mx-auto flex flex-col gap-2">
            <Button
              type="button"
              size="lg"
              className={cn("w-full h-12 text-base font-semibold")}
              onClick={onNext}
              disabled={nextDisabled || loading || !onNext}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando…
                </>
              ) : (
                <>
                  {nextLabel}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
            {reassurance ? (
              <p className="text-xs text-center text-muted-foreground">{reassurance}</p>
            ) : (
              <p className="text-[11px] text-center text-muted-foreground">
                Pulsa <kbd className="px-1.5 py-0.5 rounded border text-[10px] bg-muted">Enter</kbd> para continuar
              </p>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
