// /api/orientation/synthese — génère une synthèse TRÈS détaillée après le test RIASEC
// Prend en compte TOUT : profil, personnalité, filière souhaitée, scores RIASEC, recommandations
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import {
  RIASEC_DIMENSIONS,
  RIASEC_ORDER,
  type RiasecDimension,
} from "@/lib/orientation/riasec-constants";
import { recommander, profilDominant, similariteRapide } from "@/lib/orientation/recommendation";
import { consumeRateLimit, rateLimitResponse, requireAuthenticatedUser, requireOwnedSession } from "@/lib/anonymous-auth";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZai() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

export async function POST(req: NextRequest) {
  try {
    const { utilisateurId, sessionId } = await req.json();
    if (
      typeof utilisateurId !== "string" || utilisateurId.length > 100
      || (sessionId != null && (typeof sessionId !== "string" || sessionId.length > 100))
    ) {
      return NextResponse.json({ error: "utilisateurId requis" }, { status: 400 });
    }

    const auth = await requireAuthenticatedUser(req, utilisateurId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const limit = await consumeRateLimit(`synthese:${auth.userId}`, 3, 60_000);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "Trop de synthèses. Réessayez plus tard.");
    }

    if (sessionId) {
      const ownership = await requireOwnedSession(req, sessionId, utilisateurId);
      if (!ownership.ok) {
        return NextResponse.json({ error: ownership.error }, { status: ownership.status });
      }
    }

    // Charger TOUT le profil utilisateur
    const utilisateur = await db.utilisateur.findUnique({
      where: { id: auth.userId },
      include: { filiereActuelle: true },
    });
    if (!utilisateur) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const profilComplet =
      utilisateur.scoreRealiste + utilisateur.scoreInvestigateur + utilisateur.scoreArtistique +
      utilisateur.scoreSocial + utilisateur.scoreEntreprenant + utilisateur.scoreConventionnel > 0;

    if (!profilComplet) {
      return NextResponse.json({ error: "Test RIASEC non passé" }, { status: 400 });
    }

    // Charger la base de connaissances
    const metiers = await db.metier.findMany({ include: { filieres: { include: { filiere: true } } } });
    const filieres = await db.filiere.findMany();

    const profil = {
      R: utilisateur.scoreRealiste,
      I: utilisateur.scoreInvestigateur,
      A: utilisateur.scoreArtistique,
      S: utilisateur.scoreSocial,
      E: utilisateur.scoreEntreprenant,
      C: utilisateur.scoreConventionnel,
    };

    // Générer les recommandations
    const recosMetiers = recommander(profil, metiers, { limite: 5 });
    const recosFilieres = recommander(profil, filieres, { limite: 4 });
    const dom = profilDominant(profil);

    // Persister les recommandations
    if (sessionId) {
      await db.recommandation.createMany({
        data: recosMetiers.map((r) => ({
          sessionId,
          metierId: r.cible.id,
          scoreCompatibilite: r.scoreCompatibilite,
          justification: r.justification,
        })),
      });
    }

    // Construire le prompt de synthèse TRÈS détaillé
    const scoresText = RIASEC_ORDER.map((k) => {
      const dim = RIASEC_DIMENSIONS[k];
      return `• ${dim.label} (${k}) : ${profil[k]}/20 — ${dim.description}`;
    }).join("\n");

    const top3 = [...RIASEC_ORDER].sort((a, b) => profil[b] - profil[a]).slice(0, 3);
    const top3Text = top3.map((k, i) => `${i + 1}. ${RIASEC_DIMENSIONS[k].label} (${profil[k]}/20)`).join("\n");

    const recosMetiersText = recosMetiers.map((r, i) =>
      `${i + 1}. ${r.cible.nom} — ${Math.round(r.scoreCompatibilite * 100)}%\n   ${r.justification}\n   Secteur: ${r.cible.secteurActivite ?? "N/A"}\n   Salaire: ${r.cible.salaireMoyen ?? "N/A"}`
    ).join("\n\n");

    const recosFilieresText = recosFilieres.map((r, i) =>
      `${i + 1}. ${r.cible.nom} — ${Math.round(r.scoreCompatibilite * 100)}%\n   ${r.justification}\n   Durée: ${r.cible.duree ?? "N/A"}`
    ).join("\n\n");

    // Vérifier si la filière souhaitée est dans les recommandations
    const filiereSouhaitee = utilisateur.filiereSouhaitee;
    let analyseSouhait = "";
    if (filiereSouhaitee) {
      const f = filieres.find((fi) => fi.nom.toLowerCase().includes(filiereSouhaitee.toLowerCase()));
      if (f) {
        const score = similariteRapide(profil, f);
        const rank = recosFilieres.findIndex((r) => r.cible.id === f.id);
        analyseSouhait = `
FILIÈRE SOUHAITÉE PAR L'UTILISATEUR : "${filiereSouhaitee}"
- Score de compatibilité avec son profil RIASEC : ${Math.round(score * 100)}%
- ${rank >= 0 ? `Cette filière apparaît à la ${rank + 1}ère position de nos recommandations.` : "Cette filière n'apparaît pas dans le top 4 des recommandations."}
- ${score >= 0.7 ? "Excellente nouvelle : son profil correspond bien à cette filière !" : score >= 0.5 ? "Compatibilité moyenne : son profil correspond partiellement." : "Compatibilité faible : son profil ne correspond pas naturellement à cette filière. Explique pourquoi et propose des alternatives."}
`;
      } else {
        analyseSouhait = `\nFILIÈRE SOUHAITÉE : "${filiereSouhaitee}" (non trouvée dans la base — évoque-la et propose les plus proches)\n`;
      }
    }

    const synthesePrompt = `Tu es OriensCI, un conseiller d'orientation expert en Côte d'Ivoire. L'utilisateur vient de terminer son test RIASEC. Tu dois générer une SYNTHÈSE COMPLÈTE, DÉTAILLÉE ET PERSONNALISÉE qui prend en compte TOUT ce que tu sais sur lui.

# PROFIL COMPLET DE L'UTILISATEUR
- Niveau d'études : ${utilisateur.niveauEtudes ?? "non renseigné"}
- Filière actuelle : ${utilisateur.serieTerminale ?? utilisateur.filiereActuelle?.nom ?? "non renseignée"}
- Localisation : ${utilisateur.localisation ?? "non renseignée"}
${analyseSouhait}

# PERSONNALITÉ
- Ambition : ${utilisateur.ambition ?? "?"}/5
- Rythme de travail : ${utilisateur.rythme ?? "?"}/5
- Autonomie : ${utilisateur.autonomie ?? "?"}/5
- Style de travail : ${utilisateur.styleTravail ?? "?"}
- Tolérance au stress : ${utilisateur.toleranceStress ?? "?"}/5

# SCORES RIASEC
${scoresText}

Profil dominant : ${RIASEC_DIMENSIONS[dom].label}
Top 3 dimensions :
${top3Text}

# RECOMMANDATIONS DE MÉTIERS (top 5)
${recosMetiersText}

# RECOMMANDATIONS DE FILIÈRES (top 4)
${recosFilieresText}

# TA MISSION
Génère une synthèse TRÈS COMPLÈTE en français, structurée et engageante. L'utilisateur doit sentir que tu as TOUT pris en compte et que tu ne rien oublié sur lui.

Structure OBLIGATOIRE de ta réponse (utilise le markdown avec **gras** et listes) :

1. **🎉 Félicitations & Résumé** : Félicite pour le test, résume qui il est (niveau, ville, personnalité, souhait).

2. **🧭 Ton profil RIASEC** : Explique son profil dominant et ses 3 dimensions fortes. Dis ce que ça signifie concrètement pour lui.

3. **🎯 Ton objectif vs ton profil** : Analyse la compatibilité entre ce qu'il veut faire (${filiereSouhaitee ?? "non précisé"}) et son profil RIASEC. Sois honnête mais encourageant.

4. **💼 Tes métiers recommandés** : Présente les 3 meilleurs métiers avec score, justification, et débouchés en Côte d'Ivoire.

5. **🎓 Tes filières recommandées** : Présente les 2 meilleures filières avec durée, conditions d'accès, établissements.

6. **💡 Conseils personnalisés** : Donne 3-4 conseils concrets en lien avec SA personnalité (ambition, rythme, stress) et son objectif.

7. **🚀 Prochaines étapes** : Que faire maintenant ? (passer un concours, parler à un conseiller, etc.)

Sois chaleureux, précis, et utilise des emojis avec parcimonie. L'utilisateur doit se sentir UNIQUE et COMPRIS. Ne sois pas générique — référence-toi à ses infos spécifiques.`;

    // Appel LLM pour la synthèse
    const zai = await getZai();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: synthesePrompt },
        { role: "user", content: "Génère ma synthèse complète d'orientation maintenant." },
      ],
      thinking: { type: "disabled" },
      stream: false,
    });

    const synthese = completion.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({
      synthese,
      scores: profil,
      dominant: dom,
      dominantLabel: RIASEC_DIMENSIONS[dom].label,
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
        etablissements: r.cible.etablissementsDisponibles ? r.cible.etablissementsDisponibles.split("|").map((s) => s.trim()).filter(Boolean) : [],
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
      filiereSouhaitee: filiereSouhaitee,
    });
  } catch (e) {
    console.error("[synthese POST]", e);
    return NextResponse.json({ error: "Erreur lors de la synthèse" }, { status: 500 });
  }
}
