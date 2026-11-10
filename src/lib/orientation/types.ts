// Types partagés frontend <-> backend pour OriensCI
import type { RiasecDimension } from "@/lib/orientation/riasec-constants";

export interface Utilisateur {
  id: string;
  niveauEtudes: string | null;
  serieTerminale?: string | null;
  filiereActuelleId: string | null;
  filiereActuelle?: Filiere | null;
  filiereSouhaitee?: string | null;
  scoreRealiste: number;
  scoreInvestigateur: number;
  scoreArtistique: number;
  scoreSocial: number;
  scoreEntreprenant: number;
  scoreConventionnel: number;
  profilDominant: string | null;
  localisation: string | null;
  // Personnalité
  ambition?: number | null;
  rythme?: number | null;
  autonomie?: number | null;
  styleTravail?: string | null;
  toleranceStress?: number | null;
  dateCreation: string;
}

export interface Filiere {
  id: string;
  nom: string;
  description?: string | null;
  profilRealiste: number;
  profilInvestigateur: number;
  profilArtistique: number;
  profilSocial: number;
  profilEntreprenant: number;
  profilConventionnel: number;
  conditionsAcces?: string | null;
  etablissementsDisponibles?: string | null;
  etablissements?: string[];
  duree?: string | null;
  debouchesText?: string | null;
  domaines?: string | string[] | null;
  metiers?: Metier[];
  // Pros/cons détaillés
  avantagesFinanciers?: string[];
  inconvenientsFinanciers?: string[];
  avantagesMentaux?: string[];
  inconvenientsMentaux?: string[];
  avantagesPhysiques?: string[];
  inconvenientsPhysiques?: string[];
  conseils?: string[];
}

export interface Metier {
  id: string;
  nom: string;
  description?: string | null;
  profilRealiste: number;
  profilInvestigateur: number;
  profilArtistique: number;
  profilSocial: number;
  profilEntreprenant: number;
  profilConventionnel: number;
  secteurActivite?: string | null;
  descriptionDebouches?: string | null;
  salaireMoyen?: string | null;
  competencesCles?: string | null;
  competences?: string[];
  niveauMinimum?: string | null;
  filieres?: Filiere[];
}

export interface Session {
  id: string;
  utilisateurId: string;
  dateDebut: string;
  dateFin: string | null;
  statut: "active" | "terminee";
}

export type ActionType =
  | "texte"
  | "proposer_test"
  | "proposer_recommandations"
  | "proposer_recommandations_filieres"
  | "demarrer_profil"
  | "redirection_conseiller"
  | "afficher_profil"
  | "afficher_filiere"
  | "afficher_details_filiere"
  | "afficher_metier"
  | "afficher_liste_filieres"
  | "afficher_liste_metiers"
  | "afficher_historique"
  | "afficher_glossaire"
  | "suggestion"
  | "synthese_en_cours"
  | "test_riasec_termine";

export interface DialogueAction {
  type: ActionType;
  texte: string;
  donnees?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: string;
  intention?: string;
  confidence?: number;
  actions?: DialogueAction[];
  sourcesWeb?: Array<{ titre: string; url: string; extrait: string }>;
}

export interface RiasecRecoAffichage {
  metierId: string;
  nom: string;
  score: number;
  justification: string;
  secteur?: string | null;
  salaire?: string | null;
}

export interface FiliereRecoAffichage {
  filiereId: string;
  nom: string;
  score: number;
  justification: string;
  duree?: string | null;
  etablissements?: string[] | null;
  debouches?: string | null;
}

export interface ProfilRiasecVec {
  R: number; I: number; A: number; S: number; E: number; C: number;
}

export const DIM_LABEL: Record<RiasecDimension, string> = {
  R: "Réaliste",
  I: "Investigateur",
  A: "Artistique",
  S: "Social",
  E: "Entreprenant",
  C: "Conventionnel",
};

export const DIM_COLOR_VAR: Record<RiasecDimension, string> = {
  R: "var(--riasec-r)",
  I: "var(--riasec-i)",
  A: "var(--riasec-a)",
  S: "var(--riasec-s)",
  E: "var(--riasec-e)",
  C: "var(--riasec-c)",
};
