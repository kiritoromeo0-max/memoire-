import { db } from "../db";

export async function chargerObjectifsRetenus(sessionId: string): Promise<string[]> {
  const interactions = await db.interaction.findMany({
    where: { sessionId },
    orderBy: { dateHeure: "desc" },
    take: 50,
    select: { metadata: true },
  });

  for (const interaction of interactions) {
    if (!interaction.metadata) continue;
    try {
      const metadata = JSON.parse(interaction.metadata);
      if (Array.isArray(metadata.objectifsRetenus)) {
        return metadata.objectifsRetenus
          .filter((objectif: unknown): objectif is string => typeof objectif === "string")
          .map((objectif: string) => objectif.trim().slice(0, 300))
          .filter(Boolean)
          .slice(-8);
      }
    } catch {
      console.error("[objectifs] métadonnées d'interaction invalides");
    }
  }

  return [];
}

export function extraireDeclarationObjectif(message: string): string | null {
  const declaration = message.match(
    /\b(?:je veux|je voudrais|je souhaite|j'aimerais|j'aimerai|je rêve de|mon rêve est|mon objectif est|mon objectif\s*:|je m'inquiète de|j'ai peur de|je crains de|ma préoccupation est)\s+(.+?)\s*[.!?]*$/i,
  );
  const objectif = declaration?.[1]?.trim();
  if (!objectif || objectif.length < 3 || objectif.length > 300) return null;

  if (/^(?:(?:des?|mes?)\s+)?(?:recommandations?|tests?|profil|filières?|métiers?)\b/i.test(objectif)
    || /^(?:passer|faire|commencer|voir|consulter|afficher|parler à|contacter)\b/i.test(objectif)) {
    return null;
  }

  return objectif.replace(/\bmlliardaire\b/gi, "milliardaire");
}
