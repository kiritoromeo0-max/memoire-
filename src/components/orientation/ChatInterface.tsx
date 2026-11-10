"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Sparkles,
  ClipboardList,
  Compass,
  HeartHandshake,
  List,
  School,
  Briefcase,
  BookOpen,
  ChevronRight,
  Moon,
  Sun,
  Menu,
  X,
  Plus,
  RotateCcw,
  GitCompareArrows,
  FileDown,
  Trophy,
  MessageCircle,
  History,
  BookMarked,
  Brain,
  Sparkles as SparklesIcon,
  Bot,
  Globe,
} from "lucide-react";
import { useTheme } from "@/app/providers";
import { toast } from "sonner";
import { MessageMarkdown } from "./MessageMarkdown";
import { ProfileSetupDialog } from "./ProfileSetupDialog";
import { RiasecTestDialog } from "./RiasecTestDialog";
import { RiasecResultDialog } from "./RiasecResultDialog";
import { CounselorDialog } from "./CounselorDialog";
import { RecommendationsCard } from "./RecommendationsCard";
import { FiliereRecommendationsCard } from "./FiliereRecommendationsCard";
import { FiliereDetailsCard, type FiliereDetailsData } from "./FiliereDetailsCard";
import { ProfileSummary } from "./ProfileSummary";
import { OnboardingStepper, calculerEtape } from "./OnboardingStepper";
import { CompareFilieresDialog } from "./CompareFilieresDialog";
import { ExportRecommandationsDialog } from "./ExportRecommandationsDialog";
import { SessionHistoryDialog } from "./SessionHistoryDialog";
import { StatsCard } from "./StatsCard";
import { RiasecGlossaryDialog } from "./RiasecGlossaryDialog";
import { FeedbackButtons } from "./FeedbackButtons";
import { PersonalityQuestionnaire } from "./PersonalityQuestionnaire";
import type { LlmResponse } from "@/lib/orientation/llm-service";
import {
  RIASEC_DIMENSIONS,
  RIASEC_ORDER,
  type RiasecDimension,
} from "@/lib/orientation/riasec-constants";
import type {
  Utilisateur,
  Session,
  ChatMessage,
  DialogueAction,
  ActionType,
  Filiere,
  Metier,
  RiasecRecoAffichage,
  FiliereRecoAffichage,
} from "@/lib/orientation/types";

interface TestResult {
  utilisateur: Utilisateur;
  scores: Record<RiasecDimension, number>;
  dominant: RiasecDimension;
  dominantLabel: string;
  top3: Array<{ dim: RiasecDimension; label: string; score: number; description: string }>;
}

const STORAGE_KEY = "oriensci_ctx_v1";

interface StoredCtx { utilisateurId: string; sessionId: string; }

async function getChatRequestError(response: Response): Promise<Error> {
  let code: string | undefined;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "code" in body && typeof body.code === "string") {
      code = body.code;
    }
  } catch {
    // Use the HTTP status when the server does not return a JSON error body.
  }

  switch (response.status) {
    case 400:
      return new Error("Le message est invalide ou dépasse la longueur autorisée.");
    case 401:
      return new Error("Votre session a expiré. Rechargez la page pour reprendre la conversation.");
    case 403:
      if (code === "ORIGIN_NOT_ALLOWED") {
        return new Error("La requête a été bloquée car son origine n'est pas autorisée.");
      }
      return new Error("Cette session n'est pas autorisée. Rechargez la page puis réessayez.");
    case 429:
      return new Error("Vous avez envoyé trop de messages. Attendez un peu avant de réessayer.");
    case 503:
      if (code === "RATE_LIMIT_UNAVAILABLE") {
        return new Error("La protection est temporairement indisponible. Réessayez plus tard.");
      }
      if (code === "AI_UNAVAILABLE") {
        return new Error("Le service IA est temporairement indisponible. Vous pouvez activer le mode classique.");
      }
      return new Error("Un service est temporairement indisponible. Réessayez plus tard.");
    default:
      return new Error("Une erreur technique empêche l'envoi du message. Réessayez plus tard.");
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const NLU_INTENT_LABELS: Record<string, string> = {
  salutation: "Salutation",
  recherche_filiere: "Recherche de filière",
  recherche_metier: "Recherche de métier",
  demande_debouches: "Débouchés",
  demande_recommandation: "Recommandation",
  demande_test_riasec: "Test RIASEC",
  consultation_profil: "Mon profil",
  aide_conseiller: "Conseiller humain",
  remerciement: "Remerciement",
  demarrage_profil: "Profil",
  information_generale: "Information",
  llm: "IA conversationnelle",
  synthese: "Synthèse d'orientation",
};

export function ChatInterface() {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showCounselor, setShowCounselor] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<TestResult | null>(null);
  const [lastRecommandations, setLastRecommandations] = useState<RiasecRecoAffichage[]>([]);
  const [lastRecommandationsFilieres, setLastRecommandationsFilieres] = useState<FiliereRecoAffichage[]>([]);
  const [lastDominantLabel, setLastDominantLabel] = useState<string | undefined>(undefined);
  const [statsKey, setStatsKey] = useState(0); // pour rafraîchir la StatsCard
  const [llmMode, setLlmMode] = useState(false); // true = LLM conversationnel, false = NLU mots-clés (par défaut)
  const [testInlineEnCours, setTestInlineEnCours] = useState<{ current: number; total: number } | null>(null);
  const [syntheseEnCours, setSyntheseEnCours] = useState(false);
  const { theme, setTheme } = useTheme();
  const [dark, setDark] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const initFresh = useCallback(async () => {
    try {
      const res = await fetch("/api/orientation/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUtilisateur(data.utilisateur);
      setSession(data.session);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ utilisateurId: data.utilisateur.id, sessionId: data.session.id })
      );
      // Message de bienvenue
      setMessages([
        {
          id: uid(),
          role: "bot",
          content:
            "Bonjour 👋 ! Je suis **OriensCI**, votre assistant d'orientation académique et professionnelle en Côte d'Ivoire.\n\nLe mode classique est activé. Vous pouvez activer le mode IA conversationnelle avec le bouton « IA OFF » en haut de la page.\n\nPour commencer, dites-moi simplement : quel est votre **niveau d'études** et dans quelle **ville** êtes-vous ?",
          timestamp: new Date().toISOString(),
          actions: [
            { type: "suggestion", texte: "Je suis en Terminale", donnees: { message: "Je suis en terminale" } },
            { type: "suggestion", texte: "Je veux passer le test RIASEC", donnees: { message: "Je veux passer le test RIASEC" } },
          ],
        },
      ]);
    } catch {
      toast.error("Impossible d'initialiser la session.");
    }
  }, []);

  const chargerHistorique = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/orientation/sessions?sessionId=${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      const msgs: ChatMessage[] = [];
      if (data.interactions && data.interactions.length > 0) {
        for (const it of data.interactions) {
          if (it.messageUtilisateur) {
            msgs.push({
              id: uid(),
              role: "user",
              content: it.messageUtilisateur,
              timestamp: it.dateHeure,
            });
          }
          if (it.reponseSysteme) {
            msgs.push({
              id: uid(),
              role: "bot",
              content: it.reponseSysteme,
              timestamp: it.dateHeure,
              intention: it.intention?.libelle,
            });
          }
        }
      } else {
        msgs.push({
          id: uid(),
          role: "bot",
          content:
            "Bonjour 👋 ! Je suis **OriensCI**. Reprenons votre orientation. Posez-moi une question ou créez votre profil.",
          timestamp: new Date().toISOString(),
        });
      }
      setMessages(msgs);
    } catch {
      /* ignore */
    }
  }, []);

  // Initialisation au montage
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const bootstrap = async () => {
      // Charger filières & métiers pour les selects + listes
      try {
        const [fr, mr] = await Promise.all([
          fetch("/api/orientation/filieres"),
          fetch("/api/orientation/metiers"),
        ]);
        if (fr.ok) setFilieres(await fr.json());
        if (mr.ok) setMetiers(await mr.json());
      } catch {
        /* ignore */
      }

      const stored = typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
      let repriseImpossible = false;
      if (stored) {
        try {
          const ctx = JSON.parse(stored) as StoredCtx;
          const res = await fetch(`/api/orientation/init?utilisateurId=${ctx.utilisateurId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.utilisateur && data.session) {
              setUtilisateur(data.utilisateur);
              setSession(data.session);
              await chargerHistorique(data.session.id);
              return;
            }
          }
          repriseImpossible = true;
        } catch {
          repriseImpossible = true;
        }
      }
      if (repriseImpossible) {
        toast("Cette ancienne session ne peut pas être vérifiée. Un nouveau profil sécurisé va être créé; les anciennes données ne sont pas supprimées.");
      }
      await initFresh();
    };
    void bootstrap();
  }, [chargerHistorique, initFresh]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(theme === "dark");
  }, [theme]);

  // Scroll auto vers le bas à chaque nouveau message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  const envoyerMessage = useCallback(async (texte?: string) => {
    const msg = (texte ?? input).trim();
    if (!msg || !utilisateur || !session || loading) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      if (llmMode) {
        // Mode LLM : appel à /chat-llm avec l'historique récent
        const historique = messages.slice(-10).map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: m.content,
        }));
        const res = await fetch("/api/orientation/chat-llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ utilisateurId: utilisateur.id, sessionId: session.id, message: msg, historique }),
        });
        if (!res.ok) throw await getChatRequestError(res);
        const data = await res.json() as LlmResponse;
        // Convertir les actions LLM en actions du frontend
        const actions: DialogueAction[] = (data.actions || []).map((a: { type: string; donnees?: Record<string, unknown> }) => {
          // Mapper les types LLM vers les types frontend
          let type: ActionType = "texte";
          switch (a.type) {
            case "profil_collecte": type = "texte"; break;
            case "test_riasec_question": type = "texte"; break; // géré par le testProgress
            case "test_riasec_termine": type = "test_riasec_termine"; break;
            case "synthese_en_cours": type = "synthese_en_cours"; break;
            case "recommandations_generees": type = "proposer_recommandations"; break;
            case "redirection_conseiller": type = "redirection_conseiller"; break;
            case "afficher_filiere": type = "afficher_details_filiere"; break;
            case "afficher_metier": type = "afficher_metier"; break;
            case "suggestion": type = "suggestion"; break;
            default: type = "texte";
          }
          return { type, texte: "", donnees: a.donnees };
        });
        const botMsg: ChatMessage = {
          id: uid(),
          role: "bot",
          content: data.reponse,
          timestamp: new Date().toISOString(),
          intention: "llm",
          actions,
          sourcesWeb: data.sourcesWeb,
        };
        setMessages((prev) => [...prev, botMsg]);

        // Mettre à jour la progression du test (contrôlée par le backend)
        if (data.testProgress) {
          setTestInlineEnCours(data.testProgress);
        } else if (!data.actions?.some((a: { type: string }) => a.type === "test_riasec_question")) {
          // Si pas de question de test dans les actions, le test n'est plus en cours
          setTestInlineEnCours(null);
        }

        // Si les scores ont été calculés (test terminé), afficher le dialog de résultats
        const scoresCalcules = data.scoresCalcules;
        if (scoresCalcules) {
          const userRes = await fetch(`/api/orientation/users?id=${utilisateur.id}`);
          const updatedUser = userRes.ok ? await userRes.json() : utilisateur;
          const top3 = [...RIASEC_ORDER]
            .sort((a, b) => scoresCalcules.scores[b] - scoresCalcules.scores[a])
            .slice(0, 3)
            .map((k) => ({
              dim: k,
              label: RIASEC_DIMENSIONS[k].label,
              score: scoresCalcules.scores[k],
              description: RIASEC_DIMENSIONS[k].description,
            }));
          setLastTestResult({
            utilisateur: updatedUser,
            scores: scoresCalcules.scores,
            dominant: scoresCalcules.dominant,
            dominantLabel: scoresCalcules.dominantLabel,
            top3,
          });
          setLastDominantLabel(scoresCalcules.dominantLabel);
          setTestInlineEnCours(null);
          toast.success(`Test RIASEC terminé ! Profil dominant : ${scoresCalcules.dominantLabel}`);
        }

        // Si la synthèse est en cours, déclencher la synthèse
        const syntheseAction = (data.actions || []).find((a: { type: string }) => a.type === "synthese_en_cours");
        if (syntheseAction) {
          setSyntheseEnCours(true);
          try {
            const syntheseRes = await fetch("/api/orientation/synthese", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ utilisateurId: utilisateur.id, sessionId: session.id }),
            });
            if (syntheseRes.ok) {
              const syntheseData = await syntheseRes.json();
              // Stocker les recommandations
              const recos = (syntheseData.recommandations || []) as RiasecRecoAffichage[];
              const recosFilieres = (syntheseData.recommandationsFilieres || []) as FiliereRecoAffichage[];
              setLastRecommandations(recos);
              setLastRecommandationsFilieres(recosFilieres);
              setLastDominantLabel(syntheseData.dominantLabel);
              // Ajouter le message de synthèse
              const syntheseMsg: ChatMessage = {
                id: uid(),
                role: "bot",
                content: syntheseData.synthese,
                timestamp: new Date().toISOString(),
                intention: "synthese",
                actions: [
                  { type: "proposer_recommandations", texte: "", donnees: { recommandations: recos, recommandationsFilieres: recosFilieres, dominant: syntheseData.dominant } },
                  { type: "suggestion", texte: "Exporter en PDF", donnees: { message: "Exporter" } },
                  { type: "suggestion", texte: "Parler à un conseiller", donnees: { message: "Je veux parler à un conseiller humain" } },
                ],
              };
              setMessages((prev) => [...prev, syntheseMsg]);
              // Ouvrir le dialog de résultats
              setShowResult(true);
            }
          } catch {
            toast.error("Erreur lors de la synthèse");
          } finally {
            setSyntheseEnCours(false);
          }
        }

        // Si recommandations générées directement, stocker
        const recoAction = (data.actions || []).find((a: { type: string }) => a.type === "recommandations_generees");
        if (recoAction?.donnees) {
          const recos = (recoAction.donnees.recommandations as RiasecRecoAffichage[]) || [];
          const recosFilieres = (recoAction.donnees.recommandationsFilieres as FiliereRecoAffichage[]) || [];
          setLastRecommandations(recos);
          setLastRecommandationsFilieres(recosFilieres);
          setLastDominantLabel(recoAction.donnees.dominantLabel as string | undefined);
        }
      } else {
        // Mode NLU classique
        const res = await fetch("/api/orientation/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ utilisateurId: utilisateur.id, sessionId: session.id, message: msg }),
        });
        if (!res.ok) throw await getChatRequestError(res);
        const data = await res.json();
        const botMsg: ChatMessage = {
          id: uid(),
          role: "bot",
          content: data.reponseSysteme,
          timestamp: new Date().toISOString(),
          intention: data.intentionDetectee,
          confidence: data.confidence,
          actions: data.actions,
        };
        setMessages((prev) => [...prev, botMsg]);
      }
      // Rafraîchir l'utilisateur (scores éventuels)
      const ur = await fetch(`/api/orientation/users?id=${utilisateur.id}`);
      if (ur.ok) setUtilisateur(await ur.json());
      setStatsKey((k) => k + 1); // rafraîchir les stats
    } catch (error) {
      toast.error(
        error instanceof TypeError
          ? "Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez."
          : error instanceof Error
            ? error.message
            : "Le message n'a pas pu être envoyé.",
      );
    } finally {
      setLoading(false);
    }
  }, [input, utilisateur, session, loading, llmMode, messages, testInlineEnCours]);

  const handleAction = useCallback((action: DialogueAction) => {
    switch (action.type) {
      case "proposer_test":
        setShowTest(true);
        break;
      case "demarrer_profil":
        setShowProfile(true);
        break;
      case "redirection_conseiller":
        setShowCounselor(true);
        break;
      case "proposer_recommandations":
        // déjà affiché inline ; on ne fait rien de plus
        break;
      case "afficher_historique":
        setShowHistory(true);
        break;
      case "afficher_glossaire":
        setShowGlossary(true);
        break;
      case "suggestion": {
        const msg = (action.donnees?.message as string) || action.texte;
        // Cas spécial : "Exporter" ouvre le dialog d'export PDF
        if (msg && /export/i.test(msg)) {
          setShowExport(true);
          break;
        }
        if (msg) envoyerMessage(msg);
        break;
      }
      default:
        break;
    }
  }, [envoyerMessage]);

  const demanderRecommandations = useCallback(async () => {
    if (!utilisateur) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orientation/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utilisateurId: utilisateur.id, sessionId: session?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Impossible de générer des recommandations.");
        if (!data.profilComplet) setShowTest(true);
        return;
      }
      const recos: RiasecRecoAffichage[] = (data.recommandations || []).map((r: { metier: { id: string; nom: string; secteurActivite?: string | null; salaireMoyen?: string | null }; scoreCompatibilite: number; justification: string }) => ({
        metierId: r.metier.id,
        nom: r.metier.nom,
        score: r.scoreCompatibilite,
        justification: r.justification,
        secteur: r.metier.secteurActivite,
        salaire: r.metier.salaireMoyen,
      }));
      const recosFilieres: FiliereRecoAffichage[] = (data.recommandationsFilieres || []).map((r: { filiere: { id: string; nom: string; duree?: string | null; etablissementsDisponibles?: string | null; debouchesText?: string | null }; scoreCompatibilite: number; justification: string }) => ({
        filiereId: r.filiere.id,
        nom: r.filiere.nom,
        score: r.scoreCompatibilite,
        justification: r.justification,
        duree: r.filiere.duree,
        etablissements: r.filiere.etablissementsDisponibles
          ? r.filiere.etablissementsDisponibles.split("|").map((s: string) => s.trim()).filter(Boolean)
          : [],
        debouches: r.filiere.debouchesText,
      }));
      setLastRecommandations(recos);
      setLastRecommandationsFilieres(recosFilieres);
      setLastDominantLabel(data.dominantLabel);
      setStatsKey((k) => k + 1); // rafraîchir les stats
      const botMsg: ChatMessage = {
        id: uid(),
        role: "bot",
        content:
          `🎯 Voici vos **${recos.length} métiers recommandés** + **${recosFilieres.length} filières compatibles** (profil dominant : **${data.dominantLabel}**). Cliquez sur un métier ou une filière pour en savoir plus.`,
        timestamp: new Date().toISOString(),
        intention: "demande_recommandation",
        actions: [
          {
            type: "proposer_recommandations",
            texte: "",
            donnees: { recommandations: recos, recommandationsFilieres: recosFilieres, dominant: data.dominant },
          },
        ],
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      toast.error("Erreur lors de la génération des recommandations.");
    } finally {
      setLoading(false);
    }
  }, [utilisateur, session]);

  const voirMetier = useCallback(async (metierId: string) => {
    if (!metiers.length) return;
    const m = metiers.find((x) => x.id === metierId);
    if (!m) return;
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: `Parle-moi du métier : ${m.nom}`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    // déclencher l'envoi via l'API
    setLoading(true);
    try {
      const res = await fetch("/api/orientation/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utilisateurId: utilisateur?.id,
          sessionId: session?.id,
          message: `Parle-moi du métier : ${m.nom}`,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "bot",
          content: data.reponseSysteme,
          timestamp: new Date().toISOString(),
          intention: data.intentionDetectee,
          actions: data.actions,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [metiers, utilisateur, session]);

  const voirFiliere = useCallback(async (filiereId: string) => {
    if (!filieres.length) return;
    const f = filieres.find((x) => x.id === filiereId);
    if (!f) return;
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", content: `Parle-moi de la filière : ${f.nom}`, timestamp: new Date().toISOString() },
    ]);
    try {
      const res = await fetch("/api/orientation/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utilisateurId: utilisateur?.id,
          sessionId: session?.id,
          message: `Parle-moi de la filière : ${f.nom}`,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "bot",
          content: data.reponseSysteme,
          timestamp: new Date().toISOString(),
          intention: data.intentionDetectee,
          actions: data.actions,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [filieres, utilisateur, session]);

  const onTestCompleted = useCallback((result: TestResult) => {
    setUtilisateur(result.utilisateur);
    setLastTestResult(result);
    setLastDominantLabel(result.dominantLabel);
    const top3Texte = result.top3
      .map((t) => `• **${t.label}** (${t.score}/20) — ${t.description}`)
      .join("\n");
    const botMsg: ChatMessage = {
      id: uid(),
      role: "bot",
      content:
        `✅ Test RIASEC terminé ! Votre profil dominant est **${result.dominantLabel}**.\n\n🧭 **Vos 3 dimensions fortes** :\n${top3Texte}\n\nVous pouvez maintenant générer vos **recommandations personnalisées**.`,
      timestamp: new Date().toISOString(),
      intention: "demande_test_riasec",
      actions: [
        { type: "proposer_recommandations", texte: "Voir mes recommandations", donnees: { trigger: "recommandations" } },
        { type: "suggestion", texte: "Voir le radar détaillé", donnees: { message: "Montrez-moi mon profil complet" } },
      ],
    };
    setMessages((prev) => [...prev, botMsg]);
    setShowResult(true);
  }, []);

  const onProfilSaved = useCallback((u: Utilisateur) => {
    setUtilisateur(u);
    const botMsg: ChatMessage = {
      id: uid(),
      role: "bot",
      content:
        `📋 Profil enregistré ! Niveau : **${u.niveauEtudes ?? "non précisé"}**, Filière : **${u.serieTerminale ?? u.filiereActuelle?.nom ?? "non précisée"}**, Ville : **${u.localisation ?? "non précisée"}**.\n\nPour obtenir vos recommandations, passons maintenant le **test RIASEC** (≈ 3 min).`,
      timestamp: new Date().toISOString(),
      intention: "demarrage_profil",
      actions: [{ type: "proposer_test", texte: "Passer le test RIASEC" }],
    };
    setMessages((prev) => [...prev, botMsg]);
  }, []);

  const demarrerNouvelleConversation = useCallback(async () => {
    if (!utilisateur) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orientation/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utilisateurId: utilisateur.id }),
      });
      if (!res.ok) throw new Error();
      const newSession = await res.json();
      setSession(newSession);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ utilisateurId: utilisateur.id, sessionId: newSession.id })
      );
      setMessages([
        {
          id: uid(),
          role: "bot",
          content:
            "🔄 **Nouvelle conversation démarrée**. Vos sessions précédentes sont conservées dans votre historique. Comment puis-je vous aider ?",
          timestamp: new Date().toISOString(),
          actions: [
            { type: "suggestion", texte: "Voir mon profil", donnees: { message: "Montrez-moi mon profil" } },
            { type: "suggestion", texte: "Mes recommandations", donnees: { message: "Donnez-moi des recommandations personnalisées" } },
            { type: "suggestion", texte: "Voir l'historique", donnees: { message: "Je veux voir mon historique" } },
          ],
        },
      ]);
      setStatsKey((k) => k + 1);
      toast.success("Nouvelle conversation démarrée.");
    } catch {
      toast.error("Impossible de démarrer une nouvelle conversation.");
    } finally {
      setLoading(false);
    }
  }, [utilisateur]);

  const reinitialiserProfil = useCallback(async () => {
    if (!utilisateur) return;
    if (!window.confirm("Voulez-vous vraiment réinitialiser votre profil et recommencer ? Cette action est irréversible.")) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      // Créer un nouvel utilisateur + session
      const res = await fetch("/api/orientation/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUtilisateur(data.utilisateur);
      setSession(data.session);
      setLastTestResult(null);
      setLastRecommandations([]);
      setLastRecommandationsFilieres([]);
      setLastDominantLabel(undefined);
      setStatsKey((k) => k + 1);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ utilisateurId: data.utilisateur.id, sessionId: data.session.id })
      );
      setMessages([
        {
          id: uid(),
          role: "bot",
          content:
            "🔄 **Profil réinitialisé**. Bienvenue à nouveau sur OriensCI ! Pour bien vous accompagner, je vous propose de commencer par créer votre profil (niveau d'études, filière actuelle, localisation) puis de passer le test RIASEC.",
          timestamp: new Date().toISOString(),
          actions: [
            { type: "demarrer_profil", texte: "Créer mon profil" },
            { type: "suggestion", texte: "Passer le test RIASEC", donnees: { message: "Je veux passer le test RIASEC" } },
          ],
        },
      ]);
      toast.success("Profil réinitialisé avec succès.");
    } catch {
      toast.error("Impossible de réinitialiser le profil.");
    }
  }, [utilisateur]);

  const quickActions = [
    { label: "Créer mon profil", icon: ClipboardList, action: () => setShowProfile(true), color: "text-primary" },
    { label: "Passer le test RIASEC", icon: Compass, action: () => setShowTest(true), color: "text-accent-foreground" },
    { label: "Mes recommandations", icon: Sparkles, action: demanderRecommandations, color: "text-primary" },
    { label: "Ma personnalité", icon: Brain, action: () => setShowPersonality(true), color: "text-foreground" },
    { label: "Comparer les filières", icon: GitCompareArrows, action: () => setShowCompare(true), color: "text-foreground" },
    { label: "Glossaire RIASEC", icon: BookMarked, action: () => setShowGlossary(true), color: "text-foreground" },
    { label: "Historique", icon: History, action: () => setShowHistory(true), color: "text-foreground" },
    { label: "Liste des filières", icon: School, action: () => envoyerMessage("Quelles filières proposez-vous ?"), color: "text-foreground" },
    { label: "Liste des métiers", icon: Briefcase, action: () => envoyerMessage("Quels métiers proposez-vous ?"), color: "text-foreground" },
    { label: "Conseiller humain", icon: HeartHandshake, action: () => setShowCounselor(true), color: "text-destructive" },
  ];

  return (
    <div className="min-h-screen flex flex-col app-bg">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/oriensci-avatar.png"
              alt=""
              aria-hidden="true"
              width={72}
              height={64}
              className="h-9 w-auto shrink-0"
            />
            <div className="min-w-0">
              <h1 className="font-bold text-[15px] leading-tight truncate">
                OriensCI
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight truncate hidden sm:block">
                Chatbot d'orientation académique & professionnelle
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Badge variant="outline" className="hidden md:inline-flex text-[10px] gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {metiers.length} métiers · {filieres.length} filières
            </Badge>
            {lastRecommandations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExport(true)}
                className="hidden sm:flex text-xs h-8"
                title="Exporter mes recommandations"
              >
                <FileDown className="h-3.5 w-3.5 mr-1" /> Exporter
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={demarrerNouvelleConversation}
              aria-label="Nouvelle conversation"
              className="h-9 w-9"
              title="Nouvelle conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {/* Toggle mode LLM */}
            <button
              type="button"
              onClick={() => {
                setLlmMode((v) => !v);
                toast.info(llmMode ? "Mode classique (mots-clés) activé" : "Mode IA conversationnelle activé — je comprends mieux et je pose les questions directement dans le chat !");
              }}
              className={`h-9 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all border ${
                llmMode
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
              }`}
              title={llmMode ? "Désactiver le mode IA conversationnelle" : "Activer le mode IA conversationnelle (LLM)"}
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{llmMode ? "IA ON" : "IA OFF"}</span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(dark ? "light" : "dark")}
              aria-label="Changer de thème"
              className="h-9 w-9"
            >
              {mounted && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-4 py-3 min-h-0">
        <div className="grid lg:grid-cols-[280px_1fr] gap-3 h-[calc(100vh-3.5rem-2.5rem-1.5rem)]">
          {/* SIDEBAR (desktop + drawer mobile) */}
          <aside
            className={`${sidebarOpen ? "block" : "hidden"} lg:block fixed lg:static inset-0 lg:inset-auto z-40 lg:z-auto bg-background lg:bg-transparent overflow-y-auto scroll-thin p-3 lg:p-0`}
          >
            <div className="flex items-center justify-between mb-2 lg:hidden">
              <span className="font-semibold text-sm">Menu</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Stepper d'onboarding */}
            {utilisateur && (
              <div className="mb-3 px-2 py-2.5 rounded-lg bg-card border border-border/60">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Progression</p>
                <OnboardingStepper etape={calculerEtape(utilisateur)} />
              </div>
            )}

            {utilisateur && (
              <ProfileSummary
                utilisateur={utilisateur}
                onEditProfil={() => { setShowProfile(true); setSidebarOpen(false); }}
                onPasserTest={() => { setShowTest(true); setSidebarOpen(false); }}
                onRecommandations={() => { demanderRecommandations(); setSidebarOpen(false); }}
                onConseiller={() => { setShowCounselor(true); setSidebarOpen(false); }}
                onReset={reinitialiserProfil}
              />
            )}

            {/* Carte statistiques */}
            {utilisateur && (
              <div key={`stats-${statsKey}`} className="mt-3">
                <StatsCard
                  utilisateurId={utilisateur.id}
                  onVoirHistorique={() => setShowHistory(true)}
                />
              </div>
            )}

            <Card className="mt-3 border-primary/20 hidden lg:block">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5" /> Actions rapides
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1">
                {quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => { qa.action(); setSidebarOpen(false); }}
                    className="flex items-center gap-2 text-[12px] px-2 py-1.5 rounded-md hover:bg-secondary text-left transition-colors"
                  >
                    <qa.icon className={`h-3.5 w-3.5 ${qa.color}`} />
                    <span>{qa.label}</span>
                    <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </aside>

          {/* CHAT */}
          <section className="flex flex-col rounded-xl border bg-card/60 overflow-hidden min-h-0 shadow-sm">
            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto scroll-thin p-3 sm:p-4 space-y-3 min-h-0"
            >
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Image
                      src="/oriensci-avatar.png"
                      alt=""
                      aria-hidden="true"
                      width={72}
                      height={64}
                      className="h-12 w-auto animate-pulse"
                    />
                    <p className="text-sm text-muted-foreground">Chargement d'OriensCI…</p>
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  onAction={handleAction}
                  onVoirMetier={voirMetier}
                  onVoirFiliere={voirFiliere}
                  onRecommandations={demanderRecommandations}
                  utilisateurId={utilisateur?.id}
                  sessionId={session?.id}
                />
              ))}
              {loading && !syntheseEnCours && (
                <div className="flex items-end gap-2">
                  <BotAvatar />
                  <div className="chat-bubble-bot px-3 py-2.5">
                    <div className="flex items-center gap-1 h-5">
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}

              {/* Écran de synthèse — animation de chargement */}
              {syntheseEnCours && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-4 max-w-sm">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                      </div>
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="font-semibold text-sm bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        Synthèse de vos résultats en cours...
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        J'analyse votre profil, vos réponses, votre personnalité et votre objectif pour vous donner la meilleure orientation possible. ✨
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions mobile */}
            <div className="lg:hidden border-t bg-background/50 px-2 py-1.5 flex gap-1 overflow-x-auto scroll-thin">
              {quickActions.map((qa) => (
                <button
                  key={qa.label}
                  onClick={qa.action}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border bg-card whitespace-nowrap shrink-0"
                >
                  <qa.icon className={`h-3 w-3 ${qa.color}`} />
                  {qa.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="border-t bg-background/80 backdrop-blur p-2 sm:p-3 shrink-0">
              {/* Indicateur de progression du test RIASEC inline */}
              {llmMode && testInlineEnCours && (
                <div className="mb-2 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/30 flex items-center gap-2 text-xs">
                  <Compass className="h-3.5 w-3.5 text-primary animate-pulse" />
                  <span className="font-medium text-primary">Test RIASEC en cours</span>
                  <span className="text-muted-foreground">— Question {testInlineEnCours.current}/{testInlineEnCours.total}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(testInlineEnCours.current / testInlineEnCours.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {Math.round((testInlineEnCours.current / testInlineEnCours.total) * 100)}%
                    </span>
                  </div>
                </div>
              )}
              <form
                onSubmit={(e) => { e.preventDefault(); envoyerMessage(); }}
                className="flex items-end gap-2"
              >
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      envoyerMessage();
                    }
                  }}
                  placeholder={
                    llmMode
                      ? testInlineEnCours
                        ? `Répondez 0 (pas du tout) à 4 (tout à fait) — Question ${testInlineEnCours.current}/${testInlineEnCours.total}`
                        : "Discutez naturellement avec l'IA (posez vos questions, l'IA vous guide)"
                      : "Posez votre question (filière, métier, débouchés, recommandation…)"
                  }
                  rows={1}
                  className="min-h-[42px] max-h-32 resize-none text-sm"
                  disabled={loading || !utilisateur}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={loading || !input.trim() || !utilisateur}
                  className="h-[42px] w-[42px] shrink-0"
                  aria-label="Envoyer"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
              <p className="text-[10px] text-muted-foreground mt-1 px-1">
                OriensCI est un prototype de recherche. Pour un conseil officiel, contactez un conseiller humain.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER (sticky) */}
      <footer className="mt-auto border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 h-10 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Image
              src="/oriensci-avatar.png"
              alt=""
              aria-hidden="true"
              width={72}
              height={64}
              className="h-4 w-auto"
            />
            <span className="font-medium text-foreground">OriensCI</span>
            <span className="hidden sm:inline">— Prototype de recherche · Modèle RIASEC de Holland</span>
            <span className="sm:hidden">· RIASEC</span>
          </span>
          <span className="hidden sm:inline">
            Contexte : Côte d'Ivoire · Terminale → Licence
          </span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>

      {/* DIALOGS */}
      {utilisateur && (
        <ProfileSetupDialog
          open={showProfile}
          onOpenChange={setShowProfile}
          utilisateur={utilisateur}
          filieres={filieres}
          onSaved={onProfilSaved}
        />
      )}
      {utilisateur && (
        <RiasecTestDialog
          open={showTest}
          onOpenChange={setShowTest}
          utilisateur={utilisateur}
          onCompleted={onTestCompleted}
        />
      )}
      <CounselorDialog
        open={showCounselor}
        onOpenChange={setShowCounselor}
        utilisateurId={utilisateur?.id}
        sessionId={session?.id}
      />

      {/* Dialog: résultats détaillés du test RIASEC */}
      <RiasecResultDialog
        open={showResult}
        onOpenChange={setShowResult}
        result={lastTestResult}
        onRecommandations={demanderRecommandations}
        onRepasser={() => { setShowResult(false); setShowTest(true); }}
        onExport={() => { setShowResult(false); setShowExport(true); }}
      />

      {/* Dialog: comparateur de filières */}
      <CompareFilieresDialog
        open={showCompare}
        onOpenChange={setShowCompare}
        filieres={filieres}
      />

      {/* Dialog: export des recommandations */}
      <ExportRecommandationsDialog
        open={showExport}
        onOpenChange={setShowExport}
        utilisateur={utilisateur}
        recommandations={lastRecommandations}
        dominantLabel={lastDominantLabel}
      />

      {/* Dialog: historique des sessions */}
      <SessionHistoryDialog
        open={showHistory}
        onOpenChange={setShowHistory}
        utilisateurId={utilisateur?.id}
      />

      {/* Dialog: glossaire RIASEC */}
      <RiasecGlossaryDialog
        open={showGlossary}
        onOpenChange={setShowGlossary}
      />

      {/* Dialog: questionnaire de personnalité */}
      {utilisateur && (
        <PersonalityQuestionnaire
          open={showPersonality}
          onOpenChange={setShowPersonality}
          utilisateur={utilisateur}
          onSaved={(u) => { setUtilisateur(u); setStatsKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

function BotAvatar() {
  return (
    <Image
      src="/oriensci-avatar.png"
      alt=""
      aria-hidden="true"
      width={36}
      height={32}
      className="h-8 w-9 shrink-0 object-contain"
    />
  );
}

function UserAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground border">
      <span className="text-[11px] font-bold">Moi</span>
    </div>
  );
}

function MessageRow({
  message,
  onAction,
  onVoirMetier,
  onVoirFiliere,
  onRecommandations,
  utilisateurId,
  sessionId,
}: {
  message: ChatMessage;
  onAction: (a: DialogueAction) => void;
  onVoirMetier: (id: string) => void;
  onVoirFiliere: (id: string) => void;
  onRecommandations: () => void;
  utilisateurId?: string;
  sessionId?: string;
}) {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex items-end gap-2 msg-in ${isUser ? "flex-row-reverse" : ""}`}>
      {isUser ? <UserAvatar /> : <BotAvatar />}
      <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
        {/* Nom + horodatage */}
        <div className={`flex items-center gap-1.5 text-[10px] text-muted-foreground ${isUser ? "flex-row-reverse" : ""}`}>
          <span className="font-semibold">
            {isUser ? "Vous" : "OriensCI"}
          </span>
          <span className="opacity-70">{time}</span>
          {!isUser && message.intention && (
            <Badge variant="outline" className="text-[9px] py-0 h-4 font-normal text-muted-foreground">
              {NLU_INTENT_LABELS[message.intention] ?? message.intention}
            </Badge>
          )}
        </div>

        <div
          className={`px-3 py-2 text-[13px] sm:text-sm leading-relaxed ${
            isUser ? "chat-bubble-user" : "chat-bubble-bot"
          }`}
        >
          <MessageMarkdown text={message.content} />
        </div>

        {/* Actions inline */}
        {!isUser && message.actions && message.actions.length > 0 && (
          <ActionRenderer
            actions={message.actions}
            onAction={onAction}
            onVoirMetier={onVoirMetier}
            onVoirFiliere={onVoirFiliere}
            onRecommandations={onRecommandations}
          />
        )}

        {/* Sources web — affichées si la réponse a été enrichie par une recherche web */}
        {!isUser && message.sourcesWeb && message.sourcesWeb.length > 0 && (
          <div className="w-full max-w-md mt-1">
            <div className="bg-muted/40 border border-border/60 rounded-lg p-2">
              <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                <Globe className="h-3 w-3" /> Sources web ({message.sourcesWeb.length})
              </p>
              <div className="space-y-1">
                {message.sourcesWeb.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[10px] hover:underline"
                  >
                    <span className="font-medium text-primary">{s.titre}</span>
                    <span className="text-muted-foreground ml-1">— {new URL(s.url).hostname}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feedback buttons (👍/👎) — seulement pour les messages du bot avec du contenu */}
        {!isUser && message.content && (
          <FeedbackButtons
            messageContent={message.content}
            intention={message.intention}
            utilisateurId={utilisateurId}
            sessionId={sessionId}
          />
        )}
      </div>
    </div>
  );
}

function ActionRenderer({
  actions,
  onAction,
  onVoirMetier,
  onVoirFiliere,
  onRecommandations,
}: {
  actions: DialogueAction[];
  onAction: (a: DialogueAction) => void;
  onVoirMetier: (id: string) => void;
  onVoirFiliere: (id: string) => void;
  onRecommandations: () => void;
}) {
  // Séparer les suggestions (chips) des autres actions
  const suggestions = actions.filter((a) => a.type === "suggestion");
  const autres = actions.filter((a) => a.type !== "suggestion");

  return (
    <>
      {autres.map((a, i) => {
        if (a.type === "proposer_recommandations") {
          const recos = (a.donnees?.recommandations as RiasecRecoAffichage[] | undefined);
          const recosFilieres = (a.donnees?.recommandationsFilieres as FiliereRecoAffichage[] | undefined);
          const dominant = a.donnees?.dominant as RiasecDimension | undefined;
          if (!recos) {
            // Bouton déclencheur
            return (
              <Button key={i} size="sm" onClick={onRecommandations} className="text-xs h-8">
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Voir mes recommandations
              </Button>
            );
          }
          return (
            <div key={i} className="w-full max-w-md space-y-2">
              <RecommendationsCard
                recommandations={recos}
                dominantLabel={dominant ? RIASEC_DIMENSIONS[dominant].label : undefined}
                onVoirMetier={onVoirMetier}
              />
              {recosFilieres && recosFilieres.length > 0 && (
                <FiliereRecommendationsCard
                  recommandations={recosFilieres}
                  onVoirFiliere={onVoirFiliere}
                />
              )}
            </div>
          );
        }
        if (a.type === "afficher_profil") {
          const profil = a.donnees?.profil as { R: number; I: number; A: number; S: number; E: number; C: number } | undefined;
          const profilComplet = a.donnees?.profilComplet as boolean | undefined;
          const dominant = a.donnees?.dominant as RiasecDimension | undefined;
          if (!profil) return null;
          return (
            <Card key={i} className="w-full max-w-md border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-primary" /> Profil RIASEC
                  {dominant && profilComplet && (
                    <Badge className="text-[10px] ml-auto" style={{ background: RIASEC_DIMENSIONS[dominant].couleur, color: "#fff" }}>
                      {RIASEC_DIMENSIONS[dominant].label}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {RIASEC_ORDER.map((d) => (
                  <div key={d} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold w-3" style={{ color: RIASEC_DIMENSIONS[d].couleur }}>
                      {d}
                    </span>
                    <div className="riasec-bar flex-1">
                      <span style={{ width: `${(profil[d] / 20) * 100}%`, background: RIASEC_DIMENSIONS[d].couleur }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">{profil[d]}/20</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        }
        if (a.type === "afficher_details_filiere") {
          const filiere = a.donnees?.filiere as FiliereDetailsData | undefined;
          if (!filiere) return null;
          return (
            <div key={i} className="w-full max-w-md">
              <FiliereDetailsCard filiere={filiere} />
            </div>
          );
        }
        if (a.type === "afficher_liste_filieres") {
          const list = (a.donnees?.filieres as { id: string; nom: string }[] | undefined) ?? [];
          return (
            <Card key={i} className="w-full max-w-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <School className="h-3.5 w-3.5 text-primary" /> Filières disponibles
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-56 overflow-y-auto scroll-thin">
                {list.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onVoirFiliere(f.id)}
                    className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded-md hover:bg-secondary text-left"
                  >
                    <span className="truncate">{f.nom}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </CardContent>
            </Card>
          );
        }
        if (a.type === "afficher_liste_metiers") {
          const list = (a.donnees?.metiers as { id: string; nom: string }[] | undefined) ?? [];
          return (
            <Card key={i} className="w-full max-w-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-primary" /> Métiers disponibles
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-56 overflow-y-auto scroll-thin">
                {list.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onVoirMetier(m.id)}
                    className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded-md hover:bg-secondary text-left"
                  >
                    <span className="truncate">{m.nom}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </CardContent>
            </Card>
          );
        }
        // Boutons simples (proposer_test, demarrer_profil, redirection_conseiller)
        const label = a.texte || defaultLabel(a.type);
        return (
          <Button
            key={i}
            size="sm"
            variant={a.type === "redirection_conseiller" ? "outline" : "default"}
            onClick={() => onAction(a)}
            className="text-xs h-8"
          >
            {iconFor(a.type)} {label}
          </Button>
        );
      })}

      {/* Suggestion chips (quick replies) */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-md">
          {suggestions.map((s, i) => (
            <button
              key={`sugg-${i}`}
              type="button"
              onClick={() => onAction(s)}
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border border-primary/40 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
            >
              <MessageCircle className="h-3 w-3" />
              {s.texte}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function defaultLabel(type: DialogueAction["type"]): string {
  switch (type) {
    case "proposer_test": return "Passer le test RIASEC";
    case "demarrer_profil": return "Créer mon profil";
    case "redirection_conseiller": return "Parler à un conseiller";
    case "afficher_historique": return "Ouvrir l'historique";
    case "afficher_glossaire": return "Ouvrir le glossaire";
    default: return "OK";
  }
}

function iconFor(type: DialogueAction["type"]): React.ReactNode {
  switch (type) {
    case "proposer_test": return <Compass className="h-3.5 w-3.5 mr-1" />;
    case "demarrer_profil": return <ClipboardList className="h-3.5 w-3.5 mr-1" />;
    case "redirection_conseiller": return <HeartHandshake className="h-3.5 w-3.5 mr-1" />;
    case "afficher_historique": return <History className="h-3.5 w-3.5 mr-1" />;
    case "afficher_glossaire": return <BookMarked className="h-3.5 w-3.5 mr-1" />;
    default: return null;
  }
}
