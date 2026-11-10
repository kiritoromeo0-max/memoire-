// /api/orientation/sessions — gestion des sessions
// POST : crée une session pour un utilisateur
// GET : liste les sessions d'un utilisateur (avec interactions)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthenticatedUser, requireOwnedSession } from "@/lib/anonymous-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { utilisateurId } = body;
    if (typeof utilisateurId !== "string" || utilisateurId.length > 100) {
      return NextResponse.json({ error: "utilisateurId invalide" }, { status: 400 });
    }
    const auth = await requireAuthenticatedUser(req, utilisateurId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const userId = auth.userId;
    // Clôturer les sessions actives précédentes
    await db.session.updateMany({
      where: { utilisateurId: userId, statut: "active" },
      data: { statut: "terminee", dateFin: new Date() },
    });
    const session = await db.session.create({
      data: { utilisateurId: userId, statut: "active" },
    });
    return NextResponse.json(session, { status: 201 });
  } catch (e) {
    console.error("[sessions POST]", e);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const utilisateurId = searchParams.get("utilisateurId");
  const sessionId = searchParams.get("sessionId");

  const auth = await requireAuthenticatedUser(req, utilisateurId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (sessionId) {
    const ownership = await requireOwnedSession(req, sessionId, utilisateurId ?? auth.userId);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status });
    }
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        interactions: { orderBy: { dateHeure: "asc" }, include: { intention: true } },
        recommandations: { include: { metier: true }, orderBy: { dateGeneration: "desc" } },
      },
    });
    if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    return NextResponse.json(session);
  }

  const sessions = await db.session.findMany({
    where: { utilisateurId: auth.userId },
    orderBy: { dateDebut: "desc" },
    include: { _count: { select: { interactions: true, recommandations: true } } },
  });
  return NextResponse.json(sessions);
}
