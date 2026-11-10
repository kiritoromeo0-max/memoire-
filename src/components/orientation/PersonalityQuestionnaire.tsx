"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Utilisateur } from "@/lib/orientation/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  utilisateur: Utilisateur | null;
  onSaved: (u: Utilisateur) => void;
}

const QUESTIONS = [
  {
    key: "ambition" as const,
    label: "Quel est votre niveau d'ambition professionnelle ?",
    options: [
      { value: "1", label: "Prudent — je préfère la sécurité" },
      { value: "2", label: "Modéré" },
      { value: "3", label: "Équilibré" },
      { value: "4", label: "Ambitieux" },
      { value: "5", label: "Très ambitieux — je vise haut" },
    ],
  },
  {
    key: "rythme" as const,
    label: "Quel rythme de travail vous convient le mieux ?",
    options: [
      { value: "1", label: "Lent et méthodique" },
      { value: "2", label: "Plutôt calme" },
      { value: "3", label: "Modéré" },
      { value: "4", label: "Soutenu" },
      { value: "5", label: "Rapide et intense" },
    ],
  },
  {
    key: "autonomie" as const,
    label: "Comment préférez-vous travailler ?",
    options: [
      { value: "1", label: "Très encadré(e) — j'ai besoin de directives" },
      { value: "2", label: "Plutôt encadré(e)" },
      { value: "3", label: "Mixte" },
      { value: "4", label: "Plutôt autonome" },
      { value: "5", label: "Très autonome — j'aime décider seul(e)" },
    ],
  },
  {
    key: "styleTravail" as const,
    label: "Préférez-vous travailler seul ou en équipe ?",
    options: [
      { value: "solo", label: "Plutôt seul" },
      { value: "mixte", label: "Mixte (parfois seul, parfois en équipe)" },
      { value: "equipe", label: "Plutôt en équipe" },
    ],
  },
  {
    key: "toleranceStress" as const,
    label: "Comment gérez-vous le stress et la pression ?",
    options: [
      { value: "1", label: "Mal — le stress me bloque" },
      { value: "2", label: "Difficilement" },
      { value: "3", label: "Moyennement" },
      { value: "4", label: "Bien" },
      { value: "5", label: "Très bien — je suis performant(e) sous pression" },
    ],
  },
];

function buildAnswers(utilisateur: Utilisateur | null): Record<string, string> {
  return {
    ambition: utilisateur?.ambition?.toString() ?? "",
    rythme: utilisateur?.rythme?.toString() ?? "",
    autonomie: utilisateur?.autonomie?.toString() ?? "",
    styleTravail: utilisateur?.styleTravail ?? "",
    toleranceStress: utilisateur?.toleranceStress?.toString() ?? "",
  };
}

export function PersonalityQuestionnaire({ open, onOpenChange, utilisateur, onSaved }: Props) {
  return (
    <PersonalityQuestionnaireForm
      key={`${open ? "open" : "closed"}-${utilisateur?.id ?? "new"}`}
      open={open}
      onOpenChange={onOpenChange}
      utilisateur={utilisateur}
      onSaved={onSaved}
    />
  );
}

function PersonalityQuestionnaireForm({ open, onOpenChange, utilisateur, onSaved }: Props) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => buildAnswers(utilisateur));
  const [saving, setSaving] = useState(false);

  const total = QUESTIONS.length;
  const q = QUESTIONS[current];
  const progress = ((current + (answers[q.key] ? 1 : 0)) / total) * 100;

  function answer(val: string) {
    setAnswers((prev) => ({ ...prev, [q.key]: val }));
    setTimeout(() => {
      if (current < total - 1) setCurrent((c) => c + 1);
    }, 200);
  }

  async function save() {
    if (!utilisateur) return;
    setSaving(true);
    try {
      const res = await fetch("/api/orientation/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: utilisateur.id,
          ambition: answers.ambition ? parseInt(answers.ambition) : null,
          rythme: answers.rythme ? parseInt(answers.rythme) : null,
          autonomie: answers.autonomie ? parseInt(answers.autonomie) : null,
          styleTravail: answers.styleTravail || null,
          toleranceStress: answers.toleranceStress ? parseInt(answers.toleranceStress) : null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onSaved(updated);
      toast.success("Profil de personnalité enregistré ! L'IA adaptera ses recommandations.");
      onOpenChange(false);
    } catch {
      toast.error("Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  const allAnswered = QUESTIONS.every((qq) => answers[qq.key]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Questionnaire de personnalité
            <span className="text-xs text-muted-foreground font-normal">
              {current + 1} / {total}
            </span>
          </DialogTitle>
          <DialogDescription>
            Ce questionnaire court aide l'IA à adapter ses recommandations à votre personnalité.
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-2" />

        <div className="space-y-3 py-1">
          <div>
            <Label className="text-sm font-medium mb-2 block">{q.label}</Label>
            <div className="space-y-1.5">
              {q.options.map((opt) => {
                const selected = answers[q.key] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => answer(opt.value)}
                    className={`w-full text-left p-2.5 rounded-lg border text-sm transition-all ${
                      selected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}>
                        {selected && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                      </div>
                      <span>{opt.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              ← Précédent
            </Button>
            {current < total - 1 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
                disabled={!answers[q.key]}
              >
                Suivant →
              </Button>
            ) : (
              <Button size="sm" onClick={save} disabled={!allAnswered || saving}>
                {saving ? "Enregistrement…" : "Terminer ✓"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
