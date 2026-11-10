// Seed — OriensCI : filières & métiers ivoiriens, intentions, questions RIASEC
// Contexte : Côte d'Ivoire (Terminale → Licence)
import { db } from "../src/lib/db";
import { RIASEC_QUESTIONS } from "../src/lib/orientation/riasec-constants";

// Profils RIASEC cibles (échelle 0-10)
interface ProfilDef {
  R: number; I: number; A: number; S: number; E: number; C: number;
}

const FILIERES: Array<{
  nom: string;
  description: string;
  profil: ProfilDef;
  conditionsAcces: string;
  etablissements: string[];
  duree: string;
  debouches: string;
  domaines: string[];
}> = [
  {
    nom: "Informatique & Génie Logiciel",
    description:
      "Conception, développement et maintenance de logiciels, applications et systèmes informatiques.",
    profil: { R: 7, I: 9, A: 4, S: 2, E: 3, C: 7 },
    conditionsAcces: "Bac scientifique (C, D, E, F2) recommandé. Concours INPHB ou inscription Université.",
    etablissements: ["INP-HB (Yamoussoukro)", "Université Alassane Ouattara (Bouaké)", "Université Nangui Abrogoua (Abidjan)", "IUA"],
    duree: "3 à 5 ans",
    debouches: "Développeur, ingénieur logiciel, administrateur système, data analyst.",
    domaines: ["informatique", "programmation", "code", "logiciel", "numérique", "tech", "développement"],
  },
  {
    nom: "Génie Civil & BTP",
    description:
      "Conception et construction d'ouvrages : ponts, bâtiments, routes, infrastructures.",
    profil: { R: 9, I: 7, A: 2, S: 2, E: 4, C: 6 },
    conditionsAcces: "Bac scientifique (C, D, E). Concours INP-HB (École Polytechnique).",
    etablissements: ["INP-HB — ENSP (Yamoussoukro)", "Université Jean Lorougnon Guédé (Daloa)", "Institut National Polytechnique"],
    duree: "5 ans",
    debouches: "Ingénieur génie civil, conducteur de travaux, bureau d'études, BTP.",
    domaines: ["construction", "btp", "génie", "civil", "ouvrage", "pont", "route", "bâtiment"],
  },
  {
    nom: "Médecine & Sciences de la Santé",
    description:
      "Formation médicale : diagnostic, traitement et prévention des maladies.",
    profil: { R: 5, I: 9, A: 2, S: 8, E: 2, C: 4 },
    conditionsAcces: "Bac scientifique (C, D). Concours très sélectif Université Alassane Ouattara.",
    etablissements: ["Université Alassane Ouattara (Bouaké) — UFR SMA", "CHU de Bouaké", "CHU de Cocody"],
    duree: "7 à 9 ans",
    debouches: "Médecin généraliste, spécialiste, chirurgien, médecin de famille.",
    domaines: ["médecine", "santé", "soin", "hôpital", "maladie", "patient", "docteur", "médical"],
  },
  {
    nom: "Sciences Économiques & Gestion",
    description:
      "Analyse économique, gestion d'entreprise, finance, comptabilité et commerce.",
    profil: { R: 1, I: 7, A: 2, S: 3, E: 7, C: 6 },
    conditionsAcces: "Bac (toutes séries, surtout D, G). Inscription Université.",
    etablissements: ["Université Alassane Ouattara (Bouaké)", "Université Jean Lorougnon Guédé (Daloa)", "ESPAE — INP-HB"],
    duree: "3 à 5 ans",
    debouches: "Économiste, analyste financier, gestionnaire, contrôleur de gestion.",
    domaines: ["économie", "gestion", "finance", "entreprise", "comptabilité", "commerce", "argent"],
  },
  {
    nom: "Droit & Sciences Juridiques",
    description:
      "Étude du droit : civil, pénal, des affaires, public. Formation des juristes et avocats.",
    profil: { R: 1, I: 5, A: 3, S: 7, E: 6, C: 5 },
    conditionsAcces: "Bac (toutes séries). Inscription Université ou ENA pour le droit public.",
    etablissements: ["Université Alassane Ouattara (Bouaké) — UFR SJAP", "Université Jean Lorougnon Guédé", "ENA (Abidjan)"],
    duree: "3 à 7 ans",
    debouches: "Avocat, magistrat, juriste d'entreprise, notaire, conseiller juridique.",
    domaines: ["droit", "justice", "loi", "juridique", "avocat", "tribunal", "juriste"],
  },
  {
    nom: "Marketing & Commerce",
    description:
      "Stratégie commerciale, marketing digital, vente, gestion de la relation client.",
    profil: { R: 1, I: 3, A: 5, S: 6, E: 9, C: 4 },
    conditionsAcces: "Bac (toutes séries). BTS, DUT ou licence professionnelle.",
    etablissements: ["INP-HB — ESPAE", "IUA (Abidjan)", "Université Alassane Ouattara", "Groupe ISM"],
    duree: "2 à 5 ans",
    debouches: "Chargé de marketing, chef de produit, commercial, brand manager.",
    domaines: ["marketing", "commerce", "vente", "publicité", "produit", "client", "business"],
  },
  {
    nom: "Architecture & Beaux-Arts",
    description:
      "Conception d'espaces et bâtiments, design, arts plastiques et visuels.",
    profil: { R: 7, I: 6, A: 9, S: 2, E: 4, C: 3 },
    conditionsAcces: "Bac (toutes séries). Concours École des Beaux-Arts d'Abidjan.",
    etablissements: ["École des Beaux-Arts d'Abidjan (ENSA)", "INP-HB — ESTRAS"],
    duree: "5 ans",
    debouches: "Architecte, designer d'espace, urbaniste, artiste plasticien.",
    domaines: ["architecture", "design", "art", "beaux", "dessin", "créatif", "espace", "bâtir"],
  },
  {
    nom: "Communication & Journalisme",
    description:
      "Information, presse, audiovisuel, communication d'entreprise et relations publiques.",
    profil: { R: 1, I: 4, A: 7, S: 7, E: 6, C: 3 },
    conditionsAcces: "Bac (toutes séries). Concours CESTI ou ISMP.",
    etablissements: ["CESTI — Université Alassane Ouattara", "ISMP (Abidjan)", "Groupe ISM"],
    duree: "3 à 5 ans",
    debouches: "Journaliste, rédacteur, chargé de communication, animateur, attaché de presse.",
    domaines: ["communication", "journalisme", "presse", "média", "info", "écriture", "radio", "tv"],
  },
  {
    nom: "Agronomie & Sciences Agricoles",
    description:
      "Production végétale et animale, gestion durable des ressources, agro-industrie.",
    profil: { R: 8, I: 7, A: 2, S: 3, E: 3, C: 4 },
    conditionsAcces: "Bac scientifique (C, D). Concours ESA INP-HB.",
    etablissements: ["INP-HB — ESA (Yamoussoukro)", "Université Jean Lorougnon Guédé (Daloa)"],
    duree: "5 ans",
    debouches: "Ingénieur agronome, chef de projet agricole, agro-industrie, conseiller agricole.",
    domaines: ["agriculture", "agronomie", "agro", "terre", "culture", "élevage", "champ", "rural"],
  },
  {
    nom: "Électrotechnique & Électronique",
    description:
      "Production et distribution d'énergie, systèmes électroniques, automatismes industriels.",
    profil: { R: 9, I: 7, A: 2, S: 2, E: 3, C: 6 },
    conditionsAcces: "Bac scientifique (C, D, E, F2). Concours INP-HB.",
    etablissements: ["INP-HB — ENSP (Yamoussoukro)", "IUT (Abidjan, Bouaké)"],
    duree: "2 à 5 ans",
    debouches: "Ingénieur électricien, automaticien, technicien supérieur, maintenance industrielle.",
    domaines: ["électricité", "électrotechnique", "électronique", "énergie", "courant", "circuit", "automatisme"],
  },
  {
    nom: "Comptabilité & Finance",
    description:
      "Tenue et contrôle des comptes, audit, fiscalité, gestion financière.",
    profil: { R: 3, I: 6, A: 1, S: 2, E: 5, C: 9 },
    conditionsAcces: "Bac (surtout D, G). BTS, DUT ou licence. Préparation DEC/DECOFI.",
    etablissements: ["IUT — Université Alassane Ouattara", "INTEC", "Groupe ISM", "IPG"],
    duree: "2 à 7 ans",
    debouches: "Comptable, expert-comptable, auditeur, contrôleur financier, trésorier.",
    domaines: ["comptabilité", "finance", "compte", "audit", "fiscalité", "bilan", "chiffre"],
  },
  {
    nom: "Enseignement & Sciences de l'Éducation",
    description:
      "Formation des enseignants du primaire et secondaire, sciences de l'éducation.",
    profil: { R: 2, I: 6, A: 5, S: 9, E: 3, C: 4 },
    conditionsAcces: "Bac. Concours ENS (École Normale Supérieure).",
    etablissements: ["ENS — Abidjan", "ENS — Bouaké", "Université Alassane Ouattara"],
    duree: "3 à 5 ans",
    debouches: "Enseignant, professeur, conseiller pédagogique, inspecteur de l'éducation.",
    domaines: ["enseignement", "professeur", "maître", "école", "éducation", "pédagogie", "enseigner"],
  },
  {
    nom: "Géologie & Mines",
    description:
      "Exploration et exploitation des ressources minières, hydrogéologie, environnement.",
    profil: { R: 8, I: 8, A: 2, S: 2, E: 3, C: 5 },
    conditionsAcces: "Bac scientifique (C, D). Concours INP-HB.",
    etablissements: ["INP-HB — ESM (École des Mines)", "Université Alassane Ouattara"],
    duree: "5 ans",
    debouches: "Géologue, ingénieur des mines, hydrogéologue, prospecteur, environnement.",
    domaines: ["géologie", "mine", "terre", "minerai", "pétrole", "or", "ressource", "sous-sol"],
  },
  {
    nom: "Lettres Modernes & Langues",
    description:
      "Littérature, langues, linguistique. Formation à l'analyse de texte et à la communication.",
    profil: { R: 1, I: 5, A: 8, S: 7, E: 3, C: 3 },
    conditionsAcces: "Bac (toutes séries, surtout A, G). Inscription Université.",
    etablissements: ["Université Alassane Ouattara (Bouaké) — UFR LLS", "Université Jean Lorougnon Guédé"],
    duree: "3 à 5 ans",
    debouches: "Enseignant, journaliste, rédacteur, traducteur, attaché de communication.",
    domaines: ["lettre", "littérature", "langue", "français", "anglais", "texte", "écriture"],
  },
  {
    nom: "Management Public & Administration",
    description:
      "Gestion des affaires publiques, management administratif, gouvernance.",
    profil: { R: 1, I: 4, A: 3, S: 6, E: 8, C: 6 },
    conditionsAcces: "Bac (toutes séries). Concours ENA.",
    etablissements: ["ENA (Abidjan)", "Université Alassane Ouattara — UFR SJAP"],
    duree: "3 ans",
    debouches: "Administrateur civil, cadre de la fonction publique, magistrat administratif.",
    domaines: ["administration", "public", "fonction", "état", "gouvernance", "management", "ena"],
  },
];

// Pros/cons détaillés (financier, mental, physique) + conseils pour chaque filière
const PROS_CONS: Record<string, {
  avF: string[]; incF: string[];
  avM: string[]; incM: string[];
  avP: string[]; incP: string[];
  conseils: string[];
}> = {
  "Informatique & Génie Logiciel": {
    avF: ["Salaire élevé (300k–1.5M FCFA/mois)", "Freelance possible", "Demande forte en CI et à l'étranger", "Évolution rapide"],
    incF: ["Formation privée coûteuse", "Matériel à renouveler", "Coût connexion internet"],
    avM: ["Stimulation intellectuelle", "Créativité valorisée", "Communauté d'entraide", "Apprentissage continu"],
    incM: ["Veille technologique exigeante", "Risque de surcharge mentale", "Frustration des bugs"],
    avP: ["Travail en intérieur climatisé", "Horaires flexibles", "Télétravail possible"],
    incP: ["Sédentarité prolongée", "Fatigue visuelle", "Problèmes de dos"],
    conseils: ["Pauses régulières (Pomodoro)", "Bonne chaise + écran", "Sport 2x/semaine", "Rejoignez DevCI"],
  },
  "Génie Civil & BTP": {
    avF: ["Salaire correct (400k–1.8M FCFA)", "Secteur en boom en CI", "Projets de grande envergure", "Évolution vers chef de projet"],
    incF: ["Concours INP-HB sélectif", "Investissement en logiciels", "Débuts parfois précaires"],
    avM: ["Satisfaction de bâtir des ouvrages", "Travail d'équipe", "Variété des projets"],
    incM: ["Responsabilité lourde (sécurité)", "Stress des délais", "Pression budgétaire"],
    avP: ["Travail mixte bureau/terrain", "Activité physique modérée", "Déplacements"],
    incP: ["Exposition aux intempéries", "Risque sur chantier", "Horaires parfois étendus"],
    conseils: ["Maîtrisez AutoCAD/Revit", "Faites des stages chantier", "Respectez les normes de sécurité", "Réseautez avec les entreprises BTP"],
  },
  "Médecine & Sciences de la Santé": {
    avF: ["Salaire élevé en fin de carrière (500k–3M FCFA)", "Cabinet libéral lucratif", "Statut social valorisant", "Sécurité de l'emploi"],
    incF: ["Études longues (7–9 ans)", "Coût de la formation", "Installation cabinet coûteuse"],
    avM: ["Vocation d'aider", "Satisfaction de sauver des vies", "Respect social", "Diversité des cas"],
    incM: ["Stress émotionnel élevé", "Garde de nuit", "Charge mentale des décisions", "Risque de burn-out"],
    avP: ["Activité debout", "Déplacements entre services", "Gestes médicaux"],
    incP: ["Horaires épuisants", "Garde de nuit", "Exposition aux maladies", "Fatigue physique"],
    conseils: ["Évaluez votre résistance au stress", "Pratiquez la sophrologie", "Entourez-vous (famille, pairs)", "Prévoyez des jours de repos"],
  },
  "Sciences Économiques & Gestion": {
    avF: ["Salaire correct (400k–2M FCFA)", "Débouchés banques/BCEAO", "Polyvalence", "Évolution vers management"],
    incF: ["Concurrence forte sur les postes", "Spécialisation parfois nécessaire (master)"],
    avM: ["Compréhension du monde économique", "Analyse stratégique", "Polyvalence"],
    incM: ["Risque de routine", "Pression des résultats", "Veille économique permanente"],
    avP: ["Travail de bureau", "Horaires réguliers", "Peu d'effort physique"],
    incP: ["Sédentarité", "Écrans prolongés"],
    conseils: ["Faites des stages en banque", "Apprenez l'anglais économique", "Suivez l'actualité économique", "Visez un master spécialisé"],
  },
  "Droit & Sciences Juridiques": {
    avF: ["Salaire variable (300k–3M FCFA)", "Barreau/notation lucrative", "Fonction publique stable", "Honoraires libéraux"],
    incF: ["Études longues (5–7 ans)", "CAPA exigé pour le barreau", "Installation cabinet coûteuse"],
    avM: ["Plaidoirie stimulante", "Défense de justes causes", "Rigueur intellectuelle", "Statut social"],
    incM: ["Dossiers lourds émotionnellement", "Pression des échéances", "Veille juridique permanente"],
    avP: ["Travail de bureau", "Déplacements au tribunal", "Horaires irrégulières"],
    incP: ["Sédentarité", "Stress des audiences"],
    conseils: ["Pratiquez la plaidoirie en clinique juridique", "Faites des stages en cabinet", "Préparez le CAPA tôt", "Spécialisez-vous (affaires, pénal)"],
  },
  "Marketing & Commerce": {
    avF: ["Salaire correct (300k–1.5M FCFA)", "Commissions sur ventes", "Secteur dynamique", "Évolution rapide"],
    incF: ["Pression sur objectifs", "Salaire débutant modéré", "Concurrence forte"],
    avM: ["Créativité valorisée", "Contact humain", "Variété des missions", "Sens de l'innovation"],
    incM: ["Pression des objectifs chiffrés", "Stress des lancements", "Veille concurrentielle"],
    avP: ["Déplacements clients", "Salons/événements", "Activité modérée"],
    incP: ["Horaires parfois étendues", "Déplacements fréquents"],
    conseils: ["Maîtrisez le marketing digital", "Faites des stages en agence", "Développez votre réseau", "Apprenez l'anglais commercial"],
  },
  "Architecture & Beaux-Arts": {
    avF: ["Salaire variable (400k–2.5M FCFA)", "Libéral possible", "Projets prestigieux", "Passion métier"],
    incF: ["Concours sélectif", "Logiciels coûteux", "Débuts lents"],
    avM: ["Créativité au cœur", "Satisfaction esthétique", "Liberté de conception", "Reconnaissance"],
    incM: ["Pression des délais", "Critiques clients", "Rework fréquent"],
    avP: ["Travail bureau + terrain", "Maquettes physiques", "Visites de chantier"],
    incP: ["Sédentarité", "Fatigue visuelle (écrans)"],
    conseils: ["Construisez un portfolio solide", "Maîtrisez AutoCAD/SketchUp", "Faites des stages en agence", "Participez à des concours d'architecture"],
  },
  "Communication & Journalisme": {
    avF: ["Salaire moyen (200k–1.2M FCFA)", "Freelance possible", "Média en expansion", "Polyvalence"],
    incF: ["Salaire débutant modéré", "CDD fréquents", "Concurrence forte"],
    avM: ["Contact humain", "Enquêtes stimulantes", "Sens de l'investigation", "Reconnaissance"],
    incM: ["Pression de l'info en continu", "Stress des échéances", "Risque de harcèlement en ligne"],
    avP: ["Déplacements", "Terrain", "Horaires irrégulières"],
    incP: ["Horaires étendues", "Déplacements fréquents"],
    conseils: ["Multi-spécialisez-vous (écrit, TV, web)", "Faites des stages en rédaction", "Développez votre e-réputation", "Apprenez l'anglais"],
  },
  "Agronomie & Sciences Agricoles": {
    avF: ["Salaire correct (350k–1.5M FCFA)", "Secteur porteur (agro-industrie)", "Projets ruraux", "Entrepreneuriat possible"],
    incF: ["Concours ESA sélectif", "Débuts en zone rurale", "Investissement matériel"],
    avM: ["Contact avec la nature", "Sens de l'utile (sécurité alimentaire)", "Variété des cultures"],
    incM: ["Dépendance météo", "Stress des récoltes", "Isolement rural possible"],
    avP: ["Travail en plein air", "Activité physique modérée", "Déplacements"],
    incP: ["Exposition au soleil", "Chaleur", "Port de charges"],
    conseils: ["Faites des stages en exploitation", "Intéressez-vous à l'agro-écologie", "Réseautez avec SODEFOR/SODERIZ", "Visez l'agro-industrie (Cémoi, SIFCA)"],
  },
  "Électrotechnique & Électronique": {
    avF: ["Salaire correct (350k–1.8M FCFA)", "Demande industrielle forte", "Évolution vers maintenance", "CIE/CIPREL recrutent"],
    incF: ["Concours INP-HB sélectif", "Matériel de mesure coûteux"],
    avM: ["Résolution de problèmes techniques", "Satisfaction de réparer", "Logique appliquée"],
    incM: ["Risque d'électrocution (stress)", "Veille technique", "Astreintes possibles"],
    avP: ["Travail mixte bureau/terrain", "Activité physique modérée", "Déplacements"],
    incP: ["Travail en hauteur parfois", "Exposition au bruit", "Horaires d'astreinte"],
    conseils: ["Maîtrisez l'automatisme (PLC)", "Faites des stages en industrie", "Certifiez-vous (habilitation B1V)", "Visez la maintenance industrielle"],
  },
  "Comptabilité & Finance": {
    avF: ["Salaire stable (250k–1.5M FCFA)", "Expert-comptable très rémunérateur", "Tous secteurs recrutent", "Évolution prévisible"],
    incF: ["Formation longue pour l'expertise (DEC)", "Stress des clôtures annuelles"],
    avM: ["Rigueur valorisée", "Sécurité de l'emploi", "Compréhension de l'entreprise"],
    incM: ["Routine possible", "Pression des clôtures fiscales", "Veille fiscale permanente"],
    avP: ["Travail de bureau", "Horaires régulières", "Peu d'effort"],
    incP: ["Sédentarité", "Écrans prolongés"],
    conseils: ["Visez le DEC/DECOFI", "Maîtrisez SAP/Sage", "Faites des stages en cabinet", "Spécialisez-vous en audit"],
  },
  "Enseignement & Sciences de l'Éducation": {
    avF: ["Salaire stable (200k–800k FCFA)", "Fonction publique sécurisante", "Vacations possibles", "Évolution par concours"],
    incF: ["Salaire débutant modéré", "Concours ENS sélectif", "Affectation en zone rurale"],
    avM: ["Transmettre le savoir", "Satisfaction d'éduquer", "Contact avec les jeunes", "Vacances scolaires"],
    incM: ["Charge de travail (cours + corrections)", "Discipline difficile", "Pression des résultats"],
    avP: ["Travail debout", "Voix sollicitée", "Déplacements entre classes"],
    incP: ["Fatigue vocale", "Pieds prolongés", "Bruyant"],
    conseils: ["Préparez les concours ENS tôt", "Faites des remplacements", "Développez des outils pédagogiques", "Visez l'inspection pour évoluer"],
  },
  "Géologie & Mines": {
    avF: ["Salaire élevé (500k–2.5M FCFA)", "Sociétés minières (SODEMI, Randgold) recrutent", "Prime de terrain", "Pétrole/or en CI"],
    incF: ["Concours INP-HB sélectif", "Déplacements coûteux", "Équipement personnel"],
    avM: ["Travail en plein air", "Découvertes scientifiques", "Sens de l'exploration", "Variété"],
    incM: ["Isolement sur site", "Stress des échéances de forage", "Responsabilité environnementale"],
    avP: ["Plein air", "Activité physique", "Terrain exigeant"],
    incP: ["Chaleur/soleil", "Port d'échantillons", "Longs déplacements"],
    conseils: ["Maîtrisez les SIG (QGIS)", "Faites des stages sur site minier", "Intéressez-vous à l'environnement", "Visez l'hydrogéologie (secteur porteur)"],
  },
  "Lettres Modernes & Langues": {
    avF: ["Salaire moyen (200k–1.2M FCFA)", "Enseignement stable", "Traduction freelance", "Polyvalence"],
    incF: ["Salaire débutant modéré", "Débouchés plus restreints", "Concurrence dans le journalisme"],
    avM: ["Passion de la lecture/écriture", "Ouverture culturelle", "Esprit critique", "Créativité"],
    incM: ["Routine possible", "Isolement intellectuel", "Pression des publications"],
    avP: ["Travail de bureau", "Horaires régulières", "Peu d'effort"],
    incP: ["Sédentarité", "Fatigue visuelle"],
    conseils: ["Combinez avec une 2e compétence (communication, traduction)", "Apprenez 2 langues étrangères", "Faites des stages en rédaction", "Visez l'enseignement supérieur"],
  },
  "Management Public & Administration": {
    avF: ["Salaire stable (300k–1.5M FCFA)", "Fonction publique sécurisante", "Statut enviable", "Évolution par concours"],
    incF: ["Concours ENA sélectif", "Salaire débutant modéré", "Affectation en préfecture"],
    avM: ["Service de l'État", "Sens de l'intérêt général", "Pouvoir de décision", "Réseau"],
    incM: ["Pression administrative", "Lourdeur hiérarchique", "Veille juridique"],
    avP: ["Travail de bureau", "Horaires régulières", "Réunions"],
    incP: ["Sédentarité", "Stress des responsabilités"],
    conseils: ["Préparez le concours ENA tôt", "Faites des stages en ministère", "Développez votre éloquence", "Visez la haute fonction publique"],
  },
};

const METIERS: Array<{
  nom: string;
  description: string;
  profil: ProfilDef;
  secteur: string;
  debouches: string;
  salaire: string;
  competences: string[];
  niveauMinimum: string;
}> = [
  { nom: "Développeur informatique", description: "Conçoit et code des logiciels, sites web et applications.",
    profil: { R: 7, I: 9, A: 4, S: 2, E: 3, C: 7 }, secteur: "Numérique / IT",
    debouches: "Banques, startups, télécoms (Orange, MTN), freelancing.", salaire: "300 000 – 1 500 000 FCFA/mois",
    competences: ["Logique", "Algorithmique", "Patience", "Veille technologique"], niveauMinimum: "Bac+2 à Bac+5" },
  { nom: "Ingénieur civil / BTP", description: "Conçoit et supervise la construction d'ouvrages.",
    profil: { R: 9, I: 7, A: 2, S: 2, E: 4, C: 6 }, secteur: "Construction / BTP",
    debouches: "Bureaux d'études, entreprises de BTP (COLAS, SOGEA), fonction publique.",
    salaire: "400 000 – 1 800 000 FCFA/mois", competences: ["Rigueur", "Vision spatiale", "Encadrement", "Sécurité"], niveauMinimum: "Bac+5" },
  { nom: "Médecin généraliste", description: "Diagnostique et traite les maladies des patients.",
    profil: { R: 5, I: 9, A: 2, S: 8, E: 2, C: 4 }, secteur: "Santé",
    debouches: "Hôpitaux publics, cliniques privées, cabinet libéral, ONG.",
    salaire: "500 000 – 3 000 000 FCFA/mois", competences: ["Empathie", "Rigueur scientifique", "Écoute", "Décision"], niveauMinimum: "Bac+7 à Bac+9" },
  { nom: "Infirmier / Infirmière", description: "Soigne et accompagne les patients au quotidien.",
    profil: { R: 5, I: 6, A: 2, S: 9, E: 2, C: 4 }, secteur: "Santé",
    debouches: "Hôpitaux, centres de santé, cliniques, ONG humanitaires.",
    salaire: "150 000 – 500 000 FCFA/mois", competences: ["Empathie", "Résistance", "Soins", "Écoute"], niveauMinimum: "Bac+3" },
  { nom: "Économiste / Analyste", description: "Analyse les phénomènes économiques et conseille les décideurs.",
    profil: { R: 1, I: 7, A: 2, S: 3, E: 7, C: 6 }, secteur: "Économie / Finance",
    debouches: "BCEAO, ministère de l'Économie, banques, instituts de recherche, ONG.",
    salaire: "400 000 – 2 000 000 FCFA/mois", competences: ["Analyse", "Statistiques", "Synthèse", "Veille"], niveauMinimum: "Bac+5" },
  { nom: "Comptable / Expert-comptable", description: "Tient et contrôle les comptes des entreprises.",
    profil: { R: 3, I: 6, A: 1, S: 2, E: 5, C: 9 }, secteur: "Finance / Comptabilité",
    debouches: "Cabinets d'expertise, entreprises, banques, fonction publique.",
    salaire: "250 000 – 1 500 000 FCFA/mois", competences: ["Rigueur", "Méthode", "Honnêteté", "Chiffres"], niveauMinimum: "Bac+2 à Bac+8" },
  { nom: "Avocat / Juriste d'entreprise", description: "Conseille et défend en matière juridique.",
    profil: { R: 1, I: 5, A: 3, S: 7, E: 6, C: 5 }, secteur: "Droit / Justice",
    debouches: "Cabinets d'avocats, entreprises, banques, magistrature.",
    salaire: "300 000 – 3 000 000 FCFA/mois", competences: ["Argumentation", "Écriture", "Écoute", "Éthique"], niveauMinimum: "Bac+5 à Bac+7" },
  { nom: "Chargé de marketing", description: "Promeut les produits et gère l'image d'une marque.",
    profil: { R: 1, I: 3, A: 5, S: 6, E: 9, C: 4 }, secteur: "Marketing / Commerce",
    debouches: "Grandes entreprises (Nestlé, Cémoi, Solibra), agences de pub, startups.",
    salaire: "300 000 – 1 500 000 FCFA/mois", competences: ["Créativité", "Stratégie", "Analyse marché", "Communication"], niveauMinimum: "Bac+3 à Bac+5" },
  { nom: "Architecte", description: "Conçoit les bâtiments et aménage les espaces.",
    profil: { R: 7, I: 6, A: 9, S: 2, E: 4, C: 3 }, secteur: "Architecture / Construction",
    debouches: "Agences d'architecture, BTP, urbanisme, libéral.",
    salaire: "400 000 – 2 500 000 FCFA/mois", competences: ["Créativité", "Dessin", "Vision spatiale", "Technique"], niveauMinimum: "Bac+5" },
  { nom: "Journaliste / Rédacteur", description: "Informe le public via la presse, la radio, la TV ou le web.",
    profil: { R: 1, I: 4, A: 7, S: 7, E: 6, C: 3 }, secteur: "Médias / Communication",
    debouches: "Presse écrite (Fraternité Matin, Soir Info), radio, TV (RTI, NCRI), web.",
    salaire: "200 000 – 1 200 000 FCFA/mois", competences: ["Curiosité", "Écriture", "Esprit critique", "Écoute"], niveauMinimum: "Bac+3 à Bac+5" },
  { nom: "Ingénieur agronome", description: "Améliore les productions agricoles et gère durablement les ressources.",
    profil: { R: 8, I: 7, A: 2, S: 3, E: 3, C: 4 }, secteur: "Agriculture / Agro-industrie",
    debouches: "Ministère de l'Agriculture, ACEP, CCI, ONG rurales, agro-industrie (Cémoi, SIFCA).",
    salaire: "350 000 – 1 500 000 FCFA/mois", competences: ["Observation", "Conduite de projet", "Rigueur", "Terrain"], niveauMinimum: "Bac+5" },
  { nom: "Ingénieur électricien", description: "Conçoit et maintient des systèmes électriques et électroniques.",
    profil: { R: 9, I: 7, A: 2, S: 2, E: 3, C: 6 }, secteur: "Énergie / Industrie",
    debouches: "CIE (Compagnie Ivoirienne d'Électricité), CIPREL, industrie, maintenance.",
    salaire: "350 000 – 1 800 000 FCFA/mois", competences: ["Technique", "Sécurité", "Diagnostic", "Méthode"], niveauMinimum: "Bac+2 à Bac+5" },
  { nom: "Enseignant / Professeur", description: "Transmet des connaissances et forme les élèves.",
    profil: { R: 2, I: 6, A: 5, S: 9, E: 3, C: 4 }, secteur: "Éducation",
    debouches: "ENEP, lycées et collèges publics/privés, MENA, universités.",
    salaire: "200 000 – 800 000 FCFA/mois", competences: ["Pédagogie", "Patience", "Écoute", "Maîtrise discipline"], niveauMinimum: "Bac+3 à Bac+5" },
  { nom: "Géologue / Ingénieur des mines", description: "Explore et exploite les ressources du sous-sol.",
    profil: { R: 8, I: 8, A: 2, S: 2, E: 3, C: 5 }, secteur: "Mines / Énergie",
    debouches: "SODEMI, Randgold, sociétés pétrolières (CI-24, TOTAL), BTP, hydrogéologie.",
    salaire: "500 000 – 2 500 000 FCFA/mois", competences: ["Terrain", "Analyse", "Observation", "Rigueur"], niveauMinimum: "Bac+5" },
  { nom: "Administrateur civil", description: "Pilote les politiques publiques au sein de l'État.",
    profil: { R: 1, I: 4, A: 3, S: 6, E: 8, C: 6 }, secteur: "Fonction publique",
    debouches: "Ministères, présidence, collectivités territoriales, agences d'État.",
    salaire: "300 000 – 1 500 000 FCFA/mois", competences: ["Leadership", "Rédaction", "Vision", "Organisation"], niveauMinimum: "Bac+3 (ENA)" },
  { nom: "Entrepreneur / Créateur d'entreprise", description: "Lance et développe son propre projet économique.",
    profil: { R: 5, I: 4, A: 4, S: 5, E: 9, C: 4 }, secteur: "Entrepreneuriat",
    debouches: "Tous secteurs : tech, agriculture, services, commerce, industrie.",
    salaire: "Variable (dépend du succès)", competences: ["Initiative", "Résilience", "Vision", "Vente"], niveauMinimum: "Tous niveaux" },
  { nom: "Designer graphique", description: "Crée des visuels, identités et supports de communication.",
    profil: { R: 3, I: 5, A: 9, S: 3, E: 4, C: 3 }, secteur: "Design / Communication",
    debouches: "Agences de communication, entreprises, médias, freelancing.",
    salaire: "200 000 – 1 200 000 FCFA/mois", competences: ["Créativité", "Logiciels graphiques", "Esthétique", "Écoute client"], niveauMinimum: "Bac+2 à Bac+5" },
  { nom: "Commercial / Représentant de vente", description: "Vend des produits et développe le portefeuille client.",
    profil: { R: 3, I: 3, A: 3, S: 7, E: 8, C: 4 }, secteur: "Vente / Commerce",
    debouches: "Télécoms, FMCG (Nestlé, Unilever), banques, assurances, industrie.",
    salaire: "200 000 + commissions – 1 500 000 FCFA/mois", competences: ["Persuasion", "Écoute", "Négociation", "Résistance"], niveauMinimum: "Bac à Bac+3" },
  { nom: "Psychologue / Conseiller d'orientation", description: "Accompagne les personnes dans leurs difficultés et leur projet de vie.",
    profil: { R: 1, I: 7, A: 4, S: 9, E: 3, C: 3 }, secteur: "Accompagnement / Santé mentale",
    debouches: "Établissements scolaires, ONG, structures de santé, cabinets privés.",
    salaire: "250 000 – 1 200 000 FCFA/mois", competences: ["Écoute", "Empathie", "Confidentialité", "Analyse"], niveauMinimum: "Bac+5" },
  { nom: "Technicien de laboratoire", description: "Réalise des analyses et expérimentations scientifiques.",
    profil: { R: 7, I: 8, A: 2, S: 3, E: 2, C: 6 }, secteur: "Sciences / Laboratoire",
    debouches: "Hôpitaux, industries agroalimentaires, instituts de recherche, contrôle qualité.",
    salaire: "180 000 – 600 000 FCFA/mois", competences: ["Rigueur", "Précision", "Observation", "Méthode"], niveauMinimum: "Bac+2 à Bac+3" },
];

// Liens filière ↔ métier (par nom)
const FILIERE_METIER_LINKS: Array<[string, string]> = [
  ["Informatique & Génie Logiciel", "Développeur informatique"],
  ["Informatique & Génie Logiciel", "Ingénieur électricien"],
  ["Informatique & Génie Logiciel", "Designer graphique"],
  ["Génie Civil & BTP", "Ingénieur civil / BTP"],
  ["Génie Civil & BTP", "Architecte"],
  ["Médecine & Sciences de la Santé", "Médecin généraliste"],
  ["Médecine & Sciences de la Santé", "Infirmier / Infirmière"],
  ["Médecine & Sciences de la Santé", "Psychologue / Conseiller d'orientation"],
  ["Sciences Économiques & Gestion", "Économiste / Analyste"],
  ["Sciences Économiques & Gestion", "Entrepreneur / Créateur d'entreprise"],
  ["Sciences Économiques & Gestion", "Commercial / Représentant de vente"],
  ["Droit & Sciences Juridiques", "Avocat / Juriste d'entreprise"],
  ["Droit & Sciences Juridiques", "Administrateur civil"],
  ["Marketing & Commerce", "Chargé de marketing"],
  ["Marketing & Commerce", "Commercial / Représentant de vente"],
  ["Marketing & Commerce", "Designer graphique"],
  ["Architecture & Beaux-Arts", "Architecte"],
  ["Architecture & Beaux-Arts", "Designer graphique"],
  ["Communication & Journalisme", "Journaliste / Rédacteur"],
  ["Communication & Journalisme", "Chargé de marketing"],
  ["Agronomie & Sciences Agricoles", "Ingénieur agronome"],
  ["Électrotechnique & Électronique", "Ingénieur électricien"],
  ["Électrotechnique & Électronique", "Technicien de laboratoire"],
  ["Comptabilité & Finance", "Comptable / Expert-comptable"],
  ["Comptabilité & Finance", "Économiste / Analyste"],
  ["Enseignement & Sciences de l'Éducation", "Enseignant / Professeur"],
  ["Enseignement & Sciences de l'Éducation", "Psychologue / Conseiller d'orientation"],
  ["Géologie & Mines", "Géologue / Ingénieur des mines"],
  ["Géologie & Mines", "Technicien de laboratoire"],
  ["Lettres Modernes & Langues", "Journaliste / Rédacteur"],
  ["Lettres Modernes & Langues", "Enseignant / Professeur"],
  ["Management Public & Administration", "Administrateur civil"],
  ["Management Public & Administration", "Avocat / Juriste d'entreprise"],
];

const INTENTIONS: Array<{ libelle: string; description: string }> = [
  { libelle: "salutation", description: "Bonjour, bonsoir, salut — accueil de l'utilisateur." },
  { libelle: "recherche_filiere", description: "Recherche d'information sur une filière d'études." },
  { libelle: "recherche_metier", description: "Recherche d'information sur un métier." },
  { libelle: "demande_debouches", description: "Question sur les débouchés d'une filière ou métier." },
  { libelle: "demande_recommandation", description: "Demande de recommandation personnalisée." },
  { libelle: "demande_test_riasec", description: "Demande de passer le test RIASEC." },
  { libelle: "consultation_profil", description: "Consultation de son propre profil et scores RIASEC." },
  { libelle: "aide_conseiller", description: "Demande de mise en relation avec un conseiller humain." },
  { libelle: "remerciement", description: "Merci, super — remerciements." },
  { libelle: "information_generale", description: "Question générale sur le fonctionnement ou autre." },
  { libelle: "demarrage_profil", description: "Démarrage ou mise à jour du profil utilisateur." },
];

async function main() {
  console.log("📌 Synchronisation des intentions...");
  for (const it of INTENTIONS) {
    await db.intention.upsert({
      where: { libelle: it.libelle },
      create: { libelle: it.libelle, description: it.description },
      update: { description: it.description },
    });
  }

  console.log("❓ Synchronisation des questions RIASEC...");
  for (const q of RIASEC_QUESTIONS) {
    const data = { dimension: q.dimension, ordre: q.ordre, enonce: q.enonce };
    const existing = await db.questionRiasec.findFirst({
      where: { dimension: q.dimension, ordre: q.ordre },
      select: { id: true },
    });
    if (existing) {
      await db.questionRiasec.update({ where: { id: existing.id }, data });
    } else {
      await db.questionRiasec.create({ data });
    }
  }

  console.log("🎓 Synchronisation des filières...");
  const filiereByName: Record<string, string> = {};
  for (const f of FILIERES) {
    const pc = PROS_CONS[f.nom] ?? { avF: [], incF: [], avM: [], incM: [], avP: [], incP: [], conseils: [] };
    const data = {
      nom: f.nom,
      description: f.description,
      profilRealiste: f.profil.R,
      profilInvestigateur: f.profil.I,
      profilArtistique: f.profil.A,
      profilSocial: f.profil.S,
      profilEntreprenant: f.profil.E,
      profilConventionnel: f.profil.C,
      conditionsAcces: f.conditionsAcces,
      etablissementsDisponibles: f.etablissements.join(" | "),
      duree: f.duree,
      debouchesText: f.debouches,
      domaines: f.domaines.join("|"),
      avantagesFinanciers: pc.avF.join("|"),
      inconvenientsFinanciers: pc.incF.join("|"),
      avantagesMentaux: pc.avM.join("|"),
      inconvenientsMentaux: pc.incM.join("|"),
      avantagesPhysiques: pc.avP.join("|"),
      inconvenientsPhysiques: pc.incP.join("|"),
      conseils: pc.conseils.join("|"),
    };
    const existing = await db.filiere.findFirst({
      where: { nom: f.nom },
      select: { id: true },
    });
    const created = existing
      ? await db.filiere.update({ where: { id: existing.id }, data })
      : await db.filiere.create({ data });
    filiereByName[f.nom] = created.id;
  }

  console.log("💼 Synchronisation des métiers...");
  const metierByName: Record<string, string> = {};
  for (const m of METIERS) {
    const data = {
      nom: m.nom,
      description: m.description,
      profilRealiste: m.profil.R,
      profilInvestigateur: m.profil.I,
      profilArtistique: m.profil.A,
      profilSocial: m.profil.S,
      profilEntreprenant: m.profil.E,
      profilConventionnel: m.profil.C,
      secteurActivite: m.secteur,
      descriptionDebouches: m.debouches,
      salaireMoyen: m.salaire,
      competencesCles: m.competences.join("|"),
      niveauMinimum: m.niveauMinimum,
    };
    const existing = await db.metier.findFirst({
      where: { nom: m.nom },
      select: { id: true },
    });
    const created = existing
      ? await db.metier.update({ where: { id: existing.id }, data })
      : await db.metier.create({ data });
    metierByName[m.nom] = created.id;
  }

  console.log("🔗 Synchronisation des liens filière ↔ métier...");
  for (const [fNom, mNom] of FILIERE_METIER_LINKS) {
    const fId = filiereByName[fNom];
    const mId = metierByName[mNom];
    if (fId && mId) {
      await db.filiereMetier.upsert({
        where: { filiereId_metierId: { filiereId: fId, metierId: mId } },
        create: { filiereId: fId, metierId: mId },
        update: {},
      });
    }
  }

  console.log("✅ Seed terminé !");
  console.log(`   - ${FILIERES.length} filières`);
  console.log(`   - ${METIERS.length} métiers`);
  console.log(`   - ${FILIERE_METIER_LINKS.length} liens filière ↔ métier`);
  console.log(`   - ${INTENTIONS.length} intentions`);
  console.log(`   - ${RIASEC_QUESTIONS.length} questions RIASEC`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur de seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
