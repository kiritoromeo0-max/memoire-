// Service LLM pour OriensCI — utilise z-ai-web-dev-sdk (backend only)
// Le LLM gère la conversation naturelle, collecte le profil inline,
// pose le test RIASEC dans le chat, et ramène l'utilisateur vers l'objectif.
import ZAI from "z-ai-web-dev-sdk";
import { db } from "../db";
import {
  RIASEC_DIMENSIONS,
  RIASEC_ORDER,
  RIASEC_QUESTIONS,
  type RiasecDimension,
} from "./riasec-constants";
import {
  profilDominant,
  recommander,
  similariteRapide,
} from "./recommendation";

export class LlmServiceUnavailableError extends Error {
  constructor() {
    super("LLM provider is unavailable");
    this.name = "LlmServiceUnavailableError";
  }
}

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Recherche web — utilise zai.functions.invoke('web_search')
// Permet au LLM de vérifier/confirmer des infos factuelles sur internet.
interface WebSearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
}

async function chercherWeb(query: string, num = 4): Promise<WebSearchResult[]> {
  try {
    const zai = await getZai();
    const results = await zai.functions.invoke("web_search", { query, num });
    if (!Array.isArray(results)) return [];
    return results.slice(0, num).map((r: WebSearchResult) => ({
      url: r.url,
      name: r.name,
      snippet: r.snippet,
      host_name: r.host_name,
    }));
  } catch (e) {
    console.error("[LLM] web_search erreur:", e);
    return [];
  }
}

export interface LlmAction {
  type:
    | "profil_collecte"
    | "test_riasec_question"
    | "test_riasec_termine"
    | "synthese_en_cours"
    | "recommandations_generees"
    | "redirection_conseiller"
    | "afficher_filiere"
    | "afficher_metier"
    | "information"
    | "suggestion"
    | "web_search";
  // données sérialisables renvoyées au client
  donnees?: Record<string, unknown>;
}

export interface LlmResponse {
  reponse: string;
  actions: LlmAction[];
  profilMisAJour?: boolean;
  testProgress?: { current: number; total: number };
  sourcesWeb?: Array<{ titre: string; url: string; extrait: string }>;
  scoresCalcules?: { scores: Record<RiasecDimension, number>; dominant: RiasecDimension; dominantLabel: string };
}

// Build the system prompt with all context
function buildSystemPrompt(params: {
  utilisateur: {
    id: string;
    niveauEtudes: string | null;
    serieTerminale?: string | null;
    filiereActuelle?: { nom: string } | null;
    filiereSouhaitee: string | null;
    localisation: string | null;
    scoreRealiste: number;
    scoreInvestigateur: number;
    scoreArtistique: number;
    scoreSocial: number;
    scoreEntreprenant: number;
    scoreConventionnel: number;
    profilDominant: string | null;
    ambition: number | null;
    rythme: number | null;
    autonomie: number | null;
    styleTravail: string | null;
    toleranceStress: number | null;
  };
  filieres: Array<{ nom: string; description: string | null; duree: string | null; domaines: string | null }>;
  metiers: Array<{ nom: string; secteurActivite: string | null; description: string | null }>;
  testEnCours: { current: number; reponses: Record<number, number> } | null;
  scoresCalculesFlag?: boolean;
}): string {
  const { utilisateur, filieres, metiers, testEnCours, scoresCalculesFlag } = params;
  const profilComplet =
    utilisateur.scoreRealiste + utilisateur.scoreInvestigateur + utilisateur.scoreArtistique +
    utilisateur.scoreSocial + utilisateur.scoreEntreprenant + utilisateur.scoreConventionnel > 0;

  const filieresList = filieres.map((f) => `- ${f.nom}${f.description ? ` : ${f.description.slice(0, 80)}` : ""}`).join("\n");
  const metiersList = metiers.slice(0, 20).map((m) => `- ${m.nom} (${m.secteurActivite ?? "secteur non précisé"})`).join("\n");

  // Les 30 questions RIASEC officielles (à poser DANS L'ORDRE, sans improviser)
  const questionsRiasecList = RIASEC_QUESTIONS.map((q) => `${q.ordre}. [${q.dimension}] ${q.enonce}`).join("\n");

  return `Tu es **OriensCI**, un assistant d'orientation académique et professionnelle pour les élèves et étudiants ivoiriens (niveau Terminale à Licence). Tu aides l'utilisateur à choisir une filière et un métier en te basant sur le modèle RIASEC de Holland.

# TA MISSION
1. Connaître l'utilisateur : niveau d'études, filière actuelle, localisation, centres d'intérêt, personnalité.
2. Lui faire passer le test RIASEC (30 affirmations) directement dans le chat, une par une.
3. Calculer ses scores et générer des recommandations personnalisées (métiers + filières).
4. Répondre à ses questions sur les filières, métiers, débouchés (en utilisant la base de connaissances).
5. Le ramener vers l'objectif s'il dérive, avec bienveillance.

# CONTEXTE DE L'UTILISATEUR ACTUEL
- Niveau d'études : ${utilisateur.niveauEtudes ?? "non renseigné"}
- Filière actuelle : ${utilisateur.serieTerminale ?? utilisateur.filiereActuelle?.nom ?? "non renseignée"}
- Filière souhaitée : ${utilisateur.filiereSouhaitee ?? "non renseignée"}
- Localisation : ${utilisateur.localisation ?? "non renseignée"}
- Test RIASEC passé : ${profilComplet ? "OUI" : "NON"}
${profilComplet ? `- Scores : R=${utilisateur.scoreRealiste}/20, I=${utilisateur.scoreInvestigateur}/20, A=${utilisateur.scoreArtistique}/20, S=${utilisateur.scoreSocial}/20, E=${utilisateur.scoreEntreprenant}/20, C=${utilisateur.scoreConventionnel}/20
- Profil dominant : ${utilisateur.profilDominant ?? "non calculé"}` : ""}
- Personnalité : ambition=${utilisateur.ambition ?? "?"}/5, rythme=${utilisateur.rythme ?? "?"}/5, autonomie=${utilisateur.autonomie ?? "?"}/5, style=${utilisateur.styleTravail ?? "?"}, stress=${utilisateur.toleranceStress ?? "?"}/5
${testEnCours && testEnCours.current <= 30 ? `
# ⚠️ TEST RIASEC EN COURS — QUESTION ${testEnCours.current}/30
Le système a enregistré ${Object.keys(testEnCours.reponses).length} réponses. Tu es maintenant à la question ${testEnCours.current}.
**Tu DOIS poser EXACTEMENT cette affirmation (question ${testEnCours.current}) :**
"${RIASEC_QUESTIONS[testEnCours.current - 1]?.enonce ?? "ERREUR"}"

Réponds en JSON avec :
- "reponse" : un court message de transition (ex: "Merci ! Voici la question ${testEnCours.current} :") SUIVI de l'affirmation exacte ci-dessus
- "actions" : [{ "type": "test_riasec_question", "donnees": { "ordre": ${testEnCours.current}, "dimension": "${RIASEC_QUESTIONS[testEnCours.current - 1]?.dimension}", "enonce": "${RIASEC_QUESTIONS[testEnCours.current - 1]?.enonce}" } }]

Ne pose AUCUNE autre question. Ne commente pas la réponse précédente longuement. Sois bref et passe à la question ${testEnCours.current}.
` : ""}
${scoresCalculesFlag ? `
# ✅ TEST RIASEC TERMINÉ
Le test vient de se terminer. Les scores ont été calculés par le système :
- R=${utilisateur.scoreRealiste}/20, I=${utilisateur.scoreInvestigateur}/20, A=${utilisateur.scoreArtistique}/20, S=${utilisateur.scoreSocial}/20, E=${utilisateur.scoreEntreprenant}/20, C=${utilisateur.scoreConventionnel}/20
- Profil dominant : ${utilisateur.profilDominant}

**Félicite l'utilisateur brièvement, puis dis-lui que tu vas maintenant synthétiser tous ses résultats.** Génère l'action "test_riasec_termine" et l'action "synthese_en_cours".
` : ""}

# BASE DE CONNAISSANCES
## Filières disponibles (contexte ivoirien) :
${filieresList}

## Métiers (extrait) :
${metiersList}

# MODÈLE RIASEC (Holland)
- R = Réaliste (manuel, technique, plein air)
- I = Investigateur (recherche, analyse, science)
- A = Artistique (créativité, expression, design)
- S = Social (aider, enseigner, soigner)
- E = Entreprenant (diriger, persuader, entreprendre)
- C = Conventionnel (organiser, rigueur, chiffres)

# RÈGLES DE CONVERSATION
1. **Langue** : Tu parles en français, de manière chaleureuse et accessible (l'utilisateur est un jeune ivoirien).
2. **Concision** : Réponses courtes (max 150 mots) sauf si l'utilisateur demande du détail.
3. **Profil inline (MISE À JOUR AUTOMATIQUE)** : Collecte TOUTES les infos de profil au fil de la conversation — niveau d'études, ville, filière souhaitée, filière actuelle, et personnalité (ambition, rythme, autonomie, style de travail, tolérance au stress). **Dès que l'utilisateur mentionne une de ces infos (même incidemment), génère immédiatement l'action "profil_collecte" correspondante** — le système sauvegarde automatiquement, sans confirmation. Ne redemande jamais une info déjà collectée. Pose UNE question à la fois si une info manque, naturellement dans la conversation.
4. **Test RIASEC inline** : Si l'utilisateur n'a pas passé le test et que le moment est opportun (après le profil de base), propose de le passer. S'il accepte, pose les 30 affirmations **EXACTEMENT COMME LISTÉES CI-DESSOUS, DANS L'ORDRE, UNE PAR UNE**. Ne improvise JAMAIS de questions — utilise UNIQUEMENT les 30 affirmations officielles. **IMPORTANT : inclus TOUJOURS l'énoncé complet de l'affirmation dans le champ "reponse" de ton JSON** (ne dis pas juste "voici la question" — écris l'affirmation en entier). Pour chaque affirmation, demande à l'utilisateur d'indiquer son niveau d'accord (0 = pas du tout d'accord, 1 = plutôt en désaccord, 2 = neutre, 3 = plutôt d'accord, 4 = tout à fait d'accord). Accepte aussi les réponses en langage naturel ("d'accord", "pas d'accord", "oui", "non", "tout à fait"). Après chaque réponse, passe à la question suivante SANS répéter les questions précédentes. Quand les 30 sont répondues, déclenche l'action "test_riasec_termine".

## LES 30 QUESTIONS RIASEC OFFICIELLES (à poser DANS L'ORDRE, sans modification)
${questionsRiasecList}

**IMPORTANT** : Tu DOIS poser ces questions une par une, dans l'ordre (1, puis 2, puis 3... jusqu'à 30). Ne répète JAMAIS une question déjà posée. Ne saute JAMAIS de question. Ne reformule pas — pose l'affirmation exactement telle quelle (sans le préfixe [R] ou autre). Inclus l'énoncé complet dans ta réponse.
5. **Digressions** : Si l'utilisateur dévie, réponds brièvement à sa question puis ramène-le avec douceur vers l'orientation ("Au fait, pour bien vous orienter...").
6. **Recommandations** : Quand le test est terminé, propose de générer les recommandations.
7. **Conseiller humain** : Si la demande dépasse tes capacités, propose la redirection vers un conseiller humain.
8. **Recherche web (IMPORTANT)** : Si l'utilisateur pose une question factuelle qui nécessite des informations à jour ou que tu n'es pas sûr de la réponse (ex : dates de concours, salaires précis, établissements spécifiques, débouchés actuels, actualité), **DEMANDE UNE RECHERCHE WEB** en utilisant l'action "web_search". Le système effectuera la recherche sur internet et te renverra les résultats pour que tu puisse donner une réponse vérifiée et à jour. NE DONNE JAMAIS d'information factuelle dont tu n'es pas certain — demande plutôt une recherche web.
   - Exemples de questions nécessitant une recherche : "Quelle est la date du concours INP-HB ?", "Quel est le salaire d'un médecin en Côte d'Ivoire ?", "Quelles écoles proposent le génie civil à Abidjan ?", "Quels sont les débouchés de l'agronomie en 2025 ?"
   - Pour demander une recherche : action "web_search" avec donnees: { requete: "ta requête de recherche optimisée" }
   - Quand tu reçois les résultats de recherche, cite les sources (nom du site) dans ta réponse.

# FORMAT DE RÉPONSE (OBLIGATOIRE)
Tu DOIS répondre en JSON valide uniquement, avec cette structure exacte :
\`\`\`json
{
  "reponse": "ton message à l'utilisateur (texte simple, peut contenir **gras** et listes)",
  "actions": [
    {
      "type": "un_des_types_ci_dessous",
      "donnees": { ... }
    }
  ]
}
\`\`\`

## Types d'actions possibles :
- "profil_collecte" : quand tu as récupéré une info de profil. donnees: { champ, valeur }. **Le système sauvegarde automatiquement chaque info en base — tu n'as rien à gérer.** Champs possibles :
  - "niveauEtudes" (string) : "Terminale", "Licence 1", "Bac obtenu", etc.
  - "localisation" (string) : ville ("Abidjan", "Bouaké", "Yamoussoukro", etc.)
  - "filiereSouhaitee" (string) : filière qui intéresse l'utilisateur ("Informatique", "Médecine", etc.)
  - "filiereActuelle" (string) : filière actuelle de l'utilisateur (nom exact d'une filière de la base)
  - "ambition" (string 1-5) : niveau d'ambition (1=prudent, 5=très ambitieux)
  - "rythme" (string 1-5) : rythme de travail préféré (1=lent, 5=rapide)
  - "autonomie" (string 1-5) : niveau d'autonomie (1=encadré, 5=très autonome)
  - "toleranceStress" (string 1-5) : tolérance au stress (1=faible, 5=élevée)
  - "styleTravail" (string) : "solo", "equipe", ou "mixte"
  - **IMPORTANT** : Dès que l'utilisateur mentionne une de ces infos (même incidemment dans la conversation), génère l'action "profil_collecte" correspondante. Le profil se met à jour automatiquement. Ne demande pas confirmation — sauvegarde directement.
- "test_riasec_question" : quand tu poses une question du test. donnees: { ordre: number (1-30), dimension: "R"|"I"|"A"|"S"|"E"|"C", enonce: string }
- "test_riasec_termine" : quand les 30 questions sont répondues. donnees: {} (le système calculera les scores)
- "recommandations_generees" : pour déclencher la génération de recommandations. donnees: {}
- "redirection_conseiller" : pour rediriger vers un conseiller humain. donnees: {}
- "afficher_filiere" : pour afficher la fiche détaillée d'une filière. donnees: { nom: string }
- "afficher_metier" : pour afficher la fiche d'un métier. donnees: { nom: string }
- "web_search" : pour demander une recherche web (infos factuelles, à jour). donnees: { requete: string } — IMPORTANT : quand tu utilises cette action, mets juste un court message d'attente dans "reponse" (ex: "Je recherche cela sur internet..."). Le système relancera le LLM avec les résultats.
- "suggestion" : pour proposer des réponses rapides. donnees: { message: string } (peut être multiple)
- "information" : action neutre, juste du texte. donnees: {} (ou omis)

## Exemples :
- Profil manquant → pose la question + action "information"
- Question du test → action "test_riasec_question" avec l'énoncé
- Test fini → action "test_riasec_termine"
- User demande reco → action "recommandations_generees"
- User demande info factuelle (date concours, salaire précis) → action "web_search" avec requete optimisée + message d'attente

# IMPORTANT
- Réponds TOUJOURS en JSON valide, sans texte avant ou après.
- Le champ "reponse" contient ton message en langage naturel.
- Les "actions" indiquent au système ce qu'il doit faire (sauvegarder, calculer, etc.).
- Tu peux mettre plusieurs actions (ex: reponse + suggestion).
- Sois empathique et encourageant. L'orientation est un moment clé de vie.`;
}

// Extract profile info from the LLM response (action profil_collecte)
// Met à jour le profil automatiquement à chaque info reçue.
async function applyProfilCollecte(utilisateurId: string, champ: string, valeur: string): Promise<boolean> {
  const data: Record<string, unknown> = {};

  // Champs de profil de base
  if (champ === "niveauEtudes") data.niveauEtudes = valeur;
  else if (champ === "localisation") data.localisation = valeur;
  else if (champ === "filiereSouhaitee") data.filiereSouhaitee = valeur;
  // Filière actuelle : le LLM peut donner le nom, on cherche l'ID
  else if (champ === "filiereActuelle") {
    const f = await db.filiere.findFirst({ where: { nom: { equals: valeur } } });
    if (f) data.filiereActuelleId = f.id;
    else return false;
  }
  // Champs de personnalité (échelle 1-5 ou string)
  else if (champ === "ambition") {
    const n = parseInt(valeur);
    if (n >= 1 && n <= 5) data.ambition = n;
    else return false;
  } else if (champ === "rythme") {
    const n = parseInt(valeur);
    if (n >= 1 && n <= 5) data.rythme = n;
    else return false;
  } else if (champ === "autonomie") {
    const n = parseInt(valeur);
    if (n >= 1 && n <= 5) data.autonomie = n;
    else return false;
  } else if (champ === "toleranceStress") {
    const n = parseInt(valeur);
    if (n >= 1 && n <= 5) data.toleranceStress = n;
    else return false;
  } else if (champ === "styleTravail") {
    if (["solo", "equipe", "mixte"].includes(valeur)) data.styleTravail = valeur;
    else return false;
  } else {
    return false;
  }

  await db.utilisateur.update({ where: { id: utilisateurId }, data });
  return true;
}

// Parse the LLM JSON response
function parseLlmResponse(raw: string): { reponse: string; actions: LlmAction[] } {
  // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
  let jsonStr = raw.trim();
  // Remove markdown code fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      reponse: parsed.reponse ?? raw,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    // If JSON parse fails, return the raw text as the response
    return { reponse: raw, actions: [] };
  }
}

export interface LlmChatInput {
  utilisateurId: string;
  sessionId: string;
  message: string;
  // Conversation history (last N messages)
  historique: Array<{ role: "user" | "assistant"; content: string }>;
}

// Extrait une réponse 0-4 depuis un message en langage naturel
function extraireReponse(message: string): number | null {
  const msgLower = message.toLowerCase().trim();
  // Chiffre direct 0-4
  const numMatch = msgLower.match(/\b([0-4])\b/);
  if (numMatch) return parseInt(numMatch[1]);
  // Langage naturel
  if (/tout a fait|totalement|completement|absolument|tres d'accord|tout à fait/.test(msgLower)) return 4;
  if (/plutot d'accord|plutôt d'accord|d'accord|^oui$|oui tout|ca me correspond|j'aime|j aime|j adore/.test(msgLower)) return 3;
  if (/neutre|^bof$|moyen|mitige|mitigé|ni oui ni non/.test(msgLower)) return 2;
  if (/plutot pas|plutôt pas|pas vraiment|pas d'accord|pas d accord|^non$|bof non|pas trop/.test(msgLower)) return 1;
  if (/pas du tout|jamais|categoriquement|deteste|déteste|absolument pas/.test(msgLower)) return 0;
  return null;
}

export async function gererChatLlm(input: LlmChatInput): Promise<LlmResponse> {
  const { utilisateurId, sessionId, message } = input;

  // Load user
  const utilisateur = await db.utilisateur.findUnique({
    where: { id: utilisateurId },
    include: { filiereActuelle: true },
  });
  if (!utilisateur) {
    return {
      reponse: "Je ne trouve pas votre profil. Veuillez recharger la page.",
      actions: [],
    };
  }

  // Load knowledge base
  const filieres = await db.filiere.findMany({ select: { nom: true, description: true, duree: true, domaines: true } });
  const metiers = await db.metier.findMany({ select: { nom: true, secteurActivite: true, description: true } });

  // Load test state from last interaction metadata
  // testState: { current: number (1-30), reponses: Record<ordre, valeur>, demarre: boolean }
  const lastInteractions = await db.interaction.findMany({
    where: { sessionId },
    orderBy: { dateHeure: "desc" },
    take: 50,
  });

  let testState: { current: number; reponses: Record<number, number>; demarre: boolean } | null = null;
  let testTermine = false;
  for (const it of lastInteractions.reverse()) {
    if (it.metadata) {
      try {
        const meta = JSON.parse(it.metadata);
        if (meta.testState) {
          testState = meta.testState;
        }
        if (meta.testTermine) {
          testState = null;
          testTermine = true;
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }

  // === LOGIQUE DE TEST CONTROLÉE PAR LE BACKEND ===
  // Si le test est en cours, on extrait la réponse et on incrémente
  let testProgress: { current: number; total: number } | undefined;
  let scoresCalcules: { scores: Record<RiasecDimension, number>; dominant: RiasecDimension } | null = null;

  if (testState && testState.demarre && !testTermine) {
    // L'utilisateur est en train de passer le test
    // Essayer d'extraire une réponse de son message
    const reponse = extraireReponse(message);
    if (reponse !== null && testState.current <= 30) {
      // Enregistrer la réponse à la question actuelle
      testState.reponses[testState.current] = reponse;
      // Incrémenter la question
      testState.current += 1;

      // Si on a dépassé la question 30, le test est terminé
      if (testState.current > 30) {
        testTermine = true;
        // Calculer les scores
        const scores: Record<RiasecDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
        for (const q of RIASEC_QUESTIONS) {
          const val = testState.reponses[q.ordre];
          if (typeof val === "number") {
            scores[q.dimension] += val;
          }
        }
        for (const k of RIASEC_ORDER) {
          scores[k] = Math.round((scores[k] / 20) * 20);
        }
        const dom = profilDominant(scores);
        await db.utilisateur.update({
          where: { id: utilisateurId },
          data: {
            scoreRealiste: scores.R,
            scoreInvestigateur: scores.I,
            scoreArtistique: scores.A,
            scoreSocial: scores.S,
            scoreEntreprenant: scores.E,
            scoreConventionnel: scores.C,
            profilDominant: dom,
          },
        });
        scoresCalcules = { scores, dominant: dom };
        testState = null; // test fini
      }
    }
    // Mettre à jour testProgress pour le frontend
    if (testState) {
      testProgress = { current: testState.current, total: 30 };
    }
  }

  // Recharger l'utilisateur si les scores ont été calculés
  let utilisateurFinal = utilisateur;
  if (scoresCalcules) {
    utilisateurFinal = await db.utilisateur.findUnique({
      where: { id: utilisateurId },
      include: { filiereActuelle: true },
    }) ?? utilisateur;
  }

  // Build system prompt avec contexte de test mis à jour
  const testEnCoursPourPrompt = testState ? { current: testState.current, reponses: testState.reponses } : null;
  const systemPrompt = buildSystemPrompt({ utilisateur: utilisateurFinal, filieres, metiers, testEnCours: testEnCoursPourPrompt, scoresCalculesFlag: !!scoresCalcules });

  // Build messages array (system + history + current message)
  // Convert history to ChatMessage format
  const messages: Array<{ role: "assistant" | "user"; content: string }> = [
    { role: "assistant", content: systemPrompt },
  ];
  // Add up to 10 last messages from history for context
  const recentHistory = input.historique.slice(-10);
  for (const h of recentHistory) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: message });

  // Call LLM
  let rawResponse: string;
  try {
    const zai = await getZai();
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
      stream: false,
    });
    rawResponse = completion.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    console.error("[LLM] erreur:", e);
    throw new LlmServiceUnavailableError();
  }
  if (!rawResponse.trim()) {
    console.error("[LLM] réponse vide");
    throw new LlmServiceUnavailableError();
  }

  const parsed = parseLlmResponse(rawResponse);
  let profilMisAJour = false;
  // testProgress est déjà déclaré plus haut dans la logique de test backend
  const finalActions: LlmAction[] = [];
  let sourcesWeb: Array<{ titre: string; url: string; extrait: string }> | undefined;

  // Vérifier si le LLM demande une recherche web
  const webSearchAction = parsed.actions.find((a) => a.type === "web_search");
  if (webSearchAction) {
    const requete = (webSearchAction.donnees?.requete as string) || message;
    // Exécuter la recherche web
    const searchResults = await chercherWeb(requete, 4);
    if (searchResults.length > 0) {
      // Préparer le contexte de recherche pour le LLM
      const searchContext = searchResults
        .map((r, i) => `${i + 1}. ${r.name}\n   Source: ${r.host_name}\n   Extrait: ${r.snippet}\n   URL: ${r.url}`)
        .join("\n\n");

      // Relancer le LLM avec les résultats de recherche
      const followUpMessages: Array<{ role: "assistant" | "user"; content: string }> = [
        ...messages,
        { role: "assistant", content: rawResponse }, // La réponse initiale du LLM
        {
          role: "user",
          content: `Voici les résultats de la recherche web pour "${requete}" :\n\n${searchContext}\n\nUtilise ces résultats pour répondre à ma question initiale de manière précise et à jour. Cite les sources (nom du site) dans ta réponse. Réponds en JSON avec le même format qu'avant.`,
        },
      ];

      try {
        const zai2 = await getZai();
        const completion2 = await zai2.chat.completions.create({
          messages: followUpMessages,
          thinking: { type: "disabled" },
          stream: false,
        });
        const rawResponse2 = completion2.choices?.[0]?.message?.content ?? "";
        const parsed2 = parseLlmResponse(rawResponse2);
        // Remplacer la réponse par la réponse enrichie
        parsed.reponse = parsed2.reponse;
        parsed.actions = parsed2.actions.filter((a) => a.type !== "web_search");
        sourcesWeb = searchResults.map((r) => ({
          titre: r.name,
          url: r.url,
          extrait: r.snippet,
        }));
      } catch (e) {
        console.error("[LLM] follow-up erreur:", e);
      }
    }
  }

  // Process actions
  for (const action of parsed.actions) {
    switch (action.type) {
      case "profil_collecte": {
        // Le LLM peut renvoyer 2 formats :
        // 1. { champ: "niveauEtudes", valeur: "Terminale D" }
        // 2. { niveauEtudes: "Terminale D", localisation: "Abidjan", ambition: "5" } (plusieurs champs d'un coup)
        const donnees = action.donnees ?? {};
        const champsCollectes: Array<{ champ: string; valeur: string }> = [];

        if (donnees.champ && donnees.valeur) {
          // Format 1 : un seul champ
          champsCollectes.push({ champ: donnees.champ as string, valeur: donnees.valeur as string });
        } else {
          // Format 2 : plusieurs champs directement dans donnees
          const champsPossibles = [
            "niveauEtudes", "localisation", "filiereSouhaitee", "filiereActuelle",
            "ambition", "rythme", "autonomie", "toleranceStress", "styleTravail",
          ];
          for (const c of champsPossibles) {
            if (donnees[c] !== undefined && donnees[c] !== null && donnees[c] !== "") {
              champsCollectes.push({ champ: c, valeur: String(donnees[c]) });
            }
          }
        }

        // Appliquer chaque champ collecté
        for (const { champ, valeur } of champsCollectes) {
          const ok = await applyProfilCollecte(utilisateurId, champ, valeur);
          if (ok) profilMisAJour = true;
        }
        finalActions.push(action);
        break;
      }
      case "test_riasec_question": {
        // Si le test n'est pas encore démarré, l'initialiser
        if (!testState && !testTermine) {
          testState = { current: 1, reponses: {}, demarre: true };
        }
        // La progression vient du backend (testState), pas du LLM
        if (testState) {
          testProgress = { current: testState.current, total: 30 };
        }
        finalActions.push(action);
        break;
      }
      case "test_riasec_termine": {
        finalActions.push(action);
        break;
      }
      case "synthese_en_cours": {
        finalActions.push(action);
        break;
      }
      case "recommandations_generees": {
        // Generate recommendations
        const updatedUser = await db.utilisateur.findUnique({ where: { id: utilisateurId } });
        if (updatedUser) {
          const profil = {
            R: updatedUser.scoreRealiste,
            I: updatedUser.scoreInvestigateur,
            A: updatedUser.scoreArtistique,
            S: updatedUser.scoreSocial,
            E: updatedUser.scoreEntreprenant,
            C: updatedUser.scoreConventionnel,
          };
          const profilComplet = Object.values(profil).some((v) => v > 0);
          if (profilComplet) {
            const allMetiers = await db.metier.findMany({ include: { filieres: { include: { filiere: true } } } });
            const allFilieres = await db.filiere.findMany();
            const recosMetiers = recommander(profil, allMetiers, { limite: 5 });
            const recosFilieres = recommander(profil, allFilieres, { limite: 4 });
            // Persist
            await db.recommandation.createMany({
              data: recosMetiers.map((r) => ({
                sessionId,
                metierId: r.cible.id,
                scoreCompatibilite: r.scoreCompatibilite,
                justification: r.justification,
              })),
            });
            const dom = profilDominant(profil);
            finalActions.push({
              type: "recommandations_generees",
              donnees: {
                recommandations: recosMetiers.map((r) => ({
                  metierId: r.cible.id,
                  nom: r.cible.nom,
                  score: r.scoreCompatibilite,
                  justification: r.justification,
                  secteur: r.cible.secteurActivite,
                  salaire: r.cible.salaireMoyen,
                })),
                recommandationsFilieres: recosFilieres.map((r) => ({
                  filiereId: r.cible.id,
                  nom: r.cible.nom,
                  score: r.scoreCompatibilite,
                  justification: r.justification,
                  duree: r.cible.duree,
                  etablissements: r.cible.etablissementsDisponibles
                    ? r.cible.etablissementsDisponibles.split("|").map((s) => s.trim()).filter(Boolean)
                    : [],
                  debouches: r.cible.debouchesText,
                  description: r.cible.description,
                  conditionsAcces: r.cible.conditionsAcces,
                  avantagesFinanciers: r.cible.avantagesFinanciers ? r.cible.avantagesFinanciers.split("|").filter(Boolean) : [],
                  inconvenientsFinanciers: r.cible.inconvenientsFinanciers ? r.cible.inconvenientsFinanciers.split("|").filter(Boolean) : [],
                  avantagesMentaux: r.cible.avantagesMentaux ? r.cible.avantagesMentaux.split("|").filter(Boolean) : [],
                  inconvenientsMentaux: r.cible.inconvenientsMentaux ? r.cible.inconvenientsMentaux.split("|").filter(Boolean) : [],
                  avantagesPhysiques: r.cible.avantagesPhysiques ? r.cible.avantagesPhysiques.split("|").filter(Boolean) : [],
                  inconvenientsPhysiques: r.cible.inconvenientsPhysiques ? r.cible.inconvenientsPhysiques.split("|").filter(Boolean) : [],
                  conseils: r.cible.conseils ? r.cible.conseils.split("|").filter(Boolean) : [],
                })),
                dominant: dom,
                dominantLabel: RIASEC_DIMENSIONS[dom].label,
              },
            });
          }
        }
        break;
      }
      case "afficher_filiere": {
        const nom = action.donnees?.nom as string;
        if (nom) {
          const f = await db.filiere.findFirst({ where: { nom: { equals: nom } } });
          if (f) {
            const updatedUser2 = await db.utilisateur.findUnique({ where: { id: utilisateurId } });
            if (updatedUser2) {
              const profil = {
                R: updatedUser2.scoreRealiste, I: updatedUser2.scoreInvestigateur, A: updatedUser2.scoreArtistique,
                S: updatedUser2.scoreSocial, E: updatedUser2.scoreEntreprenant, C: updatedUser2.scoreConventionnel,
              };
              const profilComplet = Object.values(profil).some((v) => v > 0);
              const score = profilComplet ? similariteRapide(profil, f) : undefined;
              finalActions.push({
                type: "afficher_filiere",
                donnees: {
                  filiere: {
                    nom: f.nom,
                    description: f.description,
                    duree: f.duree,
                    conditionsAcces: f.conditionsAcces,
                    etablissements: f.etablissementsDisponibles ? f.etablissementsDisponibles.split("|").map((s) => s.trim()).filter(Boolean) : [],
                    debouches: f.debouchesText,
                    avantagesFinanciers: f.avantagesFinanciers ? f.avantagesFinanciers.split("|").filter(Boolean) : [],
                    inconvenientsFinanciers: f.inconvenientsFinanciers ? f.inconvenientsFinanciers.split("|").filter(Boolean) : [],
                    avantagesMentaux: f.avantagesMentaux ? f.avantagesMentaux.split("|").filter(Boolean) : [],
                    inconvenientsMentaux: f.inconvenientsMentaux ? f.inconvenientsMentaux.split("|").filter(Boolean) : [],
                    avantagesPhysiques: f.avantagesPhysiques ? f.avantagesPhysiques.split("|").filter(Boolean) : [],
                    inconvenientsPhysiques: f.inconvenientsPhysiques ? f.inconvenientsPhysiques.split("|").filter(Boolean) : [],
                    conseils: f.conseils ? f.conseils.split("|").filter(Boolean) : [],
                    score,
                  },
                },
              });
            }
          }
        }
        break;
      }
      default:
        finalActions.push(action);
    }
  }

  // If no actions, add a default "information" action
  if (finalActions.length === 0) {
    finalActions.push({ type: "information" });
  }

  // Si le test vient de se terminer, ajouter les actions test_riasec_termine + synthese_en_cours
  if (scoresCalcules) {
    finalActions.push({ type: "test_riasec_termine", donnees: {} });
    finalActions.push({ type: "synthese_en_cours", donnees: {} });
  }

  // Persist the interaction avec testState mis à jour
  const intention = await db.intention.findUnique({ where: { libelle: "information_generale" } });
  await db.interaction.create({
    data: {
      sessionId,
      intentionId: intention?.id,
      messageUtilisateur: message,
      reponseSysteme: parsed.reponse,
      metadata: JSON.stringify({
        source: "llm",
        actions: finalActions.map((a) => a.type),
        testProgress: testProgress,
        testState: testState, // stocke l'état du test pour la prochaine requête
        testTermine: testTermine || !!scoresCalcules,
      }),
    },
  });

  return {
    reponse: parsed.reponse,
    actions: finalActions,
    profilMisAJour,
    testProgress,
    sourcesWeb,
    scoresCalcules: scoresCalcules ? {
      scores: scoresCalcules.scores as unknown as Record<string, number>,
      dominant: scoresCalcules.dominant,
      dominantLabel: RIASEC_DIMENSIONS[scoresCalcules.dominant].label,
    } : undefined,
  };
}

// Helper: compute RIASEC scores from inline test answers collected by the LLM
export async function calculerScoresRiasecDepuisReponses(
  utilisateurId: string,
  reponses: Record<number, number>
): Promise<{ scores: Record<RiasecDimension, number>; dominant: RiasecDimension }> {
  const scores: Record<RiasecDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  for (const q of RIASEC_QUESTIONS) {
    const val = reponses[q.ordre];
    if (typeof val === "number" && val >= 0 && val <= 4) {
      scores[q.dimension] += val;
    }
  }
  // Normalize to /20
  for (const k of RIASEC_ORDER) {
    scores[k] = Math.round((scores[k] / 20) * 20);
  }
  const dom = profilDominant(scores);
  await db.utilisateur.update({
    where: { id: utilisateurId },
    data: {
      scoreRealiste: scores.R,
      scoreInvestigateur: scores.I,
      scoreArtistique: scores.A,
      scoreSocial: scores.S,
      scoreEntreprenant: scores.E,
      scoreConventionnel: scores.C,
      profilDominant: dom,
    },
  });
  return { scores, dominant: dom };
}
