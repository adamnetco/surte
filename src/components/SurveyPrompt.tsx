import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { X } from "lucide-react";

interface Pending {
  invite_id: string;
  campaign_id: string;
  code: string;
  type: "nps" | "csat" | "ces" | "custom";
  question: string;
  follow_up_question: string | null;
}

const NPS_LABELS = { 0: "Nada probable", 10: "Muy probable" };
const CSAT_LABELS = ["😞", "🙁", "😐", "🙂", "😍"];

export default function SurveyPrompt() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data, error } = await supabase.rpc("get_pending_survey");
      if (error || cancelled) return;
      const row = (data as Pending[] | null)?.[0];
      if (row) setPending(row);
    };
    // Defer to avoid competing with first-paint
    const t = setTimeout(load, 2500);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  const close = () => {
    setPending(null);
    setScore(null);
    setComment("");
  };

  const dismiss = async () => {
    if (!pending) return;
    await supabase.rpc("dismiss_survey_invite", { p_invite_id: pending.invite_id });
    close();
  };

  const submit = async () => {
    if (!pending || score === null) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_survey_response", {
      p_invite_id: pending.invite_id,
      p_score: score,
      p_comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("No pudimos enviar tu respuesta", { description: error.message });
      return;
    }
    toast.success("¡Gracias por tu opinión!");
    close();
  };

  if (!pending) return null;

  const isNps = pending.type === "nps";
  const range = isNps ? Array.from({ length: 11 }, (_, i) => i) : [1, 2, 3, 4, 5];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent"
          aria-label="Cerrar encuesta"
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold pr-6">{pending.question}</DialogTitle>
          {isNps && (
            <DialogDescription className="text-xs">
              0 = Nada probable · 10 = Muy probable
            </DialogDescription>
          )}
        </DialogHeader>

        {isNps ? (
          <div className="grid grid-cols-11 gap-1">
            {range.map((n) => (
              <button
                key={n}
                onClick={() => setScore(n)}
                className={`h-10 rounded-md border text-sm font-medium transition ${
                  score === n
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-accent"
                }`}
                aria-label={`Puntaje ${n}`}
              >
                {n}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex justify-between gap-2">
            {range.map((n) => (
              <button
                key={n}
                onClick={() => setScore(n)}
                className={`flex-1 h-14 rounded-md border text-2xl transition ${
                  score === n ? "bg-primary/10 border-primary" : "border-border hover:bg-accent"
                }`}
                aria-label={`Puntaje ${n}`}
              >
                {CSAT_LABELS[n - 1]}
              </button>
            ))}
          </div>
        )}

        {score !== null && (
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={pending.follow_up_question || "Cuéntanos más (opcional)"}
            rows={3}
            maxLength={500}
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={dismiss} disabled={submitting}>
            Ahora no
          </Button>
          <Button onClick={submit} disabled={score === null || submitting}>
            {submitting ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
