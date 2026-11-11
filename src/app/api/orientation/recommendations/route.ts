// /api/orientation/recommendations — recommandations personnalisées
// POST { utilisateurId, sessionId? } : génère (ou régénère) des recommandations
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recommander, profilDominant } from "@/lib/orientation/recommendation";
import { RIASEC_DIMENSIONS, type RiasecDimension } from "@/lib/orientation/riasec-constants";
import { chargerObjectifsRetenus } from "@/lib/orientation/objectifs";
import { consumeRateLimit, rateLimitResponse, requireAuthenticatedUser, requireOwnedSession } from "@/lib/anonymous-auth";

export async function POST(req: NextRequest) {
  let body: { utilisateurId?: unknown; sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const utilisateurId = typeof body.utilisateurId === "string" ? body.utilisateurId : null;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  if (!utilisateurId || utilisateurId.length > 100 || (body.sessionId != null && (!sessionId || sessionId.length > 100))) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 400 });
  }
  const auth = await requireAuthenticatedUser(req, utilisateurId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.userId;
  const limit = await consumeRateLimit(`recommendations:${userId}`, 10, 60_000);
  if (!limit.allowed) {
    return rateLimitResponse(limit, "Trop de demandes. Réessayez plus tard.");
  }
  if (sessionId) {
    const sessionOwnership = await requireOwnedSession(req, sessionId, utilisateurId ?? userId);
    if (!sessionOwnership.ok) {
      return NextResponse.json({ error: sessionOwnership.error }, { status: sessionOwnership.status });
    }
  }

  const utilisateur = await db.utilisateur.findUnique({
    where: { id: userId },
    include: { filiereActuelle: true },
  });
  if (!utilisateur) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const profilComplet = [
    utilisateur.scoreRealiste,
    utilisateur.scoreInvestigateur,
    utilisateur.scoreArtistique,
    utilisateur.scoreSocial,
    utilisateur.scoreEntreprenant,
    utilisateur.scoreConventionnel,
  ].some((score) => score > 0);
  if (!profilComplet) {
    return NextResponse.json({
      error: "Profil RIASEC incomplet",
      message: "Vous devez d'abord passer le test RIASEC pour obtenir des recommandations.",
      profilComplet: false,
    }, { status: 400 });
  }

  const profil = {
    R: utilisateur.scoreRealiste,
    I: utilisateur.scoreInvestigateur,
    A: utilisateur.scoreArtistique,
    S: utilisateur.scoreSocial,
    E: utilisateur.scoreEntreprenant,
    C: utilisateur.scoreConventionnel,
  };

  const metiers = await db.metier.findMany({
    include: { filieres: { include: { filiere: true } } },
  });

  const filieres = await db.filiere.findMany({
    include: { metiers: { include: { metier: true } } },
  });

  const recos = recommander(profil, metiers, { limite: 5 });
  // Recommandations de filières compatibles (même algo)
  const recosFilieres = recommander(profil, filieres, { limite: 4 });

  // Persister si une sessionId est fournie
  let sessionIdFinal = sessionId;
  if (!sessionIdFinal) {
    const session = await db.session.create({
      data: { utilisateurId: userId, statut: "active" },
    });
    sessionIdFinal = session.id;
  }
  await db.recommandation.createMany({
    data: recos.map((r) => ({
      sessionId: sessionIdFinal,
      metierId: r.cible.id,
      scoreCompatibilite: r.scoreCompatibilite,
      justification: r.justification,
    })),
  });

  const dom = profilDominant(profil);
  const objectifsRetenus = sessionId
    ? await chargerObjectifsRetenus(sessionId)
    : [];

  return NextResponse.json({
    profilComplet: true,
    dominant: dom,
    dominantLabel: RIASEC_DIMENSIONS[dom].label,
    recommandations: recos.map((r) => ({
      metier: {
        id: r.cible.id,
        nom: r.cible.nom,
        secteurActivite: r.cible.secteurActivite,
        salaireMoyen: r.cible.salaireMoyen,
        niveauMinimum: r.cible.niveauMinimum,
        description: r.cible.description,
      },
      scoreCompatibilite: r.scoreCompatibilite,
      justification: r.justification,
    })),
    recommandationsFilieres: recosFilieres.map((r) => ({
      filiere: {
        id: r.cible.id,
        nom: r.cible.nom,
        duree: r.cible.duree,
        conditionsAcces: r.cible.conditionsAcces,
        etablissementsDisponibles: r.cible.etablissementsDisponibles,
        debouchesText: r.cible.debouchesText,
        description: r.cible.description,
      },
      scoreCompatibilite: r.scoreCompatibilite,
      justification: r.justification,
    })),
    objectifsRetenus,
    sessionId: sessionIdFinal,
  });
}
