"use client";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, GitCompareArrows, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  RIASEC_DIMENSIONS,
  RIASEC_ORDER,
} from "@/lib/orientation/riasec-constants";
import type { Filiere } from "@/lib/orientation/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filieres: Filiere[];
}

export function CompareFilieresDialog({ open, onOpenChange, filieres }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return filieres;
    const q = search.toLowerCase();
    return filieres.filter(
      (f) => {
        const domaines = Array.isArray(f.domaines)
          ? f.domaines
          : f.domaines?.split("|").map((domaine) => domaine.trim()).filter(Boolean) ?? [];
        return f.nom.toLowerCase().includes(q) ||
          domaines.some((domaine) => domaine.toLowerCase().includes(q));
      }
    );
  }, [filieres, search]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  }

  const selectedFilieres = selected
    .map((id) => filieres.find((f) => f.id === id))
    .filter(Boolean) as Filiere[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            Comparateur de filières
          </DialogTitle>
          <DialogDescription>
            Sélectionnez 2 à 3 filières pour comparer leurs profils RIASEC, conditions d'accès et débouchés.
          </DialogDescription>
        </DialogHeader>

        {selectedFilieres.length < 2 ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une filière..."
                className="pl-8"
              />
            </div>
            <ScrollArea className="flex-1 max-h-[50vh] pr-2">
              <div className="space-y-1">
                {filtered.map((f) => {
                  const isSel = selected.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => toggle(f.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(f.id); } }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        isSel ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          isSel ? "bg-primary border-primary text-primary-foreground" : "border-input"
                        }`}
                      >
                        {isSel && <Check className="h-3 w-3" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{f.nom}</p>
                        {f.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{f.description}</p>
                        )}
                      </div>
                      {isSel && (
                        <Badge variant="default" className="text-[10px] shrink-0">
                          #{selected.indexOf(f.id) + 1}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              {selected.length}/3 sélectionnées — choisissez au moins 2 filières pour comparer.
            </div>
          </div>
        ) : (
          <CompareTable filieres={selectedFilieres} onRemove={toggle} />
        )}

        {selectedFilieres.length >= 2 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected([])}
            className="text-xs mt-1"
          >
            <X className="h-3 w-3 mr-1" /> Réinitialiser la sélection
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompareTable({ filieres, onRemove }: { filieres: Filiere[]; onRemove: (id: string) => void }) {
  const profilKeys = RIASEC_ORDER;
  const rows: Array<{ label: string; key: string; render: (f: Filiere) => React.ReactNode }> = [
    {
      label: "Description",
      key: "desc",
      render: (f) => <span className="text-[12px]">{f.description ?? "—"}</span>,
    },
    {
      label: "Durée",
      key: "duree",
      render: (f) => <span className="text-[12px] font-medium">{f.duree ?? "—"}</span>,
    },
    {
      label: "Conditions d'accès",
      key: "cond",
      render: (f) => <span className="text-[12px]">{f.conditionsAcces ?? "—"}</span>,
    },
    {
      label: "Établissements",
      key: "etab",
      render: (f) => (
        <div className="flex flex-wrap gap-1">
          {(f.etablissements ?? []).map((e, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">{e}</Badge>
          ))}
        </div>
      ),
    },
    {
      label: "Débouchés",
      key: "deb",
      render: (f) => <span className="text-[12px]">{f.debouchesText ?? "—"}</span>,
    },
  ];

  return (
    <ScrollArea className="flex-1 max-h-[60vh]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 text-xs text-muted-foreground font-medium w-28">Critère</th>
              {filieres.map((f, i) => (
                <th key={f.id} className="text-left p-2 align-top">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                          style={{ background: `var(--chart-${(i % 5) + 1})` }}
                        >
                          {i + 1}
                        </span>
                        <span className="font-semibold text-[13px]">{f.nom}</span>
                      </div>
                    </div>
                    <button onClick={() => onRemove(f.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Profil RIASEC visuel */}
            <tr className="border-b bg-muted/20">
              <td className="p-2 text-xs font-medium text-muted-foreground align-top">Profil RIASEC</td>
              {filieres.map((f) => (
                <td key={f.id} className="p-2 align-top">
                  <div className="space-y-1">
                    {profilKeys.map((d) => {
                      const val = (f as unknown as Record<string, number>)[`profil${RIASEC_DIMENSIONS[d].label}`] ?? 0;
                      const score = Math.min(10, Math.max(0, val));
                      return (
                        <div key={d} className="flex items-center gap-1.5">
                          <span
                            className="text-[9px] font-mono font-bold w-3"
                            style={{ color: RIASEC_DIMENSIONS[d].couleur }}
                          >
                            {d}
                          </span>
                          <div className="riasec-bar flex-1 h-1.5">
                            <span style={{ width: `${(score / 10) * 100}%`, background: RIASEC_DIMENSIONS[d].couleur }} />
                          </div>
                          <span className="text-[9px] tabular-nums w-4 text-right text-muted-foreground">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </td>
              ))}
            </tr>
            {/* Autres lignes */}
            {rows.map((r) => (
              <tr key={r.key} className="border-b align-top">
                <td className="p-2 text-xs font-medium text-muted-foreground">{r.label}</td>
                {filieres.map((f) => (
                  <td key={f.id} className="p-2">
                    {r.render(f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  );
}
