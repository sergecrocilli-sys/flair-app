const SUPABASE_URL = "https://viafuquomtshuzuldwpq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpYWZ1cXVvbXRzaHV6dWxkd3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTkyODUsImV4cCI6MjA5MzQ3NTI4NX0.KtUZPsG04HF0AtdTCwYLyaH8IFBI2BBELIageV2xiM8";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null;

// =========================
// DOCTRINE MÉTIER FLAIR
// =========================
// FLAIR détecte, score, priorise et déclenche l'action.
// Le CRM gère ensuite la relation commerciale.
// Statuts actifs : nouveau, analyse, a_contacter.
// Statuts de sortie : traite, ignore, historique.
// Important : "traite" signifie qu'une vraie prise de contact a eu lieu
// avec un retour prospect/client, même minimal.

// =========================
// AUTH
// =========================

async function signUp() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  const { error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    alert("Erreur création compte : " + error.message);
    return;
  }

  alert("Compte créé. Vérifie ton email si Supabase le demande.");
}

async function signIn() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    alert("Erreur connexion : " + error.message);
    return;
  }

  user = data.user;
  await initUser();
}

async function logout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

async function initUser() {
  document.getElementById('auth').style.display = "none";
  document.getElementById('app').style.display = "block";

  const { data, error } = await supabaseClient
    .from('commerciaux')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    alert("Erreur lecture profil commercial : " + error.message);
    return;
  }

  if (!data) {
    const { error: insertError } = await supabaseClient
      .from('commerciaux')
      .insert([{ id: user.id, email: user.email }]);

    if (insertError) {
      alert("Erreur création profil commercial : " + insertError.message);
      return;
    }
  }

  await refreshCockpit();
}

// =========================
// HELPERS AFFICHAGE
// =========================

async function refreshCockpit() {
  await chargerSignaux();
  await chargerTop3();
  await chargerAContacter();
  await chargerStats();
  await chargerHistorique();
}

function signalTitle(s) {
  return s.titre || 'Signal sans titre';
}

function signalCompany(s) {
  return s.entreprise_nom || '';
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('fr-FR');
  } catch (err) {
    return '';
  }
}

function signalMetaDate(s) {
  return formatDate(s.date_signal || s.created_at);
}

function renderSignalCard(s, options = {}) {
  const rank = options.rank ? `#${options.rank} — ` : '';
  const showStatus = options.showStatus !== false;
  const showButtons = options.buttons || '';
  const date = signalMetaDate(s);

  return `
    <div class="signal-card">
      <b>${rank}${signalTitle(s)}</b><br>
      ${signalCompany(s)}<br>

      <div class="badge-row">
        ${badgeChaleur(s.chaleur)}
        ${badgeType(s.type_signal)}
        ${showStatus ? badgeStatut(s.statut) : ''}
      </div>

      ${date ? `<small><b>Date :</b> ${date}</small><br>` : ''}
      Score : ${s.score_pertinence || '-'}<br>

      ${s.raison_score ? `<small><b>Pourquoi :</b> ${s.raison_score}</small><br>` : ''}
      ${s.angle_commercial ? `<small><b>Angle :</b> ${s.angle_commercial}</small><br>` : ''}
      ${s.action_recommandee ? `<small><b>Action :</b> ${s.action_recommandee}</small><br>` : ''}
      ${s.commentaire_action ? `<small><b>Commentaire :</b> ${s.commentaire_action}</small><br>` : ''}

      ${showButtons ? `<div style="margin-top:8px;">${showButtons}</div>` : ''}
    </div>
    <hr>
  `;
}

function boutonsSignalActif(s) {
  return `
    <button onclick="changerStatut('${s.id}', 'a_contacter')">📌 À contacter</button>
    <button onclick="changerStatut('${s.id}', 'traite')">✅ Traité / feedback</button>
    <button onclick="changerStatut('${s.id}', 'ignore')">❌ Ignorer</button>
  `;
}

function boutonsAContacter(s) {
  return `
    <button onclick="changerStatut('${s.id}', 'traite')">✅ Traité / feedback</button>
    <button onclick="changerStatut('${s.id}', 'ignore')">❌ Ignorer</button>
  `;
}

// =========================
// SIGNAUX
// =========================

async function chargerSignaux() {
  if (!user) return;

  const filtreChaleur = document.getElementById('filtreChaleur')?.value || '';
  const filtreType = document.getElementById('filtreType')?.value || '';
  const filtreStatut = document.getElementById('filtreStatut')?.value || '';

  let query = supabaseClient
    .from('signaux')
    .select('*')
    .not('statut', 'in', '("a_contacter","historique")')
    .order('created_at', { ascending: false })
    .limit(20);

  if (filtreChaleur) {
    query = query.eq('chaleur', filtreChaleur);
  }

  if (filtreType) {
    query = query.eq('type_signal', filtreType);
  }

  if (filtreStatut) {
    query = query.eq('statut', filtreStatut);
  }

  const { data, error } = await query;

  if (error) {
    alert("Erreur chargement signaux : " + error.message);
    return;
  }

  const container = document.getElementById('signaux');
  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Aucun signal actif pour le moment.</p>";
    return;
  }

  data.forEach(s => {
    const div = document.createElement('div');
    div.innerHTML = renderSignalCard(s, {
      showStatus: true,
      buttons: boutonsSignalActif(s)
    });
    container.appendChild(div);
  });
}

async function chargerTop3() {
  if (!user) return;

  const { data, error } = await supabaseClient
    .from('signaux')
    .select('*')
    .eq('statut', 'analyse')
    .order('score_pertinence', { ascending: false })
    .order('date_signal', { ascending: false, nullsFirst: false })
    .limit(3);

  if (error) {
    alert("Erreur chargement Top 3 : " + error.message);
    return;
  }

  const container = document.getElementById('top3');
  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Aucun signal analysé pour le moment.</p>";
    return;
  }

  data.forEach((s, index) => {
    const div = document.createElement('div');
    div.innerHTML = renderSignalCard(s, {
      rank: index + 1,
      showStatus: false,
      buttons: boutonsSignalActif(s)
    });
    container.appendChild(div);
  });
}

async function chargerAContacter() {
  if (!user) return;

  const { data, error } = await supabaseClient
    .from('signaux')
    .select('*')
    .eq('statut', 'a_contacter')
    .order('score_pertinence', { ascending: false });

  if (error) {
    alert("Erreur chargement à contacter : " + error.message);
    return;
  }

  const container = document.getElementById('aContacter');
  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Aucun signal à contacter.</p>";
    return;
  }

  data.forEach(s => {
    const div = document.createElement('div');
    div.innerHTML = renderSignalCard(s, {
      showStatus: true,
      buttons: boutonsAContacter(s)
    });
    container.appendChild(div);
  });
}

async function chargerHistorique() {
  if (!user) return;

  const container = document.getElementById('historique');
  if (!container) return;

  const { data, error } = await supabaseClient
  .from('signaux')
  .select('*')
  .eq('statut', 'historique')
  .order('date_derniere_action', { ascending: false })
  .limit(20);

  if (error) {
    console.error("Erreur chargement historique :", error);
    container.innerHTML = "<p>Historique indisponible pour le moment.</p>";
    return;
  }

  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Aucun signal historisé pour le moment.</p>";
    return;
  }

  data.forEach(s => {
    const div = document.createElement('div');
    div.innerHTML = renderSignalCard(s, {
      showStatus: true,
      buttons: ''
    });
    container.appendChild(div);
  });
}

async function ajouterSignal() {
  if (!user) {
    alert("Tu dois être connecté.");
    return;
  }

  const titre = document.getElementById('titre').value.trim();
  const entreprise = document.getElementById('entreprise').value.trim();

  if (!titre) {
    alert("Merci de saisir un titre.");
    return;
  }

  const { error } = await supabaseClient
    .from('signaux')
    .insert([{
      commercial_id: user.id,
      titre: titre,
      entreprise_nom: entreprise,
      statut: 'nouveau',
      type_source: 'manuel'
    }]);

  if (error) {
    alert("Erreur insertion : " + error.message);
    return;
  }

  document.getElementById('titre').value = "";
  document.getElementById('entreprise').value = "";

  await refreshCockpit();
}

async function changerStatut(signalId, nouveauStatut) {

  const updateData = {
    statut: nouveauStatut,
    date_derniere_action: new Date().toISOString()
  };

  if (nouveauStatut === 'a_contacter') {
    updateData.date_a_contacter = new Date().toISOString();

    const { data: signalData } = await supabaseClient
      .from('signaux')
      .select('chaleur')
      .eq('id', signalId)
      .single();

    if (signalData?.chaleur === 'chaud') {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      updateData.relance_due_at = d.toISOString();
    }

    if (signalData?.chaleur === 'tiede') {
      const d = new Date();
      d.setDate(d.getDate() + 15);
      updateData.relance_due_at = d.toISOString();
    }
  }

  if (nouveauStatut === 'traite') {
    updateData.date_traitement = new Date().toISOString();
  }

  if (nouveauStatut === 'ignore') {
    updateData.statut = 'historique';
  }

  const { error } = await supabaseClient
    .from('signaux')
    .update(updateData)
    .eq('id', signalId);

  if (error) {
    alert("Erreur mise à jour statut : " + error.message);
    return;
  }

  await chargerSignaux();
  await chargerTop3();
  await chargerAContacter();
  await chargerHistorique();
  await chargerStats();
}
  await refreshCockpit();
}

async function chargerStats() {
  try {
    const { data, error } = await supabaseClient
      .from('signaux')
      .select('statut, chaleur');

    if (error) throw error;

    const signaux = data || [];

    const actifs = signaux.filter(s =>
      !['traite', 'ignore', 'a_contacter', 'historique'].includes(s.statut)
    ).length;

    const chauds = signaux.filter(s =>
      s.chaleur === 'chaud' &&
      !['traite', 'ignore', 'historique'].includes(s.statut)
    ).length;

    const aContacter = signaux.filter(s =>
      s.statut === 'a_contacter'
    ).length;

    const nouveaux = signaux.filter(s =>
      s.statut === 'nouveau'
    ).length;

    document.getElementById('statActifs').textContent = actifs;
    document.getElementById('statChauds').textContent = chauds;
    document.getElementById('statAContacter').textContent = aContacter;
    document.getElementById('statNouveaux').textContent = nouveaux;

  } catch (err) {
    console.error('Erreur chargement statistiques :', err);
  }
}

// =========================
// SCORING LOCAL FLAIR
// =========================

function escapeBackticks(value) {
  return String(value || '').replace(/`/g, "\\`");
}

function badge(label, type) {
  return `<span class="badge badge-${type}">${label}</span>`;
}

function badgeChaleur(chaleur) {
  if (chaleur === 'chaud') return badge('🔥 chaud', 'chaud');
  if (chaleur === 'tiede') return badge('🟠 tiède', 'tiede');
  return badge('❄️ froid', 'froid');
}

function badgeType(type) {
  if (!type) return badge('autre', 'type');

  const labels = {
    appel_offre: 'appel d’offre',
    investissement: 'investissement',
    recrutement: 'recrutement',
    nouvelle_ligne: 'nouvelle ligne',
    qualite_rappel_conso: 'qualité / rappel conso',
    autre: 'autre'
  };

  return badge(labels[type] || type, 'type');
}

function badgeStatut(statut) {
  if (!statut) return '';
  return badge(statut, 'statut');
}

function scoringLocal(titre, entreprise) {
  const texte = `${titre || ''} ${entreprise || ''}`.toLowerCase();

  let score = 30;
  let type_signal = 'autre';
  let raison_score = "Signal peu qualifié.";
  let angle_commercial = "Approche découverte.";
  let action_recommandee = "Surveiller.";

    // =========================
  // 0. APPEL D'OFFRE / MARCHÉ PUBLIC
  // =========================

  if (
    texte.includes("appel d'offre") ||
    texte.includes("appel d’offres") ||
    texte.includes("appel offre") ||
    texte.includes("marché public") ||
    texte.includes("boamp")
  ) {
    score += 20;
    type_signal = 'appel_offre';
    raison_score = "Signal fort : appel d'offre ou marché public pouvant indiquer un besoin d'équipement identifié.";
  }

  // =========================
  // 1. MOTS CLÉS FORTS (investissement / projet)
  // =========================

 if (
  texte.includes("investissement") ||
  texte.includes("millions") ||
  texte.includes("projet") ||
  texte.includes("construction") ||
  texte.includes("nouveau") ||
  texte.includes("nouvelle usine") ||
  texte.includes("nouveau projet") || 
  texte.includes("usine") ||
  texte.includes("ultramoderne") ||
  texte.includes("modernisation") ||
  texte.includes("extension")
) {
  score += 25;
  type_signal = 'investissement';
  raison_score = "Projet industriel détecté (investissement / construction / modernisation / nouvelle usine).";
}

    // =========================
  // 1B. RECRUTEMENT INDUSTRIEL
  // =========================

    if (
    texte.includes("recrutement") ||
    texte.includes("embauche") ||
    texte.includes("directeur de production") ||
    texte.includes("responsable production") ||
    texte.includes("responsable maintenance") ||
    texte.includes("responsable qualité")
  ) {
    score += 15;
    type_signal = 'recrutement';
    raison_score = "Signal de recrutement industriel : peut révéler une évolution d’organisation, une montée en charge ou un projet de ligne.";
  }

  // Bonus poste stratégique
  if (
    texte.includes("directeur") ||
    texte.includes("responsable")
  ) {
    score += 5;
  }

  // =========================
// 1C. RAPPEL CONSO / QUALITÉ
// =========================

if (
  texte.includes("rappel conso") ||
  texte.includes("retrait rappel") ||
  texte.includes("corps étranger") ||
  texte.includes("morceau de verre") ||
  texte.includes("verre") ||
  texte.includes("métal") ||
  texte.includes("plastique dur") ||
  texte.includes("détecteur de métaux") ||
  texte.includes("rayon x") ||
  texte.includes("contamination") ||
  texte.includes("urgence")
) {
  score += 25;

  type_signal = 'qualite_rappel_conso';

  raison_score =
    "Contexte qualité sensible détecté (rappel conso / contamination / corps étranger).";

  angle_commercial =
    "Approche conseil qualité et sécurisation de ligne.";

  action_recommandee =
    "Surveiller + identifier responsable qualité ou maintenance.";
}
  
  // =========================
  // 2. CAPACITÉ / PRODUCTION
  // =========================

  if (
    texte.includes("capacité") ||
    texte.includes("production") ||
    texte.includes("augmentation") ||
    texte.includes("cadence")
  ) {
    score += 15;
    raison_score += " Impact sur la capacité de production.";
  }

  // =========================
  // 3. LIGNE / CONDITIONNEMENT (très fort)
  // =========================

  if (
    texte.includes("ligne") ||
    texte.includes("nouvelles lignes") ||
    texte.includes("fabrication") ||
    texte.includes("conditionnement") ||
    texte.includes("emballage") ||
    texte.includes("découpe")
  ) {
    score += 20;
    type_signal = 'nouvelle_ligne';
    raison_score += " Présence de ligne ou conditionnement.";
  }

  // Bonus combo : nouvelle usine + ligne / fabrication / conditionnement
if (
  (texte.includes("nouvelle usine") || texte.includes("usine")) &&
  (
    texte.includes("ligne") ||
    texte.includes("nouvelles lignes") ||
    texte.includes("conditionnement") ||
    texte.includes("fabrication")
  )
) {
  score += 15;
  raison_score += " Nouvelle usine avec ligne, fabrication ou conditionnement.";
}

  // =========================
  // 4. SECTEUR AGRO (bonus)
  // =========================

  if (
    texte.includes("abattoir") ||
    texte.includes("viande") ||
    texte.includes("volaille") ||
    texte.includes("salaison") ||
    texte.includes("charcuterie") ||
    texte.includes("fromage") ||
    texte.includes("laiterie") ||
    texte.includes("fruits") ||
    texte.includes("légumes") ||
    texte.includes("traiteur")
  ) {
    score += 5;
  }

  // =========================
  // NORMALISATION
  // =========================

  score = Math.min(score, 100);

  let chaleur = 'froid';
  if (score >= 80) chaleur = 'chaud';
  else if (score >= 60) chaleur = 'tiede';

  // =========================
  // ANGLE + ACTION
  // =========================

  if (type_signal === 'qualite_rappel_conso') {
  angle_commercial = "Approche conseil qualité et sécurisation de ligne.";
  action_recommandee = "Surveiller + identifier responsable qualité ou maintenance.";
} else if (score >= 80) {
  angle_commercial = "Projet en cours : positionnement rapide sur équipements.";
  action_recommandee = "Identifier décideur production / maintenance et prendre contact rapidement.";
} else if (score >= 60) {
  angle_commercial = "Opportunité probable à moyen terme.";
  action_recommandee = "Surveiller + identifier contact.";
}

  return {
    score_pertinence: score,
    chaleur,
    type_signal,
    raison_score,
    angle_commercial,
    action_recommandee
  };
 }


async function analyserNouveauxSignaux() {
  const { data, error } = await supabaseClient
    .from('signaux')
    .select('*')
    .eq('statut', 'nouveau');

  if (error) {
    alert("Erreur chargement signaux : " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    alert("Aucun signal nouveau à analyser.");
    return;
  }

  for (const signal of data) {
    const texteComplet = [
      signal.titre,
      signal.entreprise_nom,
      signal.description,
      signal.contenu,
      signal.resume,
      signal.source,
      signal.type_source
    ].filter(Boolean).join(' ');

    const resultat = scoringLocal(texteComplet, '');

    const { error: updateError } = await supabaseClient
      .from('signaux')
      .update({
        score_pertinence: resultat.score_pertinence,
        chaleur: resultat.chaleur,
        type_signal: resultat.type_signal,
        raison_score: resultat.raison_score,
        angle_commercial: resultat.angle_commercial,
        action_recommandee: resultat.action_recommandee,
        traite_par_ia: false,
        statut: 'analyse'
      })
      .eq('id', signal.id);

    if (updateError) {
      console.error("Erreur update signal :", signal.id, updateError);
    }
  }

  await refreshCockpit();
  alert("Analyse terminée.");
}

// =========================
// EXPOSER LES FONCTIONS AUX BOUTONS HTML
// =========================

window.signUp = signUp;
window.signIn = signIn;
window.logout = logout;
window.chargerSignaux = chargerSignaux;
window.chargerTop3 = chargerTop3;
window.chargerAContacter = chargerAContacter;
window.chargerHistorique = chargerHistorique;
window.ajouterSignal = ajouterSignal;
window.analyserNouveauxSignaux = analyserNouveauxSignaux;
window.changerStatut = changerStatut;

// =========================
// SESSION AUTO AU CHARGEMENT
// =========================

supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    user = data.session.user;
    initUser();
  }
});
