// Gestionnaire de dialogue — coordonne les échanges, relance si infos manquantes.
// Dépend de la couche données (Prisma) et des modules NLU + recommandation.
import { db } from "../db";
import { analyserMessage, type NluResult, type NluContext } from "./nlu";
import {
  recommander,
  profilDominant,
  genererJustification,
  similariteRapide,
  type ProfilRiasec,
} from "./recommendation";
import {
  RIASEC_DIMENSIONS,
  RIASEC_KEYS,
  type RiasecDimension,
} from "./riasec-constants";
import { CONSEILLER_CONTACTS } from "./conseiller-contacts";
import { chargerObjectifsRetenus, extraireDeclarationObjectif } from "./objectifs";

export interface DialogueInput {
  utilisateurId: string;
  sessionId: string;
  message: string;
}

export interface DialogueAction {
  type:
    | "texte"
    | "proposer_test"
    | "proposer_recommandations"
    | "proposer_recommandations_filieres"
    | "demarrer_profil"
    | "redirection_conseiller"
    | "afficher_profil"
    | "afficher_filiere"
    | "afficher_details_filiere"
    | "afficher_metier"
    | "afficher_liste_filieres"
    | "afficher_liste_metiers"
    | "afficher_historique"
    | "afficher_glossaire"
    | "suggestion";
  texte: string;
  // données complémentaires sérialisables (renvoyées au client pour rendu enrichi)
  donnees?: Record<string, unknown>;
}

export interface DialogueOutput {
  reponseSysteme: string;
  intentionDetectee: string;
  confidence: number;
  actions: DialogueAction[];
  interactionId?: string;
}

async function construireContexteNLU(): Promise<NluContext> {
  const filieres = await db.filiere.findMany({
    select: { id: true, nom: true, domaines: true },
  });
  const metiers = await db.metier.findMany({
    select: { id: true, nom: true },
  });
  // Charger les mots-clés appris via feedback (apprentissage dynamique)
  const appris = await db.apprentissageNlu.findMany();
  const motsAppris: Record<string, string[]> = {};
  for (const a of appris) {
    if (!motsAppris[a.intention]) motsAppris[a.intention] = [];
    motsAppris[a.intention].push(a.motCle);
  }
  return {
    filieres: filieres.map((f) => ({
      id: f.id,
      nom: f.nom,
      domaines: f.domaines ? f.domaines.split("|").filter(Boolean) : [],
    })),
    metiers: metiers.map((m) => ({ id: m.id, nom: m.nom })),
    motsAppris,
  };
}

function profilUtilisateurVersProfilRiasec(u: {
  scoreRealiste: number;
  scoreInvestigateur: number;
  scoreArtistique: number;
  scoreSocial: number;
  scoreEntreprenant: number;
  scoreConventionnel: number;
}): ProfilRiasec {
  return {
    R: u.scoreRealiste,
    I: u.scoreInvestigateur,
    A: u.scoreArtistique,
    S: u.scoreSocial,
    E: u.scoreEntreprenant,
    C: u.scoreConventionnel,
  };
}

function profilEstRenseigne(profil: ProfilRiasec): boolean {
  return RIASEC_KEYS.some((k) => profil[k] > 0);
}

function extraireCorrectionProfil(
  message: string,
  utilisateur: {
    niveauEtudes: string | null;
    serieTerminale: string | null;
    filiereActuelle?: { nom: string } | null;
    filiereSouhaitee: string | null;
    localisation: string | null;
  },
): { champ: "niveauEtudes" | "localisation" | "filiereSouhaitee" | "filiereActuelle"; valeur: string } | null {
  const correctionMatch = message.match(
    /\b(?:remplace(?:r)?|change(?:r)?|modifie(?:r)?|corrige(?:r)?)\s+(?:(?:mon|ma|mes)\s+)?(.+?)\s+(?:par|en|pour)\s+(.+?)\s*[.!?]*$/i,
  );
  const correctionCourteMatch = message.match(
    /\b(?:change(?:r)?|modifie(?:r)?|corrige(?:r)?)\s+(?:(?:mon|ma|mes)\s+)?(?:niveau(?:\s+d['’]études)?|études|classe|ville|localisation|filière(?:\s+(?:actuelle|souhaitée))?)\s+(?:en|par|pour|à)\s+(.+?)\s*[.!?]*$/i,
  );
  const changementNiveauCourt = message.match(
    /\b(?:change(?:r)?|modifie(?:r)?|corrige(?:r)?)\s+(?:en|pour|à)\s+(terminale|bac(?:calauréat)?(?:\s+obtenu)?|licence(?:\s+[1-3])?|master(?:\s+[1-2])?|doctorat)\s*[.!?]*$/i,
  );
  if (!correctionMatch && !correctionCourteMatch && !changementNiveauCourt) return null;

  const description = correctionMatch?.[1].toLocaleLowerCase("fr") ?? message.toLocaleLowerCase("fr");
  const valeur = (correctionMatch?.[2] ?? correctionCourteMatch?.[1] ?? changementNiveauCourt?.[1] ?? "").trim();
  if (!valeur || valeur.length > 100) return null;

  const ancienneValeur = correctionMatch?.[1].trim().toLocaleLowerCase("fr");
  const ancienneValeurCorrespond = (valeurActuelle: string | null | undefined) =>
    Boolean(valeurActuelle && ancienneValeur?.includes(valeurActuelle.toLocaleLowerCase("fr")));

  if (
    /\bniveau\b|\bétudes\b|\bclasse\b|\bterminale\b|\blicence\b|\bmaster\b|\bbac\b|\bdoctorat\b/i.test(description)
    || ancienneValeurCorrespond(utilisateur.niveauEtudes)
    || ancienneValeurCorrespond(utilisateur.serieTerminale)
    || /^(?:terminale|bac(?:calauréat)?(?:\s+obtenu)?|licence(?:\s+[1-3])?|master(?:\s+[1-2])?|doctorat)$/i.test(valeur)
  ) {
    return { champ: "niveauEtudes", valeur };
  }
  if (
    /\bville\b|\blocalisation\b/i.test(description)
    || ancienneValeurCorrespond(utilisateur.localisation)
  ) {
    return { champ: "localisation", valeur };
  }
  if (
    /\bfilière\s+souhaitée\b/i.test(description)
    || ancienneValeurCorrespond(utilisateur.filiereSouhaitee)
  ) {
    return { champ: "filiereSouhaitee", valeur };
  }
  if (
    /\bfilière\s+actuelle\b/i.test(description)
    || ancienneValeurCorrespond(utilisateur.filiereActuelle?.nom)
  ) {
    return { champ: "filiereActuelle", valeur };
  }

  return null;
}

// Formatage d'une filière pour réponse
function formaterFiliere(f: {
  nom: string;
  description: string | null;
  conditionsAcces: string | null;
  etablissementsDisponibles: string | null;
  duree: string | null;
  debouchesText: string | null;
}): string {
  return [
    `📚 **${f.nom}**`,
    f.description ? `_${f.description}_` : "",
    "",
    `🔹 **Durée** : ${f.duree ?? "non précisée"}`,
    `🔹 **Conditions d'accès** : ${f.conditionsAcces ?? "non précisées"}`,
    `🔹 **Établissements** : ${f.etablissementsDisponibles?.replace(/\s*\|\s*/g, ", ") ?? "non précisés"}`,
    `🔹 **Débouchés** : ${f.debouchesText ?? "non précisés"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formaterMetier(m: {
  nom: string;
  description: string | null;
  secteurActivite: string | null;
  descriptionDebouches: string | null;
  salaireMoyen: string | null;
  competencesCles: string | null;
  niveauMinimum: string | null;
}): string {
  return [
    `💼 **${m.nom}**`,
    m.description ? `_${m.description}_` : "",
    "",
    `🔹 **Secteur** : ${m.secteurActivite ?? "non précisé"}`,
    `🔹 **Niveau minimum** : ${m.niveauMinimum ?? "non précisé"}`,
    `🔹 **Salaire moyen (CI)** : ${m.salaireMoyen ?? "non précisé"}`,
    `🔹 **Compétences clés** : ${m.competencesCles?.replace(/\s*\|\s*/g, ", ") ?? "non précisées"}`,
    `🔹 **Débouchés** : ${m.descriptionDebouches ?? "non précisés"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function gererDialogue(input: DialogueInput): Promise<DialogueOutput> {
  const { utilisateurId, sessionId, message } = input;

  const utilisateur = await db.utilisateur.findUnique({
    where: { id: utilisateurId },
    include: { filiereActuelle: true },
  });
  if (!utilisateur) {
    return {
      reponseSysteme:
        "Je ne trouve pas votre profil utilisateur. Veuillez créer votre profil pour commencer.",
      intentionDetectee: "information_generale",
      confidence: 0,
      actions: [{ type: "demarrer_profil", texte: "Créer mon profil" }],
    };
  }

  let objectifsRetenus = await chargerObjectifsRetenus(sessionId);
  const objectifExprime = extraireDeclarationObjectif(message);
  if (objectifExprime) {
    if (!objectifsRetenus.some(
      (objectif) => objectif.toLocaleLowerCase("fr") === objectifExprime.toLocaleLowerCase("fr"),
    )) {
      objectifsRetenus = [...objectifsRetenus, objectifExprime].slice(-8);
    }
    const reponseSysteme = `Merci de me le confier 😊 Si je comprends bien, vous souhaitez **${objectifExprime}**. Je le garde en tête pour la suite. Après votre test, je pourrai vous proposer des pistes en tenant compte de vos intérêts et de cet objectif, sans vous promettre qu'un métier ou une filière le garantit. Qu'est-ce qui compte le plus pour vous dans ce projet ?`;
    const interaction = await db.interaction.create({
      data: {
        sessionId,
        messageUtilisateur: message,
        reponseSysteme,
        metadata: JSON.stringify({ objectifsRetenus }),
      },
    });
    return {
      reponseSysteme,
      intentionDetectee: "information_generale",
      confidence: 1,
      actions: [{ type: "texte", texte: reponseSysteme }],
      interactionId: interaction.id,
    };
  }

  const correction = extraireCorrectionProfil(message, utilisateur);
  if (correction) {
    let updateData: {
      niveauEtudes?: string;
      serieTerminale?: string | null;
      filiereActuelleId?: string | null;
      filiereSouhaitee?: string;
      localisation?: string;
    };

    switch (correction.champ) {
      case "niveauEtudes":
        updateData = {
          niveauEtudes: correction.valeur,
          serieTerminale: null,
          ...(correction.valeur === "Terminale" ? { filiereActuelleId: null } : {}),
        };
        break;
      case "localisation":
        updateData = { localisation: correction.valeur };
        break;
      case "filiereSouhaitee":
        updateData = { filiereSouhaitee: correction.valeur };
        break;
      case "filiereActuelle": {
        const filiere = await db.filiere.findFirst({
          where: { nom: { equals: correction.valeur, mode: "insensitive" } },
          select: { id: true },
        });
        if (!filiere) {
          const reponseSysteme = `Je veux bien corriger votre filière 😊, mais je ne retrouve pas « ${correction.valeur} » dans la liste. Vous pouvez choisir la bonne filière avec le bouton ci-dessous.`;
          const interaction = await db.interaction.create({
            data: {
              sessionId,
              messageUtilisateur: message,
              reponseSysteme,
              metadata: JSON.stringify({ correctionProfil: "filiereActuelle", valeurIntrouvable: correction.valeur, objectifsRetenus }),
            },
          });
          return {
            reponseSysteme,
            intentionDetectee: "demarrage_profil",
            confidence: 1,
            actions: [{ type: "demarrer_profil", texte: "Modifier mon profil" }],
            interactionId: interaction.id,
          };
        }
        updateData = { filiereActuelleId: filiere.id };
        break;
      }
    }

    await db.utilisateur.update({ where: { id: utilisateurId }, data: updateData });
    const nomChamp = {
      niveauEtudes: "niveau d'études",
      localisation: "ville",
      filiereSouhaitee: "filière souhaitée",
      filiereActuelle: "filière actuelle",
    }[correction.champ];
    const reponseSysteme = `Bien sûr, merci de me l'avoir précisé 😊 J'ai corrigé votre **${nomChamp}** : **${correction.valeur}**. Vous pouvez faire ces changements directement ici, même sans activer le mode IA. On continue ensemble !`;
    const interaction = await db.interaction.create({
      data: {
        sessionId,
        messageUtilisateur: message,
        reponseSysteme,
        metadata: JSON.stringify({ correctionProfil: correction.champ, valeur: correction.valeur, objectifsRetenus }),
      },
    });
    return {
      reponseSysteme,
      intentionDetectee: "demarrage_profil",
      confidence: 1,
      actions: [{ type: "texte", texte: reponseSysteme }],
      interactionId: interaction.id,
    };
  }

  const ctx = await construireContexteNLU();
  const nlu: NluResult = analyserMessage(message, ctx);

  const profil = profilUtilisateurVersProfilRiasec(utilisateur);
  const profilComplet = profilEstRenseigne(profil);
  const profilDeBaseRenseigne = !!(utilisateur.niveauEtudes || utilisateur.localisation || utilisateur.filiereActuelleId);

  let actions: DialogueAction[] = [];
  let reponseSysteme = "";

  switch (nlu.intent) {
    case "salutation": {
      reponseSysteme = profilDeBaseRenseigne
        ? `Bonjour 👋 ! Je suis **OriensCI**, ravi de faire votre connaissance 😊 Je suis là pour vous accompagner dans votre orientation, sans pression. Qu'est-ce qui vous ferait plaisir de découvrir aujourd'hui ?`
        : `Bonjour 👋 et bienvenue ! Moi, c'est **OriensCI** 😊 Je suis là pour vous aider à trouver votre chemin, à votre rythme et sans jugement. On peut commencer par votre profil, puis faire le test RIASEC pour découvrir les pistes qui vous ressemblent. Vous pouvez aussi me parler librement de vos envies ou me poser vos questions.`;
      actions = [{ type: "texte", texte: reponseSysteme }];
      if (!profilDeBaseRenseigne) {
        actions.push({ type: "demarrer_profil", texte: "Créer mon profil" });
        actions.push({ type: "suggestion", texte: "Passer le test RIASEC", donnees: { message: "Je veux passer le test RIASEC" } });
      } else if (!profilComplet) {
        actions.push({ type: "proposer_test", texte: "Passer le test RIASEC" });
      } else {
        actions.push({ type: "suggestion", texte: "Voir mes recommandations", donnees: { message: "Donnez-moi des recommandations personnalisées" } });
        actions.push({ type: "suggestion", texte: "Voir mon profil", donnees: { message: "Montrez-moi mon profil" } });
      }
      actions.push({ type: "suggestion", texte: "Voir les filières", donnees: { message: "Quelles filières proposez-vous ?" } });
      break;
    }

    case "remerciement": {
      reponseSysteme = "Avec plaisir ! 🙌 N'hésitez pas si vous avez d'autres questions — sur une filière, un métier, les débouchés, ou pour relancer une recommandation.";
      actions = [
        { type: "texte", texte: reponseSysteme },
        { type: "suggestion", texte: "Mes recommandations", donnees: { message: "Donnez-moi des recommandations personnalisées" } },
        { type: "suggestion", texte: "Voir les métiers", donnees: { message: "Quels métiers proposez-vous ?" } },
      ];
      break;
    }

    case "information_generale": {
      // Différencier "vraie demande d'info générale" (mot-clés présents) vs "entrée inconnue" (confidence ≈ 0)
      const estDemandeDAide = nlu.confidence > 0.05
        || /\b(aide|help|comment|qui es|qu'est-ce|presentation|pr\u00e9sentation|fonctionne)\b/i.test(message);
      if (estDemandeDAide) {
        reponseSysteme = [
          "Je suis **OriensCI**, un chatbot d'aide à l'orientation académique et professionnelle adapté au contexte ivoirien.",
          "",
          "Voici ce que je peux faire pour vous :",
          "• 📋 Créer votre **profil** (niveau, filière, localisation)",
          "• 🧭 Vous faire passer le **test RIASEC** (modèle de Holland) pour identifier vos intérêts",
          "• 💬 Répondre à vos **questions** sur les filières, métiers et débouchés",
          "• 🎯 Générer des **recommandations personnalisées** (score de compatibilité + justification)",
          "• 👤 Vous **rediriger vers un conseiller humain** si besoin",
          "",
          "Comment souhaitez-vous commencer ?",
        ].join("\n");
        actions = [
          { type: "texte", texte: reponseSysteme },
          { type: "demarrer_profil", texte: "Créer mon profil" },
          { type: "proposer_test", texte: "Passer le test RIASEC" },
        ];
      } else {
        // Entrée non reconnue — message court + suggestions
        reponseSysteme = "Je n'ai pas bien compris votre demande 🤔. Pouvez-vous reformuler ? Voici quelques pistes :";
        actions = [
          { type: "texte", texte: reponseSysteme },
          { type: "suggestion", texte: "Voir les filières", donnees: { message: "Quelles filières proposez-vous ?" } },
          { type: "suggestion", texte: "Voir les métiers", donnees: { message: "Quels métiers proposez-vous ?" } },
          { type: "suggestion", texte: "Mes recommandations", donnees: { message: "Donnez-moi des recommandations personnalisées" } },
          { type: "suggestion", texte: "Parler à un conseiller", donnees: { message: "Je veux parler à un conseiller humain" } },
        ];
      }
      break;
    }

    case "demarrage_profil": {
      reponseSysteme = "Parfait ! Configurons votre profil ensemble. Cliquez sur le bouton ci-dessous pour ouvrir le formulaire de profil.";
      actions = [
        { type: "demarrer_profil", texte: "Ouvrir le formulaire de profil" },
      ];
      break;
    }

    case "demande_test_riasec": {
      reponseSysteme = profilComplet
        ? "Vous avez déjà passé le test RIASEC. Vous pouvez le repasser pour affiner vos résultats, ou consulter votre profil actuel."
        : "Excellent ! Le test RIASEC comporte 30 affirmations. Pour chacune, indiquez votre niveau d'accord. Cela nous permettra de calculer vos 6 scores (Réaliste, Investigateur, Artistique, Social, Entreprenant, Conventionnel) et de vous proposer des métiers compatibles.";
      actions = [
        { type: "texte", texte: reponseSysteme },
        { type: "proposer_test", texte: profilComplet ? "Repasser le test" : "Démarrer le test RIASEC" },
      ];
      break;
    }

    case "consultation_profil": {
      // Cas spécial : demande d'historique
      if (/\b(historique|sessions|pr\u00e9c\u00e9dente)\b/i.test(message)) {
        reponseSysteme = "📜 **Votre historique de sessions** est disponible dans la fenêtre dédiée. Cliquez ci-dessous pour ouvrir l'historique complet de vos conversations et recommandations passées.";
        actions = [
          { type: "texte", texte: reponseSysteme },
          { type: "afficher_historique", texte: "Ouvrir l'historique" },
        ];
        break;
      }
      // Cas spécial : demande de glossaire RIASEC
      if (/\b(glossaire|holland|explique|expliquez|comprendre|qu'est-ce|qu'est ce)\b/i.test(message)) {
        reponseSysteme = "📚 Le **modèle RIASEC** (de John Holland) classe les intérêts professionnels en 6 dimensions. Cliquez ci-dessous pour ouvrir le glossaire complet avec exemples de métiers et matières fortes pour chaque dimension.";
        actions = [
          { type: "texte", texte: reponseSysteme },
          { type: "afficher_glossaire", texte: "Ouvrir le glossaire RIASEC" },
        ];
        break;
      }
      if (!profilComplet && !profilDeBaseRenseigne) {
        reponseSysteme = "Vous n'avez pas encore de profil enregistré. Commencez par renseigner votre profil de base, puis passez le test RIASEC.";
        actions = [
          { type: "texte", texte: reponseSysteme },
          { type: "demarrer_profil", texte: "Créer mon profil" },
          { type: "proposer_test", texte: "Passer le test RIASEC" },
        ];
        break;
      }
      const dom = profilComplet ? profilDominant(profil) : null;
      const lignes: string[] = ["📊 **Votre profil OriensCI**", ""];
      lignes.push(`🔹 **Niveau d'études** : ${utilisateur.niveauEtudes ?? "non renseigné"}`);
      lignes.push(`🔹 **Filière actuelle** : ${utilisateur.serieTerminale ?? utilisateur.filiereActuelle?.nom ?? "non renseignée"}`);
      lignes.push(`🔹 **Localisation** : ${utilisateur.localisation ?? "non renseignée"}`);
      if (objectifsRetenus.length > 0) {
        lignes.push(`🔹 **Ce que vous m'avez confié** : ${objectifsRetenus.map((objectif) => `« ${objectif} »`).join(", ")}`);
      }
      if (profilComplet) {
        lignes.push("");
        lignes.push("🧭 **Vos scores RIASEC** :");
        for (const k of RIASEC_KEYS) {
          const dim = RIASEC_DIMENSIONS[k as RiasecDimension];
          lignes.push(`• ${dim.label} (${k}) : **${profil[k]}** / 20`);
        }
        lignes.push("");
        lignes.push(`🎯 **Profil dominant** : **${RIASEC_DIMENSIONS[dom as RiasecDimension].label}** — ${RIASEC_DIMENSIONS[dom as RiasecDimension].description}`);
      } else {
        lignes.push("");
        lignes.push("_Vous n'avez pas encore passé le test RIASEC. Passez-le pour obtenir vos scores._");
      }
      reponseSysteme = lignes.join("\n");
      actions = [
        { type: "afficher_profil", texte: reponseSysteme, donnees: { profil, profilComplet, dominant: dom } },
      ];
      if (!profilComplet) {
        actions.push({ type: "proposer_test", texte: "Passer le test RIASEC" });
      }
      actions.push({ type: "suggestion", texte: "Glossaire RIASEC", donnees: { message: "Expliquez-moi le modèle RIASEC" } });
      break;
    }

    case "demande_recommandation": {
      if (!profilComplet) {
        const objectifRappel = objectifsRetenus.length > 0
          ? ` J'ai bien noté votre objectif : ${objectifsRetenus.map((objectif) => `« ${objectif} »`).join(", ")}. Je le garderai en tête pour mettre les résultats du test en perspective.`
          : "";
        reponseSysteme = `Pour vous proposer des pistes adaptées, j'ai d'abord besoin de vos résultats RIASEC.${objectifRappel} Faisons le test ensemble, puis je vous expliquerai comment les pistes correspondent à votre profil et à votre projet.`;
        actions = [
          { type: "texte", texte: reponseSysteme },
          { type: "proposer_test", texte: "Passer le test RIASEC" },
        ];
        break;
      }
      const metiers = await db.metier.findMany({
        include: { filieres: { include: { filiere: true } } },
      });
      const filieresAll = await db.filiere.findMany({
        include: { metiers: { include: { metier: true } } },
      });
      const recos = recommander(profil, metiers, {
        limite: 5,
        filtreNiveau: (m) => {
          // RG : on filtre selon le niveau d'études minimum déclaré
          if (!utilisateur.niveauEtudes || !m.niveauMinimum) return true;
          // logique souple : si l'utilisateur est en Terminale, on garde tout
          return true;
        },
      });
      const recosFilieres = recommander(profil, filieresAll, { limite: 4 });
      // Persistance des recommandations (RG6)
      await db.recommandation.createMany({
        data: recos.map((r) => ({
          sessionId,
          metierId: r.cible.id,
          scoreCompatibilite: r.scoreCompatibilite,
          justification: r.justification,
        })),
      });
      const dom = profilDominant(profil);
      const lignes: string[] = [
        `🎯 Voici vos **${recos.length} métiers recommandés** + **${recosFilieres.length} filières compatibles** (profil dominant : **${RIASEC_DIMENSIONS[dom].label}**) :`,
        "",
      ];
      if (objectifsRetenus.length > 0) {
        lignes.unshift(
          `Je me souviens de votre objectif : ${objectifsRetenus.map((objectif) => `« ${objectif} »`).join(", ")}. Ces pistes reflètent d'abord vos intérêts RIASEC; elles ne garantissent pas à elles seules cet objectif. On peut regarder ensemble comment les rapprocher de votre projet.`,
          "",
        );
      }
      recos.forEach((r, i) => {
        lignes.push(`**${i + 1}. ${r.cible.nom}** — compatibilité **${Math.round(r.scoreCompatibilite * 100)}%**`);
        lignes.push(`   _${r.justification}_`);
        if (r.cible.secteurActivite) lignes.push(`   🔹 Secteur : ${r.cible.secteurActivite}`);
        lignes.push("");
      });
      lignes.push("🎓 **Filières compatibles** :");
      recosFilieres.forEach((r, i) => {
        lignes.push(`   ${i + 1}. **${r.cible.nom}** — ${Math.round(r.scoreCompatibilite * 100)}%`);
      });
      reponseSysteme = lignes.join("\n");
      actions = [
        {
          type: "proposer_recommandations",
          texte: reponseSysteme,
          donnees: {
            recommandations: recos.map((r) => ({
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
          },
        },
        { type: "suggestion", texte: "Voir mon profil", donnees: { message: "Montrez-moi mon profil" } },
        { type: "suggestion", texte: "Parler à un conseiller", donnees: { message: "Je veux parler à un conseiller humain" } },
      ];
      break;
    }

    case "recherche_filiere": {
      const filiereNom = nlu.entities.filiereNom;
      // Détecter si l'utilisateur demande une orientation ("quelle filière faire", "je veux faire X")
      const demandeOrientation = /\b(quelle|quel|je veux|je voudrais|je souhaite|je veux faire|j'aimerais faire|orientation)\b/i.test(message);

      if (filiereNom) {
        const f = await db.filiere.findFirst({
          where: { nom: { equals: filiereNom } },
        });
        if (f) {
          // Enregistrer la filière souhaitée
          await db.utilisateur.update({
            where: { id: utilisateurId },
            data: { filiereSouhaitee: f.nom },
          });

          // Si l'utilisateur demande une orientation et n'a pas passé le test, proposer le test
          if (demandeOrientation && !profilComplet) {
            reponseSysteme = `C'est noté ! Vous êtes intéressé(e) par **${f.nom}** 📝\n\nPour vous donner une recommandation complète avec les avantages et inconvénients (financier, mental, physique) et vérifier que cette filière correspond vraiment à votre profil, je vous invite à passer le **test RIASEC** (≈ 3 min).\n\nAprès le test, je vous montrerai cette filière en détail + d'autres filières compatibles avec votre profil.`;
            actions = [
              { type: "texte", texte: reponseSysteme },
              { type: "proposer_test", texte: "Passer le test RIASEC" },
              { type: "suggestion", texte: `Voir ${f.nom} sans le test`, donnees: { message: `Donne-moi les détails de la filière ${f.nom}` } },
            ];
            break;
          }

          // Si le test est passé, afficher les détails complets avec pros/cons
          if (profilComplet) {
            const dom = profilDominant(profil);
            const score = similariteRapide(profil, f);
            reponseSysteme = `Voici les **détails complets** de **${f.nom}** (compatibilité avec votre profil : **${Math.round(score * 100)}%**, profil dominant **${RIASEC_DIMENSIONS[dom].label}**) :`;
            actions = [
              { type: "afficher_details_filiere", texte: reponseSysteme, donnees: {
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
              } },
              { type: "suggestion", texte: "Mes recommandations complètes", donnees: { message: "Donnez-moi des recommandations personnalisées" } },
            ];
          } else {
            // Pas de test : afficher la fiche simple
            reponseSysteme = formaterFiliere(f);
            const metiersLies = await db.filiereMetier.findMany({
              where: { filiereId: f.id },
              include: { metier: true },
            });
            if (metiersLies.length > 0) {
              reponseSysteme += `\n\n🔹 **Métiers accessibles** : ${metiersLies.map((m) => m.metier.nom).join(", ")}`;
            }
            reponseSysteme += `\n\n💡 _Passez le test RIASEC pour voir les avantages/inconvénients détaillés (financier, mental, physique) et vérifier la compatibilité avec votre profil._`;
            actions = [
              { type: "afficher_filiere", texte: reponseSysteme, donnees: { filiereId: f.id, nom: f.nom } },
              { type: "proposer_test", texte: "Passer le test RIASEC" },
            ];
          }
        } else {
          reponseSysteme = `Je n'ai pas trouvé de filière correspondant à "${filiereNom}". Voici la liste des filières disponibles :`;
          const filieres = await db.filiere.findMany();
          actions = [
            { type: "texte", texte: reponseSysteme },
            { type: "afficher_liste_filieres", texte: reponseSysteme, donnees: { filieres: filieres.map((x) => ({ id: x.id, nom: x.nom })) } },
          ];
        }
      } else {
        const filieres = await db.filiere.findMany({ orderBy: { nom: "asc" } });
        reponseSysteme = `Voici les **${filieres.length} filières** de notre base (contexte ivoirien) :\n\n${filieres.map((f, i) => `${i + 1}. ${f.nom}`).join("\n")}\n\nCliquez sur une filière pour en savoir plus.`;
        actions = [
          { type: "afficher_liste_filieres", texte: reponseSysteme, donnees: { filieres: filieres.map((f) => ({ id: f.id, nom: f.nom })) } },
        ];
      }
      break;
    }

    case "recherche_metier": {
      const metierNom = nlu.entities.metierNom;
      if (metierNom) {
        const m = await db.metier.findFirst({
          where: { nom: { equals: metierNom } },
        });
        if (m) {
          reponseSysteme = formaterMetier(m);
          const filieres = await db.filiereMetier.findMany({
            where: { metierId: m.id },
            include: { filiere: true },
          });
          if (filieres.length > 0) {
            reponseSysteme += `\n\n🔹 **Filières pour y accéder** : ${filieres.map((f) => f.filiere.nom).join(", ")}`;
          }
          actions = [
            { type: "afficher_metier", texte: reponseSysteme, donnees: { metierId: m.id, nom: m.nom } },
          ];
        } else {
          reponseSysteme = `Je n'ai pas trouvé le métier "${metierNom}". Voici la liste des métiers disponibles :`;
          const metiers = await db.metier.findMany();
          actions = [
            { type: "texte", texte: reponseSysteme },
            { type: "afficher_liste_metiers", texte: reponseSysteme, donnees: { metiers: metiers.map((x) => ({ id: x.id, nom: x.nom })) } },
          ];
        }
      } else {
        const metiers = await db.metier.findMany({ orderBy: { nom: "asc" } });
        reponseSysteme = `Voici les **${metiers.length} métiers** de notre base :\n\n${metiers.map((m, i) => `${i + 1}. ${m.nom}`).join("\n")}\n\nCliquez sur un métier pour en savoir plus.`;
        actions = [
          { type: "afficher_liste_metiers", texte: reponseSysteme, donnees: { metiers: metiers.map((m) => ({ id: m.id, nom: m.nom })) } },
        ];
      }
      break;
    }

    case "demande_debouches": {
      // Si une filière ou un métier est mentionné, on affiche ses débouchés
      if (nlu.entities.metierNom) {
        const m = await db.metier.findFirst({
          where: { nom: { equals: nlu.entities.metierNom } },
        });
        if (m) {
          reponseSysteme = `💼 **Débouchés du métier ${m.nom}** :\n\n${m.descriptionDebouches ?? "Information non disponible."}\n\n🔹 Salaire moyen (CI) : ${m.salaireMoyen ?? "non précisé"}`;
          actions = [{ type: "afficher_metier", texte: reponseSysteme, donnees: { metierId: m.id, nom: m.nom } }];
          break;
        }
      }
      if (nlu.entities.filiereNom) {
        const f = await db.filiere.findFirst({
          where: { nom: { equals: nlu.entities.filiereNom } },
        });
        if (f) {
          const metiers = await db.filiereMetier.findMany({
            where: { filiereId: f.id },
            include: { metier: true },
          });
          reponseSysteme = `📚 **Débouchés de la filière ${f.nom}** :\n\n${f.debouchesText ?? "Information non disponible."}\n\n🔹 Métiers typiques : ${metiers.map((m) => m.metier.nom).join(", ")}`;
          actions = [{ type: "afficher_filiere", texte: reponseSysteme, donnees: { filiereId: f.id, nom: f.nom } }];
          break;
        }
      }
      reponseSysteme = "Pour quel métier ou filière souhaitez-vous connaître les débouchés ? Vous pouvez nommer une filière (ex. : Informatique, Médecine) ou un métier (ex. : avocat, développeur).";
      actions = [
        { type: "texte", texte: reponseSysteme },
        { type: "afficher_liste_filieres", texte: "Voir les filières", donnees: { filieres: (await db.filiere.findMany({ select: { id: true, nom: true } })) } },
      ];
      break;
    }

    case "aide_conseiller": {
      reponseSysteme = [
        "🧑‍💼 **Mise en relation avec un conseiller humain**",
        "",
        "Pour un accompagnement humain, vous pouvez contacter directement les services d'orientation suivants :",
        "",
        `• **${CONSEILLER_CONTACTS.dob.nom}** — ${CONSEILLER_CONTACTS.dob.adresse} — ${CONSEILLER_CONTACTS.dob.telephones.join(" / ")}`,
        `• **${CONSEILLER_CONTACTS.cio.nom}** — ${CONSEILLER_CONTACTS.cio.adresse} — ${CONSEILLER_CONTACTS.cio.telephones.join(" / ")}`,
        "",
        "Vous pouvez aussi laisser une demande via le formulaire. Elle sera enregistrée dans OriensCI, mais cette application ne déclenche pas de rappel automatique.",
      ].join("\n");
      actions = [
        { type: "redirection_conseiller", texte: reponseSysteme },
      ];
      break;
    }

    default: {
      reponseSysteme = "Je n'ai pas tout à fait compris votre demande. Pouvez-vous reformuler ? Vous pouvez me poser une question sur une filière, un métier, les débouchés, demander une recommandation, ou demander à parler à un conseiller humain.";
      actions = [
        { type: "texte", texte: reponseSysteme },
        { type: "proposer_test", texte: "Passer le test RIASEC" },
        { type: "demarrer_profil", texte: "Créer mon profil" },
      ];
    }
  }

  // Persistance de l'interaction (RG4, RG5)
  const intention = await db.intention.findUnique({ where: { libelle: nlu.intent } });
  const interaction = await db.interaction.create({
    data: {
      sessionId,
      intentionId: intention?.id,
      messageUtilisateur: message,
      reponseSysteme,
      metadata: JSON.stringify({ entities: nlu.entities, confidence: nlu.confidence, objectifsRetenus }),
    },
  });

  return {
    reponseSysteme,
    intentionDetectee: nlu.intent,
    confidence: nlu.confidence,
    actions,
    interactionId: interaction.id,
  };
}

// Justification autonome (réutilisable côté API recommandations)
export { genererJustification };
