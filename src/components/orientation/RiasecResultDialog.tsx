"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, RotateCcw, Trophy, FileDown } from "lucide-react";
import { RiasecRadar } from "./RiasecRadar";
import {
  RIASEC_DIMENSIONS,
  RIASEC_ORDER,
  type RiasecDimension,
} from "@/lib/orientation/riasec-constants";
import type { Utilisateur } from "@/lib/orientation/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: {
    utilisateur: Utilisateur;
    scores: Record<RiasecDimension, number>;
    dominant: RiasecDimension;
    dominantLabel: string;
    top3: Array<{ dim: RiasecDimension; label: string; score: number; description: string }>;
  } | null;
  onRecommandations: () => void;
  onRepasser: () => void;
  onExport?: () => void;
}

export function RiasecResultDialog({ open, onOpenChange, result, onRecommandations, onRepasser, onExport }: Props) {
  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-[560px]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent-foreground" />
            Résultats du test RIASEC
          </DialogTitle>
          <DialogDescription>
            Basé sur le modèle de Holland. Plus le score est élevé, plus la dimension correspond à vos intérêts.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 pr-1">
          <div className="space-y-3">
          {/* Bandeau profil dominant */}
          <div
            className="rounded-lg p-3 text-center text-white"
            style={{ background: `linear-gradient(135deg, ${RIASEC_DIMENSIONS[result.dominant].couleur}, var(--primary))` }}
          >
            <p className="text-[11px] uppercase tracking-wide opacity-90">Profil dominant</p>
            <p className="text-xl font-bold">{result.dominantLabel}</p>
            <p className="text-[11px] opacity-90 mt-1 max-w-[400px] mx-auto">
              {RIASEC_DIMENSIONS[result.dominant].description}
            </p>
          </div>

          {/* Radar */}
          <div className="flex justify-center bg-muted/30 rounded-lg py-2">
            <RiasecRadar
              scores={result.scores}
              size={240}
              maxScore={20}
              highlight={result.dominant}
              showValues
            />
          </div>

          {/* Top 3 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">VOS 3 DIMENSIONS FORTES</p>
            <div className="space-y-1.5">
              {result.top3.map((t, i) => (
                <Card key={t.dim} className="reco-card">
                  <CardContent className="p-2.5 flex items-center gap-3">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
                      style={{ background: RIASEC_DIMENSIONS[t.dim].couleur }}
                    >
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{t.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {t.score}/20
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {t.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Répartition complète */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">RÉPARTITION COMPLÈTE</p>
            <div className="grid grid-cols-6 gap-1">
              {RIASEC_ORDER.map((d) => (
                <div
                  key={d}
                  className="text-center rounded-md py-1.5"
                  style={{
                    background: `${RIASEC_DIMENSIONS[d].couleur}22`,
                    border: `1px solid ${RIASEC_DIMENSIONS[d].couleur}55`,
                  }}
                >
                  <div
                    className="text-[10px] font-bold font-mono"
                    style={{ color: RIASEC_DIMENSIONS[d].couleur }}
                  >
                    {d}
                  </div>
                  <div className="text-sm font-bold tabular-nums">{result.scores[d]}</div>
                </div>
              ))}
            </div>
            </div>
        </div>
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={onRepasser} className="text-xs">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Repasser
          </Button>
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="text-xs">
              <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => { onOpenChange(false); onRecommandations(); }}
            className="text-xs flex-1 bg-gradient-to-r from-primary to-accent"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Recommandations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
