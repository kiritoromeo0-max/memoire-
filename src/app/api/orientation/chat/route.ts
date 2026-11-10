// /api/orientation/chat — point d'entrée principal du chatbot
// POST : { utilisateurId, sessionId, message } -> réponse du dialogue
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gererDialogue } from "@/lib/orientation/dialogue";
import { consumeRateLimit, rateLimitResponse, requireOwnedSession } from "@/lib/anonymous-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { utilisateurId, sessionId, message } = body as {
      utilisateurId: string;
      sessionId: string;
      message: string;
    };
    if (
      typeof utilisateurId !== "string" || utilisateurId.length > 100
      || typeof sessionId !== "string" || sessionId.length > 100
      || typeof message !== "string" || message.trim().length === 0 || message.length > 4_000
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
    const limit = await consumeRateLimit(`chat:${ownership.userId}`, 30, 60_000);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "Trop de messages. Réessayez plus tard.");
    }

    const output = await gererDialogue({ utilisateurId, sessionId, message });
    return NextResponse.json(output);
  } catch (e) {
    console.error("[chat POST]", e);
    return NextResponse.json({ error: "Erreur de traitement du message" }, { status: 500 });
  }
}
