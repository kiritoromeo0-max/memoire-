"use client";
import { useState, useCallback } from "react";
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
import {
  History,
  MessageSquare,
  Sparkles,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Clock,
} from "lucide-react";

interface SessionItem {
  id: string;
  statut: string;
  dateDebut: string;
  dateFin: string | null;
  _count?: { interactions: number; recommandations: number };
  nbInteractions?: number;
  nbRecommandations?: number;
}

interface InteractionItem {
  id: string;
  messageUtilisateur: string | null;
  reponseSysteme: string | null;
  dateHeure: string;
  intention: { libelle: string } | null;
}

interface SessionDetail {
  id: string;
  dateDebut: string;
  dateFin: string | null;
  statut: string;
  interactions: InteractionItem[];
  recommandations: Array<{
    id: string;
    scoreCompatibilite: number;
    justification: string;
    dateGeneration: string;
    metier: { id: string; nom: string; secteurActivite: string | null };
  }>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  utilisateurId?: string;
}

export function SessionHistoryDialog({ open, onOpenChange, utilisateurId }: Props) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!utilisateurId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orientation/sessions?utilisateurId=${utilisateurId}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [utilisateurId]);

  const loadSessionDetail = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orientation/sessions?sessionId=${sessionId}`);
      if (res.ok) {
        setSelectedSession(await res.json());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedSession(null);
      void loadSessions();
    }
    onOpenChange(nextOpen);
  };

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {selectedSession ? "Détail de la session" : "Historique des sessions"}
          </DialogTitle>
          <DialogDescription>
            {selectedSession
              ? `Session du ${formatDate(selectedSession.dateDebut)}`
              : "Retrouvez vos conversations et recommandations passées."}
          </DialogDescription>
        </DialogHeader>

        {selectedSession ? (
          <SessionDetailView
            session={selectedSession}
            onBack={() => setSelectedSession(null)}
            formatDate={formatDate}
          />
        ) : (
          <ScrollArea className="flex-1 max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Chargement…</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Aucune session pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {sessions.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => loadSessionDetail(s.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 transition-all text-left group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {sessions.length - i}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {formatDate(s.dateDebut)}
                        </span>
                        {s.statut === "active" && (
                          <Badge className="text-[9px] h-4 bg-primary text-primary-foreground">
                            active
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" />
                          {s._count?.interactions ?? 0} messages
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Sparkles className="h-3 w-3" />
                          {s._count?.recommandations ?? 0} recos
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SessionDetailView({
  session,
  onBack,
  formatDate,
}: {
  session: SessionDetail;
  onBack: () => void;
  formatDate: (iso: string) => string;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Button variant="ghost" size="sm" onClick={onBack} className="w-fit text-xs mb-2">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Retour à la liste
      </Button>

      <ScrollArea className="flex-1 max-h-[55vh] pr-2">
        <div className="space-y-3">
          {/* Statistiques session */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/40 rounded-lg p-2">
              <div className="text-lg font-bold tabular-nums">{session.interactions.length}</div>
              <div className="text-[10px] text-muted-foreground">Messages</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-2">
              <div className="text-lg font-bold tabular-nums">{session.recommandations.length}</div>
              <div className="text-[10px] text-muted-foreground">Recos</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-2">
              <div className="text-sm font-bold tabular-nums">
                {session.dateFin
                  ? Math.round((new Date(session.dateFin).getTime() - new Date(session.dateDebut).getTime()) / 60000)
                  : Math.round((Date.now() - new Date(session.dateDebut).getTime()) / 60000)}
              </div>
              <div className="text-[10px] text-muted-foreground">Minutes</div>
            </div>
          </div>

          {/* Recommandations */}
          {session.recommandations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> RECOMMANDATIONS GÉNÉRÉES
              </p>
              <div className="space-y-1.5">
                {session.recommandations.map((r, i) => (
                  <div key={r.id} className="border rounded-lg p-2.5 flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{r.metier.nom}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {Math.round(r.scoreCompatibilite * 100)}%
                        </Badge>
                      </div>
                      {r.metier.secteurActivite && (
                        <p className="text-[11px] text-muted-foreground truncate">{r.metier.secteurActivite}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversations */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> CONVERSATION ({session.interactions.length})
            </p>
            <div className="space-y-2">
              {session.interactions
                .filter((it) => it.messageUtilisateur || it.reponseSysteme)
                .map((it) => (
                  <div key={it.id} className="space-y-1">
                    {it.messageUtilisateur && (
                      <div className="flex justify-end">
                        <div className="chat-bubble-user px-2.5 py-1.5 text-[12px] max-w-[80%]">
                          {it.messageUtilisateur}
                        </div>
                      </div>
                    )}
                    {it.reponseSysteme && (
                      <div className="flex justify-start">
                        <div className="chat-bubble-bot px-2.5 py-1.5 text-[12px] max-w-[80%]">
                          <div className="flex items-center gap-1 text-[9px] text-muted-foreground mb-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDate(it.dateHeure)}
                            {it.intention && (
                              <Badge variant="outline" className="text-[8px] h-3 px-1">
                                {it.intention.libelle}
                              </Badge>
                            )}
                          </div>
                          <div className="line-clamp-3 whitespace-pre-wrap">{it.reponseSysteme}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
