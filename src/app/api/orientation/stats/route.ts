// /api/orientation/stats — statistiques d'orientation pour un utilisateur
// GET ?utilisateurId=... : renvoie nb sessions, nb interactions, nb recommandations, profil dominant
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RIASEC_DIMENSIONS, type RiasecDimension } from "@/lib/orientation/riasec-constants";
import { requireAuthenticatedUser } from "@/lib/anonymous-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const utilisateurId = searchParams.get("utilisateurId");

  const auth = await requireAuthenticatedUser(req, utilisateurId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const utilisateur = await db.utilisateur.findUnique({
    where: { id: auth.userId },
    select: {
      profilDominant: true,
      scoreRealiste: true,
      scoreInvestigateur: true,
      scoreArtistique: true,
      scoreSocial: true,
      scoreEntreprenant: true,
      scoreConventionnel: true,
      dateCreation: true,
    },
  });
  if (!utilisateur) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const sessions = await db.session.findMany({
    where: { utilisateurId: auth.userId },
    select: {
      id: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
      _count: { select: { interactions: true, recommandations: true } },
    },
    orderBy: { dateDebut: "desc" },
  });

  const totalInteractions = sessions.reduce((sum, s) => sum + s._count.interactions, 0);
  const totalRecommandations = sessions.reduce((sum, s) => sum + s._count.recommandations, 0);
  const sessionsActives = sessions.filter((s) => s.statut === "active").length;

  // Score moyen (max des 6 dimensions)
  const scores = [
    utilisateur.scoreRealiste,
    utilisateur.scoreInvestigateur,
    utilisateur.scoreArtistique,
    utilisateur.scoreSocial,
    utilisateur.scoreEntreprenant,
    utilisateur.scoreConventionnel,
  ];
  const scoreMax = Math.max(...scores);
  const scoreMoyen = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const dominant = utilisateur.profilDominant as RiasecDimension | null;

  // Jours depuis inscription
  const joursInscription = Math.max(
    1,
    Math.floor((Date.now() - new Date(utilisateur.dateCreation).getTime()) / (1000 * 60 * 60 * 24))
  );

  return NextResponse.json({
    nbSessions: sessions.length,
    sessionsActives,
    totalInteractions,
    totalRecommandations,
    profilDominant: dominant,
    profilDominantLabel: dominant ? RIASEC_DIMENSIONS[dominant].label : null,
    profilDominantCouleur: dominant ? RIASEC_DIMENSIONS[dominant].couleur : null,
    scoreMax,
    scoreMoyen,
    joursInscription,
    sessions: sessions.map((s) => ({
      id: s.id,
      statut: s.statut,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      nbInteractions: s._count.interactions,
      nbRecommandations: s._count.recommandations,
    })),
  });
}
