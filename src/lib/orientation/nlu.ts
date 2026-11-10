// Module NLU (Natural Language Understanding) — détection d'intention par mots-clés
// Conforme au mémoire : approche par règles/mots-clés, pas de LLM externe.
import type { RiasecDimension } from "./riasec-constants";

export type IntentLabel =
  | "salutation"
  | "recherche_filiere"
  | "recherche_metier"
  | "demande_debouches"
  | "demande_recommandation"
  | "demande_test_riasec"
  | "consultation_profil"
  | "aide_conseiller"
  | "remerciement"
  | "demarrage_profil"
  | "information_generale";

export interface NluResult {
  intent: IntentLabel;
  confidence: number; // 0..1
  entities: {
    filiereNom?: string;      // filière détectée par correspondance de nom
    metierNom?: string;       // métier détecté
    dimensionRiasec?: RiasecDimension; // dimension RIASEC mentionnée
    motCleDomaine?: string;   // mot-clé de domaine (ex : "informatique")
  };
  messageNormalise: string;
}

// Dictionnaires de mots-clés par intention
const KEYWORDS: Record<IntentLabel, string[]> = {
  salutation: [
    "bonjour", "bonsoir", "salut", "coucou", "hello", "bon apr\u00e8s-midi", "enchante", "cc",
    "comment allez-vous", "comment allez vous", "comment \u00e7a va", "comment ca va",
    "comment vas-tu", "comment vas tu", "ca va",
  ],
  remerciement: ["merci", "thanks", "super", "g\u00e9nial", "parfait", "nickel", "cool", "ok merci", "merci beaucoup"],
  demande_test_riasec: ["test", "riasec", "holland", "test d'int\u00e9r\u00eat", "test de personnalit\u00e9", "passer le test", "faire le test", "questionnaire"],
  demande_recommandation: [
    "recommande", "recommandation", "recommandations",
    "recommandation personnalis\u00e9e", "recommandations personnalis\u00e9es",
    "recommandations compl\u00e8tes", "mes recommandations",
    "donnez-moi des recommandations", "je veux des recommandations",
    "conseille", "conseillez", "quel m\u00e9tier", "quelle filiere", "orienter", "orientation",
    "pour moi", "selon mon profil", "adapter", "adapte", "suggere", "sugg\u00e9rez", "propose",
  ],
  demande_debouches: ["debouch\u00e9", "debouches", "d\u00e9bouch\u00e9", "d\u00e9bouch\u00e9s", "sortie", "sorties", "travailler apr\u00e8s", "m\u00e9tier apr\u00e8s", "que faire avec", "opportunit\u00e9", "opportunit\u00e9s", "emploi", "carri\u00e8re"],
  aide_conseiller: ["conseiller", "conseill\u00e8re", "humain", "agent", "personne r\u00e9elle", "parler \u00e0 quelqu'un", "orientateur", "psychologue", "sp\u00e9cialiste", "contact", "contacter", "humain svp"],
  consultation_profil: ["mon profil", "mes scores", "mes resultats", "mes r\u00e9sultats", "mon riasec", "mon test", "voir mon profil", "mon compte", "mon historique", "historique", "sessions pr\u00e9c\u00e9dentes", "mes sessions", "glossaire", "glossaire riasec", "explique riasec", "expliquez riasec", "mod\u00e8le de holland", "mod\u00e8le holland", "qu'est-ce que riasec", "comprendre riasec"],
  demarrage_profil: ["profil", "commencer", "d\u00e9marrer", "m'inscrire", "cr\u00e9er mon profil", "renseigner", "renseigne", "niveau d'\u00e9tude", "niveau d'etude", "ma filiere", "ma fili\u00e8re", "je suis en", "terminal", "terminale", "licence", "ma ville", "localisation"],
  recherche_metier: ["m\u00e9tier", "metier", "m\u00e9tiers", "metiers", "profession", "travail", "poste", "job", "carriere", "m\u00e9tier de", "c'est quoi un", "comment devenir", "formation pour"],
  recherche_filiere: ["filiere", "fili\u00e8re", "filieres", "fili\u00e8res", "formation", "etudes", "\u00e9tudes", "curcus", "curcus universitaire", "parcours", "sp\u00e9cialit\u00e9", "branche", "enseignement", "diplome", "dipl\u00f4me"],
  information_generale: ["comment", "aide", "help", "quoi", "que peux-tu", "que pouvez-vous", "qui es-tu", "qui etes-vous", "comment \u00e7a marche", "fonctionnement", "pr\u00e9sentation"],
};

// Mots-clés de dimension RIASEC
const RIASEC_KEYWORDS: Record<RiasecDimension, string[]> = {
  R: ["manuel", "technique", "bricoler", "r\u00e9parer", "construire", "outil", "machine", "plein air", "terre", "moteur", "terrain"],
  I: ["recherche", "science", "analyser", "d\u00e9couvrir", "investiguer", "logique", "math", "physique", "svt", "biologie", "exp\u00e9rience", "chercheur"],
  A: ["art", "cr\u00e9atif", "cr\u00e9er", "dessin", "musique", "design", "imaginer", "expression", "th\u00e9\u00e2tre", "peindre", "style", "artistique"],
  S: ["aider", "enseigner", "soigner", "accompagner", "gens", "équipe", "\u00e9quipe", "social", "bienveillance", "soutenir", "former", "enseignement"],
  E: ["leader", "diriger", "entreprendre", "business", "vendre", "persuader", "convaincre", "manager", "responsable", "projet", "initiative"],
  C: ["organiser", "rigueur", "m\u00e9thode", "chiffre", "comptable", "donn\u00e9es", "classer", "structure", "proc\u00e9dure", "pr\u00e9cis", "compte"],
};

const CORRECTIONS_COURANTES: Record<string, string> = {
  veu: "veux",
  fair: "faire",
  filier: "filiere",
  informatik: "informatique",
  oriantation: "orientation",
};

function normaliser(msg: string): string {
  return msg
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprimer les accents
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => CORRECTIONS_COURANTES[word] ?? word)
    .join(" ");
}

// Compter les occurrences de mots-clés
function compterOccurrences(texte: string, motsCles: string[]): { count: number; matched: string[] } {
  let count = 0;
  const matched: string[] = [];
  for (const mc of motsCles) {
    const mcNorm = normaliser(mc);
    if (mcNorm.length < 3) continue;
    // matcher comme mot ou sous-chaîne entouré d'espaces/début/fin
    const regex = new RegExp(`(^|\\s)${echapperRegex(mcNorm)}(\\s|$)`, "g");
    const matches = texte.match(regex);
    if (matches && matches.length > 0) {
      count += matches.length;
      matched.push(mc);
    }
  }
  return { count, matched };
}

function echapperRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Détecter une entité filière/métier par similarité de nom (sur le message original et normalisé)
function detecterEntiteNom<T extends { nom: string }>(
  messageNorm: string,
  items: T[]
): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const nomNorm = normaliser(item.nom);
    if (nomNorm.length < 3) continue;
    // correspondance directe
    if (messageNorm.includes(nomNorm)) {
      const score = nomNorm.split(" ").length / 10 + 0.8;
      if (!best || score > best.score) best = { item, score };
      continue;
    }
    // correspondance sur les mots significatifs du nom
    const motsSignificatifs = nomNorm.split(" ").filter((m) => m.length > 3);
    let matched = 0;
    for (const m of motsSignificatifs) {
      if (messageNorm.includes(m)) matched++;
    }
    if (matched > 0 && motsSignificatifs.length > 0) {
      const score = (matched / motsSignificatifs.length) * 0.6;
      if (!best || score > best.score) best = { item, score };
    }
  }
  return best;
}

// Détecter une dimension RIASEC mentionnée
function detecterDimensionRiasec(messageNorm: string): RiasecDimension | undefined {
  let best: { dim: RiasecDimension; count: number } | null = null;
  for (const dim of Object.keys(RIASEC_KEYWORDS) as RiasecDimension[]) {
    const { count } = compterOccurrences(messageNorm, RIASEC_KEYWORDS[dim]);
    if (count > 0 && (!best || count > best.count)) {
      best = { dim, count };
    }
  }
  return best?.dim;
}

function detecterMotCleDomaine(messageNorm: string, domainesParFiliere: { id: string; nom: string; domaines: string[] }[]): { filiereId: string; nom: string; mot: string } | null {
  let best: { filiereId: string; nom: string; mot: string; len: number } | null = null;
  for (const f of domainesParFiliere) {
    for (const d of f.domaines) {
      const dNorm = normaliser(d);
      if (dNorm.length < 4) continue;
      if (messageNorm.includes(dNorm)) {
        if (!best || dNorm.length > best.len) {
          best = { filiereId: f.id, nom: f.nom, mot: d, len: dNorm.length };
        }
      }
    }
  }
  return best ? { filiereId: best.filiereId, nom: best.nom, mot: best.mot } : null;
}

export interface NluContext {
  filieres: { id: string; nom: string; domaines: string[] }[];
  metiers: { id: string; nom: string }[];
  motsAppris?: Record<string, string[]>; // intention -> mots-clés appris via feedback
}

export function analyserMessage(message: string, ctx: NluContext): NluResult {
  const messageNorm = normaliser(message);
  // Fusionner les mots-clés statiques avec les mots-clés appris
  const mergedKeywords: Record<IntentLabel, string[]> = { ...KEYWORDS };
  if (ctx.motsAppris) {
    for (const [intent, mots] of Object.entries(ctx.motsAppris)) {
      const key = intent as IntentLabel;
      if (mergedKeywords[key]) {
        mergedKeywords[key] = [...mergedKeywords[key], ...mots];
      }
    }
  }
  const scores: Record<IntentLabel, { count: number; matched: string[] }> = {
    salutation: compterOccurrences(messageNorm, mergedKeywords.salutation),
    remerciement: compterOccurrences(messageNorm, mergedKeywords.remerciement),
    demande_test_riasec: compterOccurrences(messageNorm, mergedKeywords.demande_test_riasec),
    demande_recommandation: compterOccurrences(messageNorm, mergedKeywords.demande_recommandation),
    demande_debouches: compterOccurrences(messageNorm, mergedKeywords.demande_debouches),
    aide_conseiller: compterOccurrences(messageNorm, mergedKeywords.aide_conseiller),
    consultation_profil: compterOccurrences(messageNorm, mergedKeywords.consultation_profil),
    demarrage_profil: compterOccurrences(messageNorm, mergedKeywords.demarrage_profil),
    recherche_metier: compterOccurrences(messageNorm, mergedKeywords.recherche_metier),
    recherche_filiere: compterOccurrences(messageNorm, mergedKeywords.recherche_filiere),
    information_generale: compterOccurrences(messageNorm, mergedKeywords.information_generale),
  };

  // Détection d'entités
  const filiereDetectee = detecterEntiteNom(messageNorm, ctx.filieres.map((f) => ({ id: f.id, nom: f.nom })));
  const metierDetecte = detecterEntiteNom(messageNorm, ctx.metiers);
  const dimensionRiasec = detecterDimensionRiasec(messageNorm);
  const motCleDomaine = detecterMotCleDomaine(messageNorm, ctx.filieres);

  // Ordre de priorité pour départager les intentions à score égal
  const priorite: IntentLabel[] = [
    "salutation",
    "remerciement",
    "aide_conseiller",
    "demande_test_riasec",
    "consultation_profil",
    "demarrage_profil",
    "demande_recommandation",
    "demande_debouches",
    "recherche_metier",
    "recherche_filiere",
    "information_generale",
  ];

  // Score pondéré : on privilégie les intentions avec entités détectées quand pertinent
  let bestIntent: IntentLabel = "information_generale";
  let bestScore = 0;
  for (const intent of priorite) {
    const s = scores[intent];
    let score = s.count;
    // bonus si une entité correspond à l'intention
    if (intent === "recherche_filiere" && (filiereDetectee || motCleDomaine)) score += 0.5;
    if (intent === "recherche_metier" && metierDetecte) score += 0.5;
    if (intent === "demande_debouches" && (filiereDetectee || metierDetecte || motCleDomaine)) score += 0.3;
    if (intent === "demande_recommandation" && dimensionRiasec) score += 0.3;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  // Cas spécial : "salut" peut être pris pour "salutation" mais aussi court message générique
  const confidence = Math.min(1, bestScore / 2);

  return {
    intent: bestIntent,
    confidence,
    entities: {
      filiereNom: filiereDetectee?.item.nom ?? (motCleDomaine ? motCleDomaine.nom : undefined),
      metierNom: metierDetecte?.item.nom,
      dimensionRiasec,
      motCleDomaine: motCleDomaine?.mot,
    },
    messageNormalise: messageNorm,
  };
}

export const NLU_INTENT_LABELS_HUMAN: Record<IntentLabel, string> = {
  salutation: "Salutation",
  recherche_filiere: "Recherche de filière",
  recherche_metier: "Recherche de métier",
  demande_debouches: "Demande de débouchés",
  demande_recommandation: "Demande de recommandation",
  demande_test_riasec: "Demande du test RIASEC",
  consultation_profil: "Consultation de profil",
  aide_conseiller: "Demande d'aide humaine",
  remerciement: "Remerciement",
  demarrage_profil: "Démarrage du profil",
  information_generale: "Information générale",
};
