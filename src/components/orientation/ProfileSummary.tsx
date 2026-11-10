"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  MapPin,
  BookOpen,
  Compass,
  UserCog,
  Sparkles,
  HeartHandshake,
  Pencil,
  BarChart3,
  PieChart,
  RotateCcw,
} from "lucide-react";
import {
  RIASEC_DIMENSIONS,
  RIASEC_ORDER,
  type RiasecDimension,
} from "@/lib/orientation/riasec-constants";
import { RiasecRadar } from "./RiasecRadar";
import type { Utilisateur } from "@/lib/orientation/types";

interface Props {
  utilisateur: Utilisateur | null;
  onEditProfil: () => void;
  onPasserTest: () => void;
  onRecommandations: () => void;
  onConseiller: () => void;
  onReset?: () => void;
}

export function ProfileSummary({ utilisateur, onEditProfil, onPasserTest, onRecommandations, onConseiller, onReset }: Props) {
  const [view, setView] = useState<"radar" | "bars">("radar");
  if (!utilisateur) return null;

  const profilComplet =
    utilisateur.scoreRealiste + utilisateur.scoreInvestigateur + utilisateur.scoreArtistique +
    utilisateur.scoreSocial + utilisateur.scoreEntreprenant + utilisateur.scoreConventionnel > 0;

  const scores: Record<RiasecDimension, number> = {
    R: utilisateur.scoreRealiste,
    I: utilisateur.scoreInvestigateur,
    A: utilisateur.scoreArtistique,
    S: utilisateur.scoreSocial,
    E: utilisateur.scoreEntreprenant,
    C: utilisateur.scoreConventionnel,
  };

  const dominant = utilisateur.profilDominant as RiasecDimension | null;
  const maxScore = 20;
  const totalPoints = Object.values(scores).reduce((a, b) => a + b, 0);

  return (
    <Card className="border-primary/20 overflow-hidden relative">
      {/* Bandeau dégradé en haut */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" />
            Mon profil
          </span>
          {onReset && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={onReset}
              title="Réinitialiser le profil"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Infos de base */}
        <div className="space-y-2 text-sm bg-muted/40 rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary shrink-0" />
            <span className="text-muted-foreground text-xs">Niveau</span>
            <span className="ml-auto font-medium text-right text-[13px]">
              {utilisateur.niveauEtudes ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <span className="text-muted-foreground text-xs">Filière</span>
            <span className="ml-auto font-medium text-right text-[12px] max-w-[140px] truncate" title={utilisateur.serieTerminale ?? utilisateur.filiereActuelle?.nom ?? ""}>
              {utilisateur.serieTerminale ?? utilisateur.filiereActuelle?.nom ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="text-muted-foreground text-xs">Ville</span>
            <span className="ml-auto font-medium">
              {utilisateur.localisation ?? "—"}
            </span>
          </div>
        </div>

        {profilComplet ? (
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium flex items-center gap-1">
                <Compass className="h-3.5 w-3.5" /> Profil RIASEC
              </span>
              <div className="flex items-center gap-1">
                {/* Toggle radar/bars */}
                <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setView("radar")}
                    className={`p-1 rounded ${view === "radar" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
                    title="Vue radar"
                  >
                    <PieChart className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("bars")}
                    className={`p-1 rounded ${view === "bars" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
                    title="Vue barres"
                  >
                    <BarChart3 className="h-3 w-3" />
                  </button>
                </div>
                {dominant && (
                  <Badge
                    className="text-[10px]"
                    style={{
                      background: RIASEC_DIMENSIONS[dominant].couleur,
                      color: "#fff",
                    }}
                  >
                    {RIASEC_DIMENSIONS[dominant].label}
                  </Badge>
                )}
              </div>
            </div>

            {view === "radar" ? (
              <div className="flex justify-center py-1">
                <RiasecRadar
                  scores={scores}
                  size={200}
                  maxScore={maxScore}
                  highlight={dominant}
                  showValues
                />
              </div>
            ) : (
              <div className="space-y-1.5 py-1">
                {RIASEC_ORDER.map((d) => (
                  <div key={d} className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-mono font-bold w-3"
                      style={{ color: RIASEC_DIMENSIONS[d].couleur }}
                    >
                      {d}
                    </span>
                    <div className="riasec-bar flex-1">
                      <span
                        style={{
                          width: `${(scores[d] / maxScore) * 100}%`,
                          background: RIASEC_DIMENSIONS[d].couleur,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">
                      {scores[d]}/20
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Stats résumées */}
            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="bg-muted/50 rounded-md py-1">
                <div className="text-[10px] text-muted-foreground">Total</div>
                <div className="text-sm font-bold tabular-nums">{totalPoints}/120</div>
              </div>
              <div className="bg-muted/50 rounded-md py-1">
                <div className="text-[10px] text-muted-foreground">Score max</div>
                <div className="text-sm font-bold tabular-nums">{Math.max(...Object.values(scores))}/20</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t">
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-center">
              <Compass className="h-5 w-5 mx-auto text-accent-foreground mb-1.5" />
              <p className="text-xs text-muted-foreground mb-2">
                Vous n'avez pas encore passé le test RIASEC.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={onEditProfil}>
            <Pencil className="h-3 w-3 mr-1" /> Modifier
          </Button>
          <Button
            variant={profilComplet ? "outline" : "default"}
            size="sm"
            className="text-xs h-8"
            onClick={onPasserTest}
          >
            <Compass className="h-3.5 w-3.5 mr-1" />
            {profilComplet ? "Repasser" : "Test RIASEC"}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="text-xs h-8 col-span-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            onClick={onRecommandations}
            disabled={!profilComplet}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Mes recommandations
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 col-span-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onConseiller}
          >
            <HeartHandshake className="h-3.5 w-3.5 mr-1" />
            Parler à un conseiller humain
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
