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
import { Badge } from "@/components/ui/badge";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { RIASEC_DIMENSIONS, RIASEC_ORDER, type RiasecDimension } from "@/lib/orientation/riasec-constants";
import type { Utilisateur, RiasecRecoAffichage } from "@/lib/orientation/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  utilisateur: Utilisateur | null;
  recommandations: RiasecRecoAffichage[];
  dominantLabel?: string;
}

export function ExportRecommandationsDialog({ open, onOpenChange, utilisateur, recommandations, dominantLabel }: Props) {
  const [downloading, setDownloading] = useState(false);
  if (!utilisateur) return null;
  const user = utilisateur;

  async function handleDownload() {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      const margin = 18;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      let y = 22;

      function ensureSpace(height: number) {
        if (y + height > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
      }

      function addSection(title: string) {
        ensureSpace(12);
        y += 3;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(31, 41, 55);
        pdf.text(title, margin, y);
        y += 8;
      }

      function addParagraph(text: string, fontSize = 10) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(55, 65, 81);
        const lines = pdf.splitTextToSize(text, contentWidth) as string[];
        for (const line of lines) {
          ensureSpace(5);
          pdf.text(line, margin, y);
          y += 5;
        }
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.setTextColor(37, 99, 235);
      pdf.text("OriensCI", margin, y);
      y += 8;
      pdf.setFontSize(12);
      pdf.setTextColor(31, 41, 55);
      pdf.text("Synthèse d'orientation", margin, y);
      y += 7;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128);
      pdf.text(`${dateStr} · N° session : ${user.id.slice(-8).toUpperCase()}`, margin, y);
      y += 8;
      pdf.setDrawColor(209, 213, 219);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 6;

      addSection("Profil de l'étudiant");
      addParagraph(`Niveau : ${user.niveauEtudes ?? "—"}`);
      addParagraph(`Filière actuelle : ${user.serieTerminale ?? user.filiereActuelle?.nom ?? "—"}`);
      addParagraph(`Localisation : ${user.localisation ?? "—"}`);

      if (dominantLabel) {
        addSection("Profil RIASEC");
        addParagraph(`Profil dominant : ${dominantLabel}`);
        const dominantDimension = user.profilDominant as RiasecDimension | null;
        if (dominantDimension && RIASEC_DIMENSIONS[dominantDimension]) {
          addParagraph(RIASEC_DIMENSIONS[dominantDimension].description);
        }
        const scoreFields = {
          R: user.scoreRealiste,
          I: user.scoreInvestigateur,
          A: user.scoreArtistique,
          S: user.scoreSocial,
          E: user.scoreEntreprenant,
          C: user.scoreConventionnel,
        };
        for (const dimension of RIASEC_ORDER) {
          addParagraph(`${dimension} — ${RIASEC_DIMENSIONS[dimension].label} : ${scoreFields[dimension]}/20`);
        }
      }

      addSection("Recommandations personnalisées");
      addParagraph(`${recommandations.length} métier${recommandations.length === 1 ? "" : "s"} recommandé${recommandations.length === 1 ? "" : "s"}, classés par score de compatibilité décroissant.`);
      if (recommandations.length === 0) {
        addParagraph("Aucune recommandation n'est disponible pour le moment.");
      }
      for (const [index, recommendation] of recommandations.entries()) {
        ensureSpace(16);
        y += 2;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(31, 41, 55);
        pdf.text(`${index + 1}. ${recommendation.nom} — ${Math.round(recommendation.score * 100)}%`, margin, y);
        y += 5;
        if (recommendation.secteur) addParagraph(`Secteur : ${recommendation.secteur}`, 9);
        addParagraph(recommendation.justification, 9);
        if (recommendation.salaire) addParagraph(`Salaire moyen (CI) : ${recommendation.salaire}`, 9);
      }

      ensureSpace(14);
      y += 5;
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text(
        pdf.splitTextToSize(
          "OriensCI — Modèle RIASEC de Holland — Côte d'Ivoire. Ce document est généré automatiquement et ne remplace pas un conseil officiel d'orientation.",
          contentWidth
        ),
        margin,
        y
      );

      pdf.save(`oriensci-synthese-${user.id.slice(-8).toLowerCase()}.pdf`);
    } catch (error) {
      console.error("[export PDF] Impossible de générer la synthèse", error);
      toast.error("Le téléchargement du PDF a échoué. Réessayez.");
    } finally {
      setDownloading(false);
    }
  }

  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Export de mes recommandations
          </DialogTitle>
          <DialogDescription>
            Téléchargez votre synthèse d'orientation au format PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg p-5">
          {/* En-tête */}
          <div className="flex items-center justify-between border-b pb-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">
                  O
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">OriensCI</h2>
                  <p className="text-[10px] text-muted-foreground leading-tight">Synthèse d'orientation</p>
                </div>
              </div>
            </div>
            <div className="text-right text-[11px] text-muted-foreground">
              <p>{dateStr}</p>
              <p>N° session : {user.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          {/* Profil utilisateur */}
          <section className="mb-4">
            <h3 className="text-sm font-semibold mb-1.5">Profil de l'étudiant</h3>
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <div className="bg-muted/40 rounded p-2">
                <p className="text-[10px] text-muted-foreground">Niveau</p>
                <p className="font-medium">{user.niveauEtudes ?? "—"}</p>
              </div>
              <div className="bg-muted/40 rounded p-2">
                <p className="text-[10px] text-muted-foreground">Filière actuelle</p>
                <p className="font-medium text-[11px]">{user.serieTerminale ?? user.filiereActuelle?.nom ?? "—"}</p>
              </div>
              <div className="bg-muted/40 rounded p-2">
                <p className="text-[10px] text-muted-foreground">Localisation</p>
                <p className="font-medium">{user.localisation ?? "—"}</p>
              </div>
            </div>
          </section>

          {/* Profil RIASEC */}
          {dominantLabel && (
            <section className="mb-4">
              <h3 className="text-sm font-semibold mb-1.5">Profil RIASEC dominant</h3>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
                <Badge
                  className="text-xs"
                  style={{
                    background: RIASEC_DIMENSIONS[user.profilDominant as RiasecDimension]?.couleur ?? "var(--primary)",
                    color: "#fff",
                  }}
                >
                  {dominantLabel}
                </Badge>
                <p className="text-[11px] text-muted-foreground flex-1">
                  {RIASEC_DIMENSIONS[user.profilDominant as RiasecDimension]?.description ?? ""}
                </p>
              </div>
              <div className="grid grid-cols-6 gap-1 mt-2">
                {(["R","I","A","S","E","C"] as RiasecDimension[]).map((d) => {
                  const v = {
                    R: user.scoreRealiste,
                    I: user.scoreInvestigateur,
                    A: user.scoreArtistique,
                    S: user.scoreSocial,
                    E: user.scoreEntreprenant,
                    C: user.scoreConventionnel,
                  }[d];
                  return (
                    <div key={d} className="text-center rounded p-1" style={{ background: `${RIASEC_DIMENSIONS[d].couleur}22` }}>
                      <div className="text-[9px] font-bold" style={{ color: RIASEC_DIMENSIONS[d].couleur }}>{d}</div>
                      <div className="text-sm font-bold tabular-nums">{v}/20</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recommandations */}
          <section>
            <h3 className="text-sm font-semibold mb-1.5">Recommandations personnalisées</h3>
            <p className="text-[11px] text-muted-foreground mb-2">
              {recommandations.length} métiers recommandés, classés par score de compatibilité décroissant.
            </p>
            <ol className="space-y-2">
              {recommandations.map((r, i) => (
                <li key={r.metierId} className="border rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-[13px] truncate">{r.nom}</span>
                    </div>
                    <Badge className="text-[10px]">{Math.round(r.score * 100)}%</Badge>
                  </div>
                  {r.secteur && <p className="text-[10px] text-muted-foreground mb-1">Secteur : {r.secteur}</p>}
                  <p className="text-[11px] italic">{r.justification}</p>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-4 pt-3 border-t text-[10px] text-muted-foreground text-center">
            OriensCI — Prototype de recherche · Modèle RIASEC de Holland · Côte d'Ivoire
            <br />
            Ce document est généré automatiquement et ne remplace pas un conseil officiel d'orientation.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button onClick={handleDownload} disabled={downloading}>
            <FileDown className="h-4 w-4 mr-1" /> {downloading ? "Préparation du PDF…" : "Télécharger le PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
