// /api/orientation/users — gestion du profil utilisateur
// POST : crée un utilisateur
// PATCH : met à jour le profil (niveau, filière, localisation)
// GET : récupère un utilisateur par id
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSerieTerminale } from "@/lib/orientation/education";
import {
  createAnonymousCredential,
  consumeRateLimit,
  getClientAddress,
  rateLimitResponse,
  requireAuthenticatedUser,
  setAnonymousCookie,
  toPublicUser,
} from "@/lib/anonymous-auth";

export async function POST(req: NextRequest) {
  try {
    const limit = await consumeRateLimit(`user-create:${getClientAddress(req)}`, 10, 60_000);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "Trop de créations. Réessayez plus tard.");
    }
    const body = await req.json();
    const { niveauEtudes, serieTerminale, filiereActuelleId, localisation } = body;
    if (
      (niveauEtudes != null && (typeof niveauEtudes !== "string" || niveauEtudes.length > 100))
      || (serieTerminale != null && !isSerieTerminale(serieTerminale))
      || (serieTerminale != null && niveauEtudes !== "Terminale")
      || (filiereActuelleId != null && (typeof filiereActuelleId !== "string" || filiereActuelleId.length > 100))
      || (localisation != null && (typeof localisation !== "string" || localisation.length > 100))
    ) {
      return NextResponse.json({ error: "Profil invalide" }, { status: 400 });
    }
    const credential = createAnonymousCredential();
    const utilisateur = await db.utilisateur.create({
      data: {
        anonymousTokenHash: credential.tokenHash,
        anonymousTokenExpiresAt: credential.expiresAt,
        niveauEtudes: niveauEtudes ?? null,
        serieTerminale: serieTerminale ?? null,
        filiereActuelleId: niveauEtudes === "Terminale" ? null : filiereActuelleId ?? null,
        localisation: localisation ?? null,
      },
      include: { filiereActuelle: true },
    });
    const response = NextResponse.json(toPublicUser(utilisateur), { status: 201 });
    setAnonymousCookie(response, credential.token, credential.expiresAt);
    return response;
  } catch (e) {
    console.error("[users POST]", e);
    return NextResponse.json({ error: "Erreur de création" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id, niveauEtudes, serieTerminale, filiereActuelleId, localisation,
      ambition, rythme, autonomie, styleTravail, toleranceStress, filiereSouhaitee,
    } = body;
    if (
      typeof id !== "string"
      || (niveauEtudes !== undefined && (typeof niveauEtudes !== "string" || niveauEtudes.length > 100))
      || (serieTerminale !== undefined && serieTerminale !== null && !isSerieTerminale(serieTerminale))
      || (serieTerminale != null && niveauEtudes !== "Terminale")
      || (serieTerminale != null && filiereActuelleId != null)
      || (filiereActuelleId !== undefined && filiereActuelleId !== null && (typeof filiereActuelleId !== "string" || filiereActuelleId.length > 100))
      || (localisation !== undefined && (typeof localisation !== "string" || localisation.length > 100))
      || (filiereSouhaitee !== undefined && (typeof filiereSouhaitee !== "string" || filiereSouhaitee.length > 200))
      || [ambition, rythme, autonomie, toleranceStress].some((value) => value != null && (!Number.isInteger(value) || value < 1 || value > 5))
      || (styleTravail != null && !["solo", "equipe", "mixte"].includes(styleTravail))
    ) return NextResponse.json({ error: "Profil invalide" }, { status: 400 });

    const auth = await requireAuthenticatedUser(req, id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const data: Record<string, unknown> = {};
    if (niveauEtudes !== undefined) data.niveauEtudes = niveauEtudes;
    if (niveauEtudes === "Terminale") {
      data.serieTerminale = serieTerminale ?? null;
      data.filiereActuelleId = null;
    } else {
      if (niveauEtudes !== undefined) data.serieTerminale = null;
      if (filiereActuelleId !== undefined) data.filiereActuelleId = filiereActuelleId || null;
    }
    if (localisation !== undefined) data.localisation = localisation;
    if (ambition !== undefined) data.ambition = ambition;
    if (rythme !== undefined) data.rythme = rythme;
    if (autonomie !== undefined) data.autonomie = autonomie;
    if (styleTravail !== undefined) data.styleTravail = styleTravail;
    if (toleranceStress !== undefined) data.toleranceStress = toleranceStress;
    if (filiereSouhaitee !== undefined) data.filiereSouhaitee = filiereSouhaitee;

    const utilisateur = await db.utilisateur.update({
      where: { id: auth.userId },
      data,
      include: { filiereActuelle: true },
    });
    return NextResponse.json(toPublicUser(utilisateur));
  } catch (e) {
    console.error("[users PATCH]", e);
    return NextResponse.json({ error: "Erreur de mise à jour" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const auth = await requireAuthenticatedUser(req, id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const utilisateur = await db.utilisateur.findUnique({
    where: { id: auth.userId },
    include: { filiereActuelle: true },
  });
  if (!utilisateur) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(toPublicUser(utilisateur));
}
