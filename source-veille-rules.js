// =========================
// FLAIR — SOURCE VEILLE RULES V2
// =========================
// Référentiel métier complémentaire du moteur app.js.
// Rôle : enrichir le scoring avec une lecture industrielle plus fine.
// Limite volontaire : aucun appel Supabase, aucune logique UI, aucune IA générative.
//
// Doctrine :
// - app.js reste le moteur applicatif et décide du score final ;
// - ce fichier apporte des bonus métier, des scénarios et des recommandations ;
// - les règles ci-dessous préparent une future IA en explicitant la façon de penser FLAIR.
//
// Lecture cible : Industrie → Métier → Compatibilité offre commerciale.

(function () {
  "use strict";

  const FLAIR_SOURCE_VEILLE_RULES = [
    // =========================
    // COUCHE 1 — POTENTIEL INDUSTRIEL GÉNÉRIQUE
    // =========================
    {
      id: "industrie_extension_nouvelles_lignes",
      label: "Extension / nouvelles lignes",
      couche: "potentiel_industriel",
      secteur: ["industrie", "agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "extension", "extension usine", "extension d'usine", "agrandissement",
        "agrandit", "agrandir", "s'agrandit", "se développe", "se developpe",
        "nouvelle ligne", "nouvelles lignes", "plusieurs lignes", "ligne de production",
        "lignes de production", "ligne de conditionnement", "nouvel atelier", "nouveaux ateliers",
        "atelier de production", "augmentation capacité", "augmentation capacite",
        "augmente sa capacité", "augmente sa capacite", "augmentation de capacité",
        "augmentation de capacite", "montée en cadence", "montee en cadence"
      ],
      score_bonus: 32,
      chaleur: "chaud",
      type_signal: "nouvelle_ligne",
      raison: "L'entreprise augmente ou transforme sa capacité industrielle, ce qui peut déclencher des besoins en équipements de ligne.",
      opportunite: "Se positionner en amont sur les futurs besoins de contrôle qualité, détection, inspection, pesage ou automatisation.",
      action: "Identifier production, maintenance ou travaux neufs et proposer un échange ciblé sur les nouvelles lignes."
    },
    {
      id: "industrie_nouvelle_usine_site",
      label: "Nouvelle usine / nouveau site",
      couche: "potentiel_industriel",
      secteur: ["industrie", "agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "nouvelle usine", "nouveau site", "nouveau bâtiment", "nouveau batiment",
        "construction usine", "construit une usine", "site industriel", "site de production",
        "nouvel outil industriel", "outil de production", "plateforme industrielle"
      ],
      score_bonus: 34,
      chaleur: "chaud",
      type_signal: "investissement",
      raison: "Création ou structuration d'un site industriel : signal fort de projets équipements.",
      opportunite: "Entrer tôt dans le projet avant figement des choix techniques et des fournisseurs.",
      action: "Rechercher les responsables travaux neufs, production, maintenance ou qualité."
    },
    {
      id: "industrie_investissement_modernisation",
      label: "Investissement / modernisation",
      couche: "potentiel_industriel",
      secteur: ["industrie", "agroalimentaire", "plasturgie", "bois", "textile"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "investissement", "investit", "millions d'euros", "millions euros",
        "plan d'investissement", "modernisation", "modernisation industrielle",
        "automatisation", "robotisation", "nouvel équipement", "nouveaux équipements",
        "nouveaux equipements", "remplacement d'équipements", "remplacement equipements",
        "renouvellement équipement", "renouvellement equipement", "capex"
      ],
      score_bonus: 26,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Investissement ou modernisation industrielle détecté : besoin équipement possible.",
      opportunite: "Qualifier le périmètre du projet et vérifier s'il concerne les lignes, la qualité, l'inspection ou la fin de ligne.",
      action: "Approche découverte structurée auprès de la production ou de la maintenance."
    },

    // =========================
    // COUCHE 2 — BONUS MÉTIER PAR SECTEUR
    // =========================
    {
      id: "agro_qualite_certification",
      label: "Agroalimentaire / qualité / certification",
      couche: "bonus_metier",
      secteur: ["agroalimentaire", "qualite"],
      sources: ["presse", "linkedin", "google_alerts", "rss", "manuel"],
      keywords: [
        "ifs", "brc", "brcgs", "haccp", "audit ifs", "audit brc", "audit brcgs",
        "certification ifs", "certification brc", "certification brcgs",
        "certification qualité", "certification qualite", "sécurité alimentaire",
        "securite alimentaire", "contrôle qualité", "controle qualite", "plan de contrôle",
        "plan de controle", "qualité produit", "qualite produit"
      ],
      score_bonus: 20,
      chaleur: "tiede",
      type_signal: "qualite_rappel_conso",
      raison: "Contexte qualité ou certification : besoin possible de sécurisation et de traçabilité des contrôles.",
      opportunite: "Positionner une approche conseil autour de la maîtrise des risques et des audits qualité.",
      action: "Contacter le responsable qualité avec un angle conformité, CCP et preuves d'autocontrôle."
    },
    {
      id: "plasturgie_process",
      label: "Plasturgie / process",
      couche: "bonus_metier",
      secteur: ["plasturgie"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "plasturgie", "injection", "extrusion", "granulés", "granules",
        "compound", "recyclage plastique", "ligne d'extrusion", "ligne extrusion",
        "presse à injecter", "presse a injecter"
      ],
      score_bonus: 12,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Process plasturgie détecté : contexte industriel compatible avec contrôle, pesage ou détection selon l'application.",
      opportunite: "Qualifier les contraintes matière, contamination, dosage ou contrôle de production.",
      action: "Approche découverte technique auprès de la production ou du process."
    },
    {
      id: "bois_lignes_industrielles",
      label: "Bois / lignes industrielles",
      couche: "bonus_metier",
      secteur: ["bois"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "scierie", "palettes", "rabotage", "ligne bois", "bois industrie",
        "panneaux bois", "sciage", "ligne de sciage"
      ],
      score_bonus: 10,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Activité bois industrielle détectée : signal exploitable pour certains équipements de ligne.",
      opportunite: "Identifier les besoins de convoyage, contrôle, automatisation ou pesage industriel.",
      action: "Surveiller et qualifier le projet avant contact ciblé."
    },
    {
      id: "textile_lignes_recyclage",
      label: "Textile / non-tissé / recyclage",
      couche: "bonus_metier",
      secteur: ["textile"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "non-tissé", "non tissé", "non tisse", "fibres", "ligne textile",
        "recyclage textile", "lignes textiles", "textile technique"
      ],
      score_bonus: 12,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Contexte textile industriel détecté : ligne ou recyclage pouvant nécessiter contrôle ou automatisation.",
      opportunite: "Qualifier les besoins de contrôle, tri, pesage ou inspection selon la matière.",
      action: "Approche découverte technique si le signal mentionne ligne, capacité ou investissement."
    },

    // =========================
    // COUCHE 3 — COMPATIBILITÉ OFFRE COMMERCIALE
    // =========================
    {
      id: "detection_metaux_corps_etrangers",
      label: "Détection / corps étrangers",
      couche: "compatibilite_offre",
      secteur: ["agroalimentaire", "qualite", "industrie"],
      sources: ["rappel_conso", "presse", "google_alerts", "rss", "manuel"],
      keywords: [
        "détecteur de métaux", "detecteur de metaux", "détection de métaux",
        "detection de metaux", "corps étranger", "corps etranger", "métal", "metal",
        "particule métallique", "particule metallique", "contamination métallique",
        "contamination metallique", "ccp", "point critique", "maîtrise des risques",
        "maitrise des risques"
      ],
      score_bonus: 32,
      chaleur: "chaud",
      type_signal: "qualite_rappel_conso",
      raison: "Signal directement compatible avec une approche détection de métaux ou maîtrise des corps étrangers.",
      opportunite: "Proposer un échange autour de la sécurisation des lignes, des tests et de la conformité audit.",
      action: "Contacter prioritairement qualité, maintenance ou production."
    },
    {
      id: "inspection_rayons_x_qualite",
      label: "Inspection / rayons X",
      couche: "compatibilite_offre",
      secteur: ["agroalimentaire", "qualite", "industrie"],
      sources: ["presse", "google_alerts", "rss", "manuel"],
      keywords: [
        "rayons x", "rayon x", "x-ray", "xray", "inspection", "inspection produit",
        "contrôle intégrité", "controle integrite", "contrôle qualité", "controle qualite",
        "verre", "os", "pierre", "densité", "densite", "emballage complexe"
      ],
      score_bonus: 24,
      chaleur: "chaud",
      type_signal: "qualite_rappel_conso",
      raison: "Signal compatible avec une approche inspection produit ou rayons X.",
      opportunite: "Explorer les besoins de contrôle corps étrangers, intégrité produit ou qualité fin de ligne.",
      action: "Identifier le responsable qualité ou production et préparer un angle inspection."
    },
    {
      id: "pesage_etiquetage_controle_poids",
      label: "Pesage / étiquetage / contrôle poids",
      couche: "compatibilite_offre",
      secteur: ["agroalimentaire", "industrie"],
      sources: ["presse", "google_alerts", "rss", "manuel"],
      keywords: [
        "pesage", "étiquetage", "etiquetage", "contrôle poids", "controle poids",
        "contrôle pondéral", "controle ponderal", "trieuse pondérale", "trieuse ponderale",
        "checkweigher", "peseuse", "pesage dynamique", "balance industrielle",
        "poids prix", "préemballé", "preemballe", "préemballés", "preemballes",
        "surdosage", "rendement matière", "rendement matiere", "traçabilité", "tracabilite",
        "allergènes", "allergenes", "lot", "codification", "qr code"
      ],
      score_bonus: 26,
      chaleur: "chaud",
      type_signal: "investissement",
      raison: "Signal compatible avec pesage, contrôle poids, étiquetage ou traçabilité.",
      opportunite: "Qualifier les besoins de conformité, rendement matière, contrôle poids ou identification produit.",
      action: "Préparer un angle pesage / contrôle poids / traçabilité."
    },

    // =========================
    // SIGNAUX DIRECTS OU LONG TERME
    // =========================
    {
      id: "appel_offre_consultation",
      label: "Consultation / appel d'offre",
      couche: "signal_direct",
      secteur: ["industrie", "public", "agroalimentaire"],
      sources: ["boamp", "ted", "marches_publics", "presse", "manuel"],
      keywords: [
        "boamp", "ted", "marché public", "marche public", "appel d'offre",
        "appel d’offres", "avis de marché", "avis de marche", "consultation",
        "cahier des charges", "dce", "demande de prix", "demande de devis",
        "recherche fournisseur"
      ],
      score_bonus: 30,
      chaleur: "chaud",
      type_signal: "appel_offre",
      raison: "Consultation ou intention d'achat détectée : opportunité commerciale plus directe.",
      opportunite: "Vérifier rapidement l'adéquation avec l'offre et le délai de réponse.",
      action: "Analyser le besoin et contacter si l'offre est pertinente."
    },
    {
      id: "recrutement_industriel_cle",
      label: "Recrutement industriel clé",
      couche: "signal_indirect",
      secteur: ["industrie", "agroalimentaire"],
      sources: ["linkedin", "job_board", "presse", "google_alerts", "manuel"],
      keywords: [
        "recrutement responsable qualité", "recrutement responsable qualite",
        "nouveau responsable qualité", "nouvelle responsable qualité",
        "responsable qualité rejoint", "responsable qualite rejoint",
        "recrutement responsable production", "recrutement responsable maintenance",
        "directeur de production", "technicien maintenance", "ingénieur process",
        "ingenieur process", "travaux neufs", "responsable amélioration continue",
        "responsable amelioration continue", "chef de projet industriel"
      ],
      score_bonus: 18,
      chaleur: "tiede",
      type_signal: "recrutement",
      raison: "Recrutement industriel pouvant indiquer croissance, réorganisation ou projet de ligne.",
      opportunite: "Fenêtre d'entrée commerciale auprès d'un nouvel interlocuteur ou d'une équipe en évolution.",
      action: "Surveiller puis contacter avec une approche découverte ciblée."
    },
    {
      id: "permis_industriel_long_terme",
      label: "Permis / bâtiment industriel",
      couche: "signal_long_terme",
      secteur: ["industrie", "immobilier_industriel"],
      sources: ["sitadel", "open_data", "presse", "manuel"],
      keywords: [
        "permis de construire", "sitadel", "bâtiment industriel", "batiment industriel",
        "construction bâtiment", "construction batiment", "plateforme logistique",
        "atelier de production"
      ],
      score_bonus: 12,
      chaleur: "froid",
      type_signal: "investissement",
      raison: "Signal long terme : projet immobilier ou industriel potentiel, encore peu qualifié.",
      opportunite: "À exploiter seulement si l'exploitant, l'activité ou les lignes futures sont identifiés.",
      action: "Surveiller l'avancement et enrichir avant contact commercial."
    }
  ];

  function normaliserTexteFlair(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function ruleMatchesText(rule, texteNormalise) {
    return (rule.keywords || []).some(keyword =>
      texteNormalise.includes(normaliserTexteFlair(keyword))
    );
  }

  function getSignalText(signal = {}) {
    return [
      signal.titre,
      signal.entreprise_nom,
      signal.description,
      signal.contenu,
      signal.resume,
      signal.source,
      signal.type_source,
      signal.region,
      signal.secteur,
      signal.tags
    ].filter(Boolean).join(" ");
  }

  function analyserSignalAvecRegles(signal = {}) {
    const texte = normaliserTexteFlair(getSignalText(signal));
    const matchedRules = FLAIR_SOURCE_VEILLE_RULES.filter(rule =>
      ruleMatchesText(rule, texte)
    );

    if (!matchedRules.length) {
      return {
        score_bonus: 0,
        chaleur: null,
        type_signal: null,
        raison: "",
        opportunite: "",
        action: "",
        matched_rules: []
      };
    }

    const scoreBonus = matchedRules.reduce(
      (total, rule) => total + (Number(rule.score_bonus) || 0),
      0
    );

    const chaleurRank = { froid: 1, tiede: 2, chaud: 3 };
    const bestRule = matchedRules
      .slice()
      .sort((a, b) => {
        const couchePriorite = { compatibilite_offre: 4, signal_direct: 4, potentiel_industriel: 3, bonus_metier: 2, signal_indirect: 1, signal_long_terme: 0 };
        const coucheDiff = (couchePriorite[b.couche] || 0) - (couchePriorite[a.couche] || 0);
        if (coucheDiff !== 0) return coucheDiff;
        const chaleurDiff = (chaleurRank[b.chaleur] || 0) - (chaleurRank[a.chaleur] || 0);
        if (chaleurDiff !== 0) return chaleurDiff;
        return (b.score_bonus || 0) - (a.score_bonus || 0);
      })[0];

    const hasPotentielIndustriel = matchedRules.some(rule => rule.couche === "potentiel_industriel");
    const hasCompatibiliteOffre = matchedRules.some(rule => rule.couche === "compatibilite_offre");
    const hasBonusMetier = matchedRules.some(rule => rule.couche === "bonus_metier");

    let bonusCombine = 0;
    if (hasPotentielIndustriel && hasCompatibiliteOffre) bonusCombine += 12;
    if (hasPotentielIndustriel && hasBonusMetier) bonusCombine += 6;

    return {
      score_bonus: Math.min(scoreBonus + bonusCombine, 60),
      chaleur: bestRule.chaleur || null,
      type_signal: bestRule.type_signal || null,
      raison: bestRule.raison || "",
      opportunite: bestRule.opportunite || "",
      action: bestRule.action || "",
      matched_rules: matchedRules.map(rule => ({
        id: rule.id,
        label: rule.label,
        couche: rule.couche,
        score_bonus: rule.score_bonus,
        chaleur: rule.chaleur
      }))
    };
  }

  window.FLAIR_SOURCE_VEILLE_RULES = FLAIR_SOURCE_VEILLE_RULES;
  window.FLAIR_SOURCE_VEILLE = {
    rules: FLAIR_SOURCE_VEILLE_RULES,
    analyserSignalAvecRegles,
    normaliserTexteFlair
  };
})();
