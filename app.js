const SUPABASE_URL = "https://viafuquomtshuzuldwpq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpYWZ1cXVvbXRzaHV6dWxkd3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTkyODUsImV4cCI6MjA5MzQ3NTI4NX0.KtUZPsG04HF0AtdTCwYLyaH8IFBI2BBELIageV2xiM8";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null;

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

  await chargerSignaux();
}

// =========================
// SIGNAUX
// =========================

async function chargerSignaux() {
  if (!user) return;

  const { data, error } = await supabaseClient
    .from('signaux')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    alert("Erreur chargement signaux : " + error.message);
    return;
  }

  const container = document.getElementById('signaux');
  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Aucun signal pour le moment.</p>";
    return;
  }

  data.forEach(s => {
    const div = document.createElement('div');

    div.innerHTML = `
      <div class="signal-card">
        <b>${s.titre}</b><br>
        ${s.entreprise_nom || ''}<br>
        Score : ${s.score_pertinence || '-'}<br>
        Chaleur : ${s.chaleur || '-'}<br>
        Type : ${s.type_signal || '-'}<br>
        Statut : ${s.statut || '-'}<br>
        ${s.raison_score ? `<small><b>Pourquoi :</b> ${s.raison_score}</small><br>` : ''}
        ${s.angle_commercial ? `<small><b>Angle :</b> ${s.angle_commercial}</small><br>` : ''}
        ${s.action_recommandee ? `<small><b>Action :</b> ${s.action_recommandee}</small><br>` : ''}
        <button onclick="analyserSignal('${s.id}', \`${escapeBackticks(s.titre || '')}\`, \`${escapeBackticks(s.entreprise_nom || '')}\`)">
          Analyser
        </button>
      </div>
      <hr>
    `;

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

    div.innerHTML = `
      <div class="signal-card">
        <b>#${index + 1} — ${s.titre}</b><br>
        ${s.entreprise_nom || ''}<br>
        Score : ${s.score_pertinence || '-'}<br>
        Chaleur : ${s.chaleur || '-'}<br>
        Type : ${s.type_signal || '-'}<br>
        ${s.angle_commercial ? `<small><b>Angle :</b> ${s.angle_commercial}</small><br>` : ''}
        ${s.action_recommandee ? `<small><b>Action :</b> ${s.action_recommandee}</small><br>` : ''}
      </div>
      <hr>
    `;

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

  await chargerSignaux();
}

// =========================
// SCORING LOCAL FLAIR
// =========================

function escapeBackticks(value) {
  return String(value || '').replace(/`/g, "\\`");
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
    texte.includes("modernisation") ||
    texte.includes("extension")
  ) {
    score += 25;
    type_signal = 'investissement';
    raison_score = "Projet industriel détecté (investissement / construction / modernisation).";
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
    texte.includes("conditionnement") ||
    texte.includes("emballage") ||
    texte.includes("découpe")
  ) {
    score += 20;
    type_signal = 'nouvelle_ligne';
    raison_score += " Présence de ligne ou conditionnement.";
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

  if (score >= 80) {
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

async function analyserSignal(id, titre, entreprise) {
  const resultat = scoringLocal(titre, entreprise);

  const { error } = await supabaseClient
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
    .eq('id', id);

  if (error) {
    alert("Erreur analyse : " + error.message);
    return;
  }

  await chargerSignaux();
}

// =========================
// EXPOSER LES FONCTIONS AUX BOUTONS HTML
// =========================

window.signUp = signUp;
window.signIn = signIn;
window.logout = logout;
window.chargerSignaux = chargerSignaux;
window.ajouterSignal = ajouterSignal;
window.analyserSignal = analyserSignal;

// =========================
// SESSION AUTO AU CHARGEMENT
// =========================

supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    user = data.session.user;
    initUser();
  }
});
