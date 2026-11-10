export const SERIES_TERMINALE = [
  "Terminale A1",
  "Terminale A2",
  "Terminale C",
  "Terminale D",
  "Terminale E – Mathématiques et techniques",
  "Terminale F1 – Construction mécanique",
  "Terminale F2 – Électronique",
  "Terminale F3 – Électrotechnique",
  "Terminale F4 – Génie civil",
  "Terminale F7 – Biochimie",
  "Terminale G1 – Techniques administratives",
  "Terminale G2 – Techniques quantitatives de gestion",
  "Terminale G3 – Techniques commerciales",
  "Terminale H – Techniques informatiques",
] as const;

export type SerieTerminale = (typeof SERIES_TERMINALE)[number];

export const SERIES_TERMINALE_GENERALES: readonly SerieTerminale[] =
  SERIES_TERMINALE.slice(0, 4);

export const SERIES_TERMINALE_TECHNOLOGIQUES: readonly SerieTerminale[] =
  SERIES_TERMINALE.slice(4);

export function isSerieTerminale(value: unknown): value is SerieTerminale {
  return typeof value === "string" && SERIES_TERMINALE.includes(value as SerieTerminale);
}
