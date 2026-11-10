// /api/orientation/riasec-inline — calcule les scores RIASEC depuis les réponses collectées inline par le LLM
// POST : { utilisateurId, reponses: Record<ordre, valeur 0..4> } -> scores calculés
import { NextRequest, NextResponse } from "next/server";
import { calculerScoresRiasecDepuisReponses } from "@/lib/orientation/llm-service";
import { RIASEC_DIMENSIONS } from "@/lib/orientation/riasec-constants";
import { consumeRateLimit, rateLimitResponse, requireAuthenticatedUser } from "@/lib/anonymous-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { utilisateurId, reponses } = body as {
      utilisateurId: string;
      reponses: Record<number, number>;
    };

    const auth = await requireAuthenticatedUser(req, utilisateurId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const limit = await consumeRateLimit(`riasec-inline:${auth.userId}`, 10, 60_000);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "Trop de tests RIASEC. Réessayez plus tard.");
    }

    if (
      !reponses || typeof reponses !== "object" || Array.isArray(reponses)
      || Object.keys(reponses).length > 30
      || Object.values(reponses).some((value) => !Number.isInteger(value) || value < 0 || value > 4)
    ) {
      return NextResponse.json(
        { error: "utilisateurId et reponses requis" },
        { status: 400 }
      );
    }

    const result = await calculerScoresRiasecDepuisReponses(auth.userId, reponses);

    return NextResponse.json({
      scores: result.scores,
      dominant: result.dominant,
      dominantLabel: RIASEC_DIMENSIONS[result.dominant].label,
      top3: (Object.keys(result.scores) as Array<keyof typeof result.scores>)
        .sort((a, b) => result.scores[b] - result.scores[a])
        .slice(0, 3)
        .map((k) => ({
          dim: k,
          label: RIASEC_DIMENSIONS[k].label,
          score: result.scores[k],
          description: RIASEC_DIMENSIONS[k].description,
        })),
    });
  } catch (e) {
    console.error("[riasec-inline POST]", e);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
