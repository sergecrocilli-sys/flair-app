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

  let score = 35;
  let type_signal = 'autre';
  let raison_score = "Signal peu qualifié : information intéressante mais besoin à confirmer.";
  let angle_commercial = "Approche découverte : comprendre le contexte industriel et les éventuels projets en cours.";
  let action_recommandee = "Surveiller l'entreprise ou rechercher un contact production / maintenance / qualité.";

  if (texte.includes("appel d'offre") || texte.includes("appel d’offres") || texte.includes("boamp") || texte.includes("marché public")) {
    score = 85;
    type_signal = 'appel_offre';
    raison_score = "Signal fort : appel d'offre ou marché public pouvant indiquer un projet d'équipement.";
    angle_commercial = "Approche projet : identifier le besoin, les contraintes techniques et le calendrier.";
    action_recommandee = "Rechercher le donneur d'ordre et préparer une prise de contact ciblée.";
  }

  if (texte.includes("nouvelle ligne") || texte.includes("ligne de production") || texte.includes("conditionnement") || texte.includes("emballage")) {
    score = Math.max(score, 80);
    type_signal = 'nouvelle_ligne';
    raison_score = "Signal fort : mention d'une ligne, du conditionnement ou de l'emballage.";
    angle_commercial = "Approche productivité / traçabilité : pesage-étiquetage, contrôle qualité, fiabilité ligne.";
    action_recommandee = "Identifier le responsable production ou maintenance et proposer un échange court.";
  }

  if (texte.includes("extension") || texte.includes("agrandissement") || texte.includes("nouveau bâtiment") || texte.includes("nouvel atelier")) {
    score = Math.max(score, 78);
    type_signal = 'extension_site';
    raison_score = "Signal intéressant : extension ou nouvel atelier pouvant précéder des investissements équipements.";
    angle_commercial = "Approche anticipation : accompagner le choix d'équipements avant finalisation du projet.";
    action_recommandee = "Identifier directeur de site / production et se positionner tôt dans le projet.";
  }

  if (texte.includes("recrutement") || texte.includes("embauche") || texte.includes("responsable maintenance") || texte.includes("responsable production") || texte.includes("responsable qualité") || texte.includes("directeur production")) {
    score = Math.max(score, 70);
    type_signal = 'recrutement';
    raison_score = "Signal moyen à fort : recrutement d'un profil industriel pouvant révéler une évolution d'organisation ou de ligne.";
    angle_commercial = "Approche contexte : comprendre les enjeux production, maintenance ou qualité du site.";
    action_recommandee = "Surveiller l'arrivée du nouveau responsable ou contacter le site avec un angle terrain.";
  }

  if (texte.includes("certification") || texte.includes("ifs") || texte.includes("brc") || texte.includes("audit") || texte.includes("qualité")) {
    score = Math.max(score, 65);
    type_signal = 'qualite';
    raison_score = "Signal qualité : certification, audit ou exigence de conformité pouvant ouvrir un échange utile.";
    angle_commercial = "Approche conformité / traçabilité : sécurisation des contrôles et des preuves qualité.";
    action_recommandee = "Identifier le responsable qualité et proposer un échange sur les contrôles en ligne.";
  }

  if (texte.includes("viande") || texte.includes("abattoir") || texte.includes("boucherie") || texte.includes("steak") || texte.includes("haché") || texte.includes("salaison") || texte.includes("charcuterie")) {
    score += 8;
  }

  if (texte.includes("fromage") || texte.includes("fromagerie") || texte.includes("fruitière") || texte.includes("laiterie")) {
    score += 8;
  }

  if (texte.includes("fruits") || texte.includes("légumes") || texte.includes("conditionnement fruits") || texte.includes("station")) {
    score += 6;
  }

  if (texte.includes("plats cuisinés") || texte.includes("traiteur") || texte.includes("barquette")) {
    score += 8;
  }

  score = Math.min(score, 100);

  let chaleur = 'froid';
  if (score >= 80) chaleur = 'chaud';
  else if (score >= 60) chaleur = 'tiede';

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
