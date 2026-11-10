"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RIASEC_QUESTIONS,
  RIASEC_DIMENSIONS,
  RIASEC_SCALE,
  RIASEC_ORDER,
  type RiasecDimension,
} from "@/lib/orientation/riasec-constants";
import type { Utilisateur } from "@/lib/orientation/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  utilisateur: Utilisateur | null;
  onCompleted: (result: {
    utilisateur: Utilisateur;
    scores: Record<RiasecDimension, number>;
    dominant: RiasecDimension;
    dominantLabel: string;
    top3: Array<{ dim: RiasecDimension; label: string; score: number; description: string }>;
  }) => void;
}

export function RiasecTestDialog({ open, onOpenChange, utilisateur, onCompleted }: Props) {
  return (
    <RiasecTestDialogForm
      key={`${open ? "open" : "closed"}-${utilisateur?.id ?? "new"}`}
      open={open}
      onOpenChange={onOpenChange}
      utilisateur={utilisateur}
      onCompleted={onCompleted}
    />
  );
}

function RiasecTestDialogForm({ open, onOpenChange, utilisateur, onCompleted }: Props) {
  const [current, setCurrent] = useState(0);
  const [reponses, setReponses] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const total = RIASEC_QUESTIONS.length;
  const q = RIASEC_QUESTIONS[current];
  const progress = ((current + (reponses[String(q.ordre)] !== undefined ? 1 : 0)) / total) * 100;

  function answer(val: number) {
    const answeredQuestion = current;
    setReponses((prev) => ({ ...prev, [String(q.ordre)]: val }));
    setTimeout(() => {
      setCurrent((index) =>
        index === answeredQuestion ? Math.min(index + 1, total - 1) : index
      );
    }, 220);
  }

  async function finish() {
    if (!utilisateur) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/orientation/riasec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utilisateurId: utilisateur.id, reponses }),
      });
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      onCompleted(data);
      toast.success(`Test terminé ! Profil dominant : ${data.dominantLabel}`);
      onOpenChange(false);
    } catch {
      toast.error("Impossible d'enregistrer le test.");
    } finally {
      setSubmitting(false);
    }
  }

  const allAnswered = RIASEC_QUESTIONS.every((qq) => reponses[String(qq.ordre)] !== undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Test RIASEC
            <Badge variant="secondary" className="text-xs">
              Question {current + 1} / {total}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Indiquez votre niveau d'accord pour chaque affirmation. Soyez le plus spontané possible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Progress value={progress} className="h-2" />

          <div className="rounded-lg border bg-card p-4 min-h-[88px] flex items-center">
            <p className="text-[15px] leading-relaxed">
              <span className="text-muted-foreground mr-2 text-xs font-mono align-middle" style={{ color: RIASEC_DIMENSIONS[q.dimension].couleur }}>
                [{q.dimension}]
              </span>
              {q.enonce}
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {RIASEC_SCALE.map((s) => {
              const selected = reponses[String(q.ordre)] === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => answer(s.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-all hover:border-primary hover:bg-secondary/60 ${
                    selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background"
                  }`}
                  title={s.label}
                >
                  <span className="text-[11px] font-bold">{s.court}</span>
                  <span className="text-[10px] leading-tight">{s.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              ← Précédent
            </Button>
            <div className="space-y-1">
              <p className="text-center text-[10px] text-muted-foreground">Questions répondues par dimension</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {RIASEC_ORDER.map((d) => {
                  const answered = RIASEC_QUESTIONS.filter(
                    (qq) => qq.dimension === d && reponses[String(qq.ordre)] !== undefined
                  ).length;
                  const totalD = RIASEC_QUESTIONS.filter((qq) => qq.dimension === d).length;
                  return (
                    <span
                      key={d}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        color: answered === totalD ? "#fff" : RIASEC_DIMENSIONS[d].couleur,
                        background: answered === totalD ? RIASEC_DIMENSIONS[d].couleur : "transparent",
                        border: `1px solid ${RIASEC_DIMENSIONS[d].couleur}`,
                      }}
                      title={`${RIASEC_DIMENSIONS[d].label} : ${answered} question${answered === 1 ? "" : "s"} répondue${answered === 1 ? "" : "s"} sur ${totalD}`}
                      aria-label={`${RIASEC_DIMENSIONS[d].label} : ${answered} question${answered === 1 ? "" : "s"} répondue${answered === 1 ? "" : "s"} sur ${totalD}`}
                    >
                      {d} {answered}/{totalD}
                    </span>
                  );
                })}
              </div>
            </div>
            {current < total - 1 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
                disabled={reponses[String(q.ordre)] === undefined}
              >
                Suivant →
              </Button>
            ) : (
              <Button size="sm" onClick={finish} disabled={!allAnswered || submitting}>
                {submitting ? "Calcul…" : "Voir mes résultats ✓"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
