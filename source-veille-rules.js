// =========================
// FLAIR — SOURCE VEILLE RULES V1
// =========================
// Référentiel métier discret issu de SOURCE-VEILLE.
// Objectif : enrichir progressivement le scoring FLAIR sans IA complexe.
// Ce fichier est autonome : aucun impact UI, aucun appel Supabase direct.
//
// FLAIR reste simple en façade :
// - priorité
// - score
// - raison courte
// - action recommandée
//
// Le commercial ne voit jamais le référentiel complet.

(function () {
  "use strict";

  const FLAIR_SOURCE_VEILLE_RULES = [
    {
      id: "qualite_rappel_corps_etranger",
      label: "Rappel produit / corps étranger",
      secteur: ["agroalimentaire", "qualite"],
      sources: ["rappel_conso", "presse", "google_alerts", "rss"],
      keywords: [
        "rappel produit",
        "rappel conso",
        "retrait rappel",
        "corps étranger",
        "corps etranger",
        "morceau de verre",
        "verre",
        "métal",
        "metal",
        "plastique dur",
        "contamination",
        "sécurité alimentaire",
        "securite alimentaire"
      ],
      score_bonus: 35,
      chaleur: "chaud",
      type_signal: "qualite_rappel_conso",
      raison: "Rappel produit ou risque qualité lié à un corps étranger.",
      action: "Contacter rapidement le responsable qualité ou production."
    },
    {
      id: "certification_ifs_brc",
      label: "Certification IFS / BRC",
      secteur: ["agroalimentaire", "qualite"],
      sources: ["presse", "linkedin", "google_alerts", "rss"],
      keywords: [
        "ifs",
        "brc",
        "audit ifs",
        "audit brc",
        "certification ifs",
        "certification brc",
        "certification qualité",
        "certification qualite",
        "sécurité alimentaire",
        "securite alimentaire"
      ],
      score_bonus: 20,
      chaleur: "tiede",
      type_signal: "qualite_rappel_conso",
      raison: "Démarche qualité ou certification pouvant révéler un besoin de sécurisation de ligne.",
      action: "Approcher le responsable qualité avec un angle conformité et maîtrise des risques."
    },
    {
      id: "extension_usine_nouvelle_ligne",
      label: "Extension d’usine / nouvelle ligne",
      secteur: ["industrie", "agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin"],
      keywords: [
        "extension usine",
        "extension d'usine",
        "agrandissement",
        "nouvelle usine",
        "nouveau site",
        "nouvelle ligne",
        "nouvelles lignes",
        "ligne de production",
        "ligne de conditionnement",
        "modernisation",
        "augmentation capacité",
        "augmentation capacite",
        "montée en cadence",
        "montee en cadence"
      ],
      score_bonus: 30,
      chaleur: "chaud",
      type_signal: "nouvelle_ligne",
      raison: "Projet industriel probable : extension, modernisation ou nouvelle ligne.",
      action: "Identifier production, maintenance ou travaux neufs."
    },
    {
      id: "nouveau_responsable_qualite",
      label: "Nouveau responsable qualité",
      secteur: ["industrie", "agroalimentaire", "qualite"],
      sources: ["linkedin", "presse", "google_alerts"],
      keywords: [
        "nouveau responsable qualité",
        "nouvelle responsable qualité",
        "responsable qualité rejoint",
        "responsable qualite rejoint",
        "nommé responsable qualité",
        "nommee responsable qualite",
        "prise de poste qualité",
        "prise de poste qualite",
        "quality manager"
      ],
      score_bonus: 18,
      chaleur: "tiede",
      type_signal: "recrutement",
      raison: "Nouvelle personne clé côté qualité : fenêtre d’entrée commerciale possible.",
      action: "Prendre contact avec une approche découverte et conseil qualité."
    },
    {
      id: "recrutement_qualite_production_maintenance",
      label: "Recrutement qualité / production / maintenance",
      secteur: ["industrie", "agroalimentaire"],
      sources: ["linkedin", "job_board", "presse", "google_alerts"],
      keywords: [
        "recrutement responsable qualité",
        "recrutement responsable qualite",
        "recrutement responsable production",
        "recrutement responsable maintenance",
        "technicien maintenance",
        "ingénieur process",
        "ingenieur process",
        "travaux neufs",
        "responsable amélioration continue",
        "responsable amelioration continue",
        "chef de projet industriel"
      ],
      score_bonus: 18,
      chaleur: "tiede",
      type_signal: "recrutement",
      raison: "Recrutement industriel pouvant indiquer croissance, réorganisation ou projet de ligne.",
      action: "Surveiller l’entreprise et identifier les décideurs production / maintenance."
    },
    {
      id: "marche_public_boamp_ted",
      label: "Marché public BOAMP / TED",
      secteur: ["industrie", "collectivite", "public"],
      sources: ["boamp", "ted", "marches_publics"],
      keywords: [
        "boamp",
        "ted",
        "marché public",
        "marche public",
        "appel d'offre",
        "appel d’offres",
        "avis de marché",
        "avis de marche",
        "consultation",
        "cahier des charges",
        "dce"
      ],
      score_bonus: 28,
      chaleur: "chaud",
      type_signal: "appel_offre",
      raison: "Opportunité structurée liée à une consultation ou un marché public.",
      action: "Analyser le cahier des charges et vérifier l’adéquation avec l’offre."
    },
    {
      id: "permis_industriel_sitadel",
      label: "Permis industriel / Sitadel",
      secteur: ["industrie", "immobilier_industriel"],
      sources: ["sitadel", "open_data", "presse"],
      keywords: [
        "permis de construire",
        "sitadel",
        "bâtiment industriel",
        "batiment industriel",
        "atelier de production",
        "construction usine",
        "plateforme logistique",
        "nouveau bâtiment",
        "nouveau batiment"
      ],
      score_bonus: 12,
      chaleur: "froid",
      type_signal: "investissement",
      raison: "Signal long terme : projet immobilier ou industriel potentiel.",
      action: "Surveiller l’avancement et identifier le futur exploitant."
    },
    {
      id: "investissement_industriel",
      label: "Investissement industriel",
      secteur: ["industrie", "agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin"],
      keywords: [
        "investissement",
        "millions d'euros",
        "millions euros",
        "plan d'investissement",
        "modernisation industrielle",
        "automatisation",
        "robotisation",
        "nouvel outil industriel",
        "outil de production",
        "site de production"
      ],
      score_bonus: 24,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Investissement industriel détecté : besoin équipement ou automatisation possible.",
      action: "Identifier le périmètre projet et les décideurs techniques."
    },
    {
      id: "pesage_etiquetage_controle_poids",
      label: "Pesage / étiquetage / contrôle poids",
      secteur: ["agroalimentaire", "industrie"],
      sources: ["presse", "google_alerts", "rss", "manuel"],
      keywords: [
        "pesage",
        "étiquetage",
        "etiquetage",
        "contrôle poids",
        "controle poids",
        "contrôle pondéral",
        "controle ponderal",
        "trieuse pondérale",
        "trieuse ponderale",
        "checkweigher",
        "peseuse",
        "poids prix",
        "traçabilité",
        "tracabilite"
      ],
      score_bonus: 28,
      chaleur: "chaud",
      type_signal: "investissement",
      raison: "Besoin potentiel autour du pesage, de l’étiquetage ou du contrôle poids.",
      action: "Préparer un angle pesage / contrôle poids / traçabilité."
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
      signal.secteur
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
        const chaleurDiff = (chaleurRank[b.chaleur] || 0) - (chaleurRank[a.chaleur] || 0);
        if (chaleurDiff !== 0) return chaleurDiff;
        return (b.score_bonus || 0) - (a.score_bonus || 0);
      })[0];

    return {
      score_bonus: Math.min(scoreBonus, 55),
      chaleur: bestRule.chaleur || null,
      type_signal: bestRule.type_signal || null,
      raison: bestRule.raison || "",
      action: bestRule.action || "",
      matched_rules: matchedRules.map(rule => ({
        id: rule.id,
        label: rule.label,
        score_bonus: rule.score_bonus,
        chaleur: rule.chaleur
      }))
    };
  }

  window.FLAIR_SOURCE_VEILLE_RULES = FLAIR_SOURCE_VEILLE_RULES;
  window.FLAIR_SOURCE_VEILLE = {
    rules: FLAIR_SOURCE_VEILLE_RULES,
    analyserSignalAvecRegles
  };
})();
