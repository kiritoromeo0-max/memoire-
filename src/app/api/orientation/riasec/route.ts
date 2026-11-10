// /api/orientation/riasec — test RIASEC
// GET : liste des questions (depuis la base)
// POST : soumet les réponses, calcule les 6 scores, met à jour l'utilisateur
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  RIASEC_QUESTIONS,
  RIASEC_DIMENSIONS,
  SCORE_FIELD_BY_DIM,
  type RiasecDimension,
} from "@/lib/orientation/riasec-constants";
import { profilDominant } from "@/lib/orientation/recommendation";
import { consumeRateLimit, rateLimitResponse, requireAuthenticatedUser, toPublicUser } from "@/lib/anonymous-auth";

export async function GET() {
  // La définition servie ici est statique; cette lecture ne modifie pas la base.
  return NextResponse.json({
    questions: RIASEC_QUESTIONS,
    dimensions: RIASEC_DIMENSIONS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { utilisateurId, reponses } = body as {
      utilisateurId: string;
      reponses: Record<string, number>; // questionId ou ordre -> valeur 0..4
    };
    const auth = await requireAuthenticatedUser(req, utilisateurId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const limit = await consumeRateLimit(`riasec:${auth.userId}`, 10, 60_000);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "Trop de tests RIASEC. Réessayez plus tard.");
    }

    if (
      !reponses || typeof reponses !== "object" || Array.isArray(reponses)
      || Object.keys(reponses).length > RIASEC_QUESTIONS.length
      || Object.values(reponses).some((value) => !Number.isInteger(value) || value < 0 || value > 4)
    ) {
      return NextResponse.json({ error: "utilisateurId et reponses requis" }, { status: 400 });
    }

    // Calcul des scores RIASEC : somme des réponses par dimension
    const scores: Record<RiasecDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    for (const q of RIASEC_QUESTIONS) {
      const key = String(q.ordre);
      const val = reponses[key];
      if (typeof val === "number" && val >= 0 && val <= 4) {
        scores[q.dimension] += val;
      }
    }
    // Normalisation sur 20 (chaque dimension a 5 questions × 4 = 20 max)
    for (const k of Object.keys(scores) as RiasecDimension[]) {
      scores[k] = Math.round((scores[k] / 20) * 20);
    }

    const dom = profilDominant(scores);
    const dataUpdate = {
      scoreRealiste: scores.R,
      scoreInvestigateur: scores.I,
      scoreArtistique: scores.A,
      scoreSocial: scores.S,
      scoreEntreprenant: scores.E,
      scoreConventionnel: scores.C,
      profilDominant: dom,
    };

    const utilisateur = await db.utilisateur.update({
      where: { id: auth.userId },
      data: dataUpdate,
      include: { filiereActuelle: true },
    });

    // Top 3 dimensions
    const top3 = (Object.keys(scores) as RiasecDimension[])
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, 3);

    return NextResponse.json({
      utilisateur: toPublicUser(utilisateur),
      scores,
      dominant: dom,
      dominantLabel: RIASEC_DIMENSIONS[dom].label,
      top3: top3.map((k) => ({ dim: k, label: RIASEC_DIMENSIONS[k].label, score: scores[k], description: RIASEC_DIMENSIONS[k].description })),
    });
  } catch (e) {
    console.error("[riasec POST]", e);
    return NextResponse.json({ error: "Erreur lors du calcul des scores" }, { status: 500 });
  }
}

// helper exporté pour le dialogue (non utilisé directement ici mais utile)
export const _scoreFieldByDim = SCORE_FIELD_BY_DIM;
