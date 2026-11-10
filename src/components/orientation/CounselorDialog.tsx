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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CONSEILLER_CONTACTS } from "@/lib/orientation/conseiller-contacts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  utilisateurId?: string;
  sessionId?: string;
}

export function CounselorDialog({ open, onOpenChange, utilisateurId, sessionId }: Props) {
  const [nom, setNom] = useState("");
  const [contact, setContact] = useState("");
  const [motif, setMotif] = useState("");
  const [urgence, setUrgence] = useState("normale");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!contact.trim() || !motif.trim()) {
      toast.error("Veuillez renseigner un contact et un motif.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/orientation/conseiller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utilisateurId,
          sessionId,
          nom: nom || undefined,
          contact,
          motif,
          urgence,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      toast.success(data.message ?? "Demande enregistrée !");
      setNom(""); setContact(""); setMotif(""); setUrgence("normale");
      onOpenChange(false);
    } catch {
      toast.error("Impossible d'enregistrer la demande.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Mise en relation avec un conseiller humain</DialogTitle>
          <DialogDescription>
            Le formulaire enregistre votre demande dans OriensCI, mais ne déclenche pas de rappel automatique. Pour joindre directement un service, utilisez les coordonnées ci-dessous.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <section aria-label="Coordonnées des services d'orientation" className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
            {[CONSEILLER_CONTACTS.dob, CONSEILLER_CONTACTS.cio].map((service) => (
              <div key={service.nom} className="space-y-1">
                <h3 className="font-semibold">{service.nom}</h3>
                <p className="text-xs text-muted-foreground">{service.adresse}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {service.telephones.map((telephone) => (
                    <a
                      key={telephone}
                      href={`tel:${telephone.replaceAll(" ", "")}`}
                      className="text-xs font-medium text-primary underline underline-offset-2"
                    >
                      {telephone}
                    </a>
                  ))}
                </div>
                <a
                  href={service.source}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-muted-foreground underline underline-offset-2"
                >
                  Source des coordonnées
                </a>
              </div>
            ))}
          </section>
          <div className="space-y-2">
            <Label htmlFor="cnom">Nom (optionnel)</Label>
            <Input id="cnom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Votre nom" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ccontact">Contact (téléphone ou email) *</Label>
            <Input id="ccontact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+225 07 00 00 00 00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmotif">Motif de la demande *</Label>
            <Textarea
              id="cmotif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Décrivez en quelques mots votre situation ou votre question."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="curgence">Niveau d'urgence</Label>
            <Select value={urgence} onValueChange={setUrgence}>
              <SelectTrigger id="curgence"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normale">Normale (sous 48h)</SelectItem>
                <SelectItem value="elevee">Élevée (demande d'inscription imminente)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Envoi…" : "Envoyer ma demande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
