// /api/orientation/conseiller — redirection vers un conseiller humain
// POST : crée une demande de rappel
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeRateLimit, rateLimitResponse, requireAuthenticatedUser, requireOwnedSession } from "@/lib/anonymous-auth";
import { CONSEILLER_CONTACTS } from "@/lib/orientation/conseiller-contacts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, utilisateurId, nom, contact, motif, urgence } = body as {
      sessionId?: string;
      utilisateurId?: string;
      nom?: string;
      contact?: string;
      motif?: string;
      urgence?: string;
    };
    if (
      typeof contact !== "string" || contact.trim().length === 0 || contact.length > 200
      || typeof motif !== "string" || motif.trim().length === 0 || motif.length > 2_000
      || (nom != null && (typeof nom !== "string" || nom.length > 120))
      || (urgence != null && !["normale", "elevee"].includes(urgence))
      || (utilisateurId != null && (typeof utilisateurId !== "string" || utilisateurId.length > 100))
      || (sessionId != null && (typeof sessionId !== "string" || sessionId.length > 100))
    ) {
      return NextResponse.json({ error: "contact et motif requis" }, { status: 400 });
    }

    const auth = await requireAuthenticatedUser(req, utilisateurId ?? null);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const limit = await consumeRateLimit(`conseiller:${auth.userId}`, 3, 60 * 60_000);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "Trop de demandes. Réessayez plus tard.");
    }

    if (sessionId) {
      const sessionAuth = await requireOwnedSession(req, sessionId, utilisateurId ?? auth.userId);
      if (!sessionAuth.ok) {
        return NextResponse.json({ error: sessionAuth.error }, { status: sessionAuth.status });
      }
    }

    const demande = await db.demandeConseiller.create({
      data: {
        sessionId: sessionId ?? null,
        utilisateurId: auth.userId,
        nom: nom ?? null,
        contact,
        motif,
        urgence: urgence ?? "normale",
      },
    });
    return NextResponse.json({
      demande,
      message: `Votre demande a bien été enregistrée dans OriensCI. Aucun rappel automatique n'est déclenché. Pour joindre directement un service, appelez la DOB au ${CONSEILLER_CONTACTS.dob.telephones.join(" ou ")} ou le CIO Abidjan 2 au ${CONSEILLER_CONTACTS.cio.telephones[0]}.`,
    }, { status: 201 });
  } catch (e) {
    console.error("[conseiller POST]", e);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
