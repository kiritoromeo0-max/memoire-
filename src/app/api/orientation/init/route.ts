// POST /api/orientation/init — Initialise un utilisateur + session (1er lancement)
// GET  /api/orientation/init?utilisateurId=... — Récupère l'état (utilisateur + session active)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createAnonymousCredential,
  consumeRateLimit,
  getClientAddress,
  requireAuthenticatedUser,
  rateLimitResponse,
  renewAnonymousCredential,
  setAnonymousCookie,
  toPublicUser,
} from "@/lib/anonymous-auth";

export async function POST(req: NextRequest) {
  try {
    const limit = await consumeRateLimit(`init:${getClientAddress(req)}`, 10, 60_000);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "Trop de créations. Réessayez plus tard.");
    }
    const body = await req.json().catch(() => ({}));
    if (
      (body.niveauEtudes != null && (typeof body.niveauEtudes !== "string" || body.niveauEtudes.length > 100))
      || (body.localisation != null && (typeof body.localisation !== "string" || body.localisation.length > 100))
    ) {
      return NextResponse.json({ error: "Profil invalide" }, { status: 400 });
    }
    const niveauEtudes = body?.niveauEtudes ?? null;
    const localisation = body?.localisation ?? null;
    const credential = createAnonymousCredential();

    const utilisateur = await db.utilisateur.create({
      data: {
        anonymousTokenHash: credential.tokenHash,
        anonymousTokenExpiresAt: credential.expiresAt,
        niveauEtudes: niveauEtudes ?? null,
        localisation: localisation ?? null,
      },
    });
    const session = await db.session.create({
      data: { utilisateurId: utilisateur.id, statut: "active" },
    });

    const response = NextResponse.json({ utilisateur: toPublicUser(utilisateur), session });
    setAnonymousCookie(response, credential.token, credential.expiresAt);
    return response;
  } catch (e) {
    console.error("[init] erreur", e);
    return NextResponse.json({ error: "Erreur d'initialisation" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const utilisateurId = searchParams.get("utilisateurId");

  const auth = await requireAuthenticatedUser(req, utilisateurId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const utilisateur = await db.utilisateur.findUnique({
    where: { id: auth.userId },
    include: { filiereActuelle: true },
  });
  if (!utilisateur) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }
  const sessionActive = await db.session.findFirst({
    where: { utilisateurId: auth.userId, statut: "active" },
    orderBy: { dateDebut: "desc" },
  });
  const response = NextResponse.json({ utilisateur: toPublicUser(utilisateur), session: sessionActive });
  const renewed = await renewAnonymousCredential(auth);
  if (renewed) setAnonymousCookie(response, renewed.token, renewed.expiresAt);
  return response;
}
