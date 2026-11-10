// /api/orientation/chat-llm — endpoint de chat utilisant le LLM
// POST : { utilisateurId, sessionId, message, historique } -> réponse LLM
import { NextRequest, NextResponse } from "next/server";
import { gererChatLlm, LlmServiceUnavailableError } from "@/lib/orientation/llm-service";
import { consumeRateLimit, rateLimitResponse, requireOwnedSession } from "@/lib/anonymous-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { utilisateurId, sessionId, message, historique } = body as {
      utilisateurId: string;
      sessionId: string;
      message: string;
      historique?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (
      typeof utilisateurId !== "string" || utilisateurId.length > 100
      || typeof sessionId !== "string" || sessionId.length > 100
      || typeof message !== "string" || message.trim().length === 0 || message.length > 4_000
      || (historique !== undefined && (!Array.isArray(historique) || historique.length > 40
        || historique.some((entry) => !entry || !["user", "assistant"].includes(entry.role)
          || typeof entry.content !== "string" || entry.content.length > 4_000)))
    ) {
      return NextResponse.json(
        { error: "utilisateurId, sessionId et message requis" },
        { status: 400 }
      );
    }

    const ownership = await requireOwnedSession(req, sessionId, utilisateurId);
    if (!ownership.ok) {
      return NextResponse.json(
        { error: ownership.error, code: ownership.code },
        { status: ownership.status },
      );
    }
    const limit = await consumeRateLimit(`chat-llm:${ownership.userId}`, 10, 60_000);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "Trop de messages IA. Réessayez plus tard.");
    }

    const result = await gererChatLlm({
      utilisateurId,
      sessionId,
      message,
      historique: historique ?? [],
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof LlmServiceUnavailableError) {
      return NextResponse.json(
        { error: "Le service IA est temporairement indisponible.", code: "AI_UNAVAILABLE" },
        { status: 503 },
      );
    }
    console.error("[chat-llm POST]", e);
    return NextResponse.json({ error: "Erreur de traitement LLM" }, { status: 500 });
  }
}
