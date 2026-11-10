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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Filiere, Utilisateur } from "@/lib/orientation/types";
import {
  SERIES_TERMINALE_GENERALES,
  SERIES_TERMINALE_TECHNOLOGIQUES,
} from "@/lib/orientation/education";

const NIVEAUX = [
  { value: "Terminale", label: "Terminale" },
  { value: "Bac obtenu", label: "Baccalauréat obtenu" },
  { value: "Licence 1", label: "Licence 1" },
  { value: "Licence 2", label: "Licence 2" },
  { value: "Licence 3", label: "Licence 3" },
  { value: "Master 1", label: "Master 1" },
  { value: "Autre", label: "Autre / En réorientation" },
];

const VILLES_CI = [
  "Abidjan", "Yamoussoukro", "Bouaké", "Daloa", "San-Pédro", "Korhogo",
  "Man", "Divo", "Gagnoa", "Abengourou", "Dabou", "Grand-Bassam",
  "Bondoukou", "Séguéla", "Odienné", "Autre ville",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  utilisateur: Utilisateur | null;
  filieres: Filiere[];
  onSaved: (u: Utilisateur) => void;
}

function buildProfileState(utilisateur: Utilisateur | null) {
  return {
    niveau: utilisateur?.niveauEtudes ?? "",
    filiereId: utilisateur?.filiereActuelleId ?? "__aucune__",
    serieTerminale: utilisateur?.serieTerminale ?? "",
    localisation: utilisateur?.localisation ?? "",
  };
}

export function ProfileSetupDialog({ open, onOpenChange, utilisateur, filieres, onSaved }: Props) {
  return (
    <ProfileSetupDialogForm
      key={`${open ? "open" : "closed"}-${utilisateur?.id ?? "new"}`}
      open={open}
      onOpenChange={onOpenChange}
      utilisateur={utilisateur}
      filieres={filieres}
      onSaved={onSaved}
    />
  );
}

function ProfileSetupDialogForm({ open, onOpenChange, utilisateur, filieres, onSaved }: Props) {
  const initialProfile = buildProfileState(utilisateur);
  const [niveau, setNiveau] = useState<string>(initialProfile.niveau);
  const [filiereId, setFiliereId] = useState<string>(initialProfile.filiereId);
  const [serieTerminale, setSerieTerminale] = useState<string>(initialProfile.serieTerminale);
  const [localisation, setLocalisation] = useState<string>(initialProfile.localisation);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!utilisateur) return;
    setSaving(true);
    try {
      const res = await fetch("/api/orientation/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: utilisateur.id,
          niveauEtudes: niveau || null,
          serieTerminale: niveau === "Terminale" ? serieTerminale || null : null,
          filiereActuelleId: niveau === "Terminale" || filiereId === "__aucune__" ? null : filiereId,
          localisation: localisation || null,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      const updated = (await res.json()) as Utilisateur;
      onSaved(updated);
      toast.success("Profil enregistré ! Vous pouvez maintenant passer le test RIASEC.");
      onOpenChange(false);
    } catch {
      toast.error("Impossible d'enregistrer le profil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Mon profil d'orientation</DialogTitle>
          <DialogDescription>
            Renseignez votre situation actuelle. Ces informations nous aideront à mieux cibler nos recommandations.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="niveau">Niveau d'études actuel</Label>
            <Select
              value={niveau}
              onValueChange={(value) => {
                setNiveau(value);
                if (value === "Terminale") setFiliereId("__aucune__");
                else setSerieTerminale("");
              }}
            >
              <SelectTrigger id="niveau"><SelectValue placeholder="Sélectionnez votre niveau" /></SelectTrigger>
              <SelectContent>
                {NIVEAUX.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {niveau === "Terminale" ? (
            <div className="space-y-2">
              <Label htmlFor="serie-terminale">Série de Terminale</Label>
              <Select value={serieTerminale} onValueChange={setSerieTerminale}>
                <SelectTrigger id="serie-terminale"><SelectValue placeholder="Sélectionnez votre série" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectGroup>
                    <SelectLabel>Séries générales</SelectLabel>
                    {SERIES_TERMINALE_GENERALES.map((serie) => (
                      <SelectItem key={serie} value={serie}>{serie}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Séries techniques et technologiques</SelectLabel>
                    {SERIES_TERMINALE_TECHNOLOGIQUES.map((serie) => (
                      <SelectItem key={serie} value={serie}>{serie}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="filiere">Filière actuelle (si applicable)</Label>
              <Select value={filiereId} onValueChange={setFiliereId}>
                <SelectTrigger id="filiere"><SelectValue placeholder="Aucune / non définie" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__aucune__">Aucune / non définie</SelectItem>
                  {filieres.map((f) => <SelectItem key={f.id} value={f.id}>{f.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ville">Localisation (ville)</Label>
            <Select value={localisation} onValueChange={setLocalisation}>
              <SelectTrigger id="ville"><SelectValue placeholder="Votre ville en Côte d'Ivoire" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {VILLES_CI.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !niveau || (niveau === "Terminale" && !serieTerminale)}>
            {saving ? "Enregistrement…" : "Enregistrer mon profil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
