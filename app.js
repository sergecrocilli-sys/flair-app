const SUPABASE_URL = "https://viafuquomtshuzuldwpq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpYWZ1cXVvbXRzaHV6dWxkd3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTkyODUsImV4cCI6MjA5MzQ3NTI4NX0.KtUZPsG04HF0AtdTCwYLyaH8IFBI2BBELIageV2xiM8";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null;
let currentProfil = null;
let invitationCourante = null;

// =========================
// DOCTRINE MÉTIER FLAIR
// =========================
// FLAIR détecte, score, priorise et déclenche l'action.
// Le CRM gère ensuite la relation commerciale.
// Objectif : feedback ultra rapide, sans logique CRM.
// Feedback autorisé : interet_confirme, interet_non_confirme, a_requalifier.

function getInvitationTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('invitation');
}

async function chargerInvitationDepuisUrl() {
  const token = getInvitationTokenFromUrl();
  if (!token) return;

  const { data, error } = await supabaseClient
    .rpc('flair_get_invitation_by_token', { p_token: token });

  if (error) {
    alert("Invitation introuvable ou expirée : " + error.message);
    return;
  }

  const invitation = Array.isArray(data) ? data[0] : null;

  if (!invitation) {
    alert("Invitation introuvable, expirée ou déjà acceptée.");
    return;
  }

  invitationCourante = invitation;
  afficherInvitationRecue(invitation);
}

const title = document.getElementById('invitationLandingTitle');
if (title) {
  title.textContent = `Bienvenue ${invitation.prenom || ''}, vous êtes invité à rejoindre FLAIR`;
}

const text = document.getElementById('invitationLandingText');
if (text) {
  const regionLabel = invitation.region || 'région non renseignée';
  text.textContent = `Créez votre compte avec votre email pour préparer votre rattachement à l’équipe: Région ${regionLabel}.`;
}

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
  document.getElementById('app').style.display = "none";
  document.getElementById('onboardingMetier').style.display = "none";

  const { data, error } = await supabaseClient
    .from('commerciaux')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    alert("Erreur lecture profil commercial : " + error.message);
    return;
  }

  let profil = data;

  if (!profil) {
    const { data: insertedProfil, error: insertError } = await supabaseClient
      .from('commerciaux')
      .insert([{ id: user.id, email: user.email, onboarding_done: false }])
      .select('*')
      .single();

    if (insertError) {
      alert("Erreur création profil commercial : " + insertError.message);
      return;
    }

    profil = insertedProfil;
  }

  if (!profil.onboarding_done) {
    afficherOnboardingMetier(profil);
    return;
  }

  currentProfil = profil;
  chargerProfilMetier(profil.profil_metier || 'agro_pesage');
  afficherApplication();
}

function afficherOnboardingMetier(profil = {}) {
  document.body.classList.add('onboarding-mode');
  document.body.classList.remove('cockpit-mode', 'manager-mode');

  document.getElementById('auth').style.display = "none";
  document.getElementById('app').style.display = "none";
  document.getElementById('onboardingMetier').style.display = "flex";
  
  document.getElementById('onboardingPrenom').value = profil.prenom || '';
  document.getElementById('onboardingNom').value = profil.nom || '';
  document.getElementById('onboardingSociete').value = profil.societe || '';
  document.getElementById('onboardingProfilMetier').value = profil.profil_metier || 'agro_pesage';
  document.getElementById('onboardingFonction').value = profil.fonction || 'commercial_industrie';
  document.getElementById('onboardingRegion').value = profil.region || 'grand_est';
}

function afficherApplication() {
  document.body.classList.remove('onboarding-mode', 'manager-mode');
  document.body.classList.add('cockpit-mode');

  document.getElementById('onboardingMetier').style.display = "none";
  document.getElementById('auth').style.display = "none";
  document.getElementById('app').style.display = "block";

  const prenom = currentProfil?.prenom || '';

  if (prenom) {
  const cockpitTitle = document.getElementById('cockpitWelcomeTitle');
  const managerTitle = document.getElementById('managerWelcomeTitle');

  if (cockpitTitle) cockpitTitle.textContent = `Bienvenue ${prenom}, voici vos signaux prioritaires`;
  if (managerTitle) managerTitle.textContent = `Bienvenue ${prenom}, voici votre vision manager`;
}  

  const isManager = currentProfil?.role === 'manager';

  document.querySelectorAll('[data-manager-only]').forEach(el => {
  el.style.display = isManager ? '' : 'none';
});

if (isManager) {
  afficherVue('manager');
} else {
  afficherVue('cockpit');
}

  refreshCockpit();
}

async function sauvegarderOnboardingMetier() {
  const prenom = document.getElementById('onboardingPrenom').value.trim();
  const nom = document.getElementById('onboardingNom').value.trim();
  const societe = document.getElementById('onboardingSociete').value.trim();
  const profil_metier = document.getElementById('onboardingProfilMetier').value;
  const fonction = document.getElementById('onboardingFonction').value;
  const role = [
  'manager_commercial',
  'responsable_grands_comptes',
  'direction_commerciale'
].includes(fonction) ? 'manager' : 'commercial';
  const region = document.getElementById('onboardingRegion').value;

  if (!prenom) {
  alert("Merci d’indiquer votre prénom.");
  return;
}

  if (!nom) {
  alert("Merci d’indiquer votre nom.");
  return;
}

  if (!societe) {
  alert("Merci d’indiquer votre société.");
  return;
}

  const { error } = await supabaseClient
    .from('commerciaux')
    .update({
      prenom,
      nom,
      societe,
      profil_metier,
      fonction,
      region,
      role,
      onboarding_done: true
    })
    .eq('id', user.id);

  if (error) {
    alert("Erreur sauvegarde profil métier : " + error.message);
    return;
  }

  currentProfil = {
  prenom,
  nom,
  societe,
  profil_metier,
  fonction,
  region,
  role,  
  onboarding_done: true
};

  chargerProfilMetier(profil_metier);
  afficherApplication();
}

function chargerProfilMetier(profilMetier) {
  window.FLairProfilMetier = profilMetier;

  console.log("Profil métier FLAIR chargé :", profilMetier);

  // Préparation future :
  // agro_pesage        -> scoring/agro_pesage.js
  // agro_detection     -> scoring/agro_detection.js
  // agro_vision        -> scoring/agro_vision.js
  // agro_packaging     -> scoring/agro_packaging.js
  // chimie_logistique  -> scoring/chimie_logistique.js
}

 // =========================
// HELPERS AFFICHAGE
// =========================


async function afficherVue(vue) {
  const cockpitView = document.getElementById('cockpitView');
  const managerView = document.getElementById('managerView');
  const invitationsView = document.getElementById('invitationsView');
  const btnCockpit = document.getElementById('btnCockpit');
  const btnManager = document.getElementById('btnManager');

  if (!cockpitView || !managerView) return;

  const isManagerView = vue === 'manager';
  const isInvitationsView = vue === 'invitations';
  const isCockpitView = !isManagerView && !isInvitationsView;

  cockpitView.style.display = isCockpitView ? 'block' : 'none';
  managerView.style.display = isManagerView ? 'grid' : 'none';
  if (invitationsView) invitationsView.style.display = isInvitationsView ? 'grid' : 'none';

  btnCockpit?.classList.toggle('active', isCockpitView);
  btnManager?.classList.toggle('active', isManagerView);

  document.querySelectorAll('[data-view-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.viewBtn === vue);
  });

  document.body.classList.toggle('manager-mode', !isCockpitView);
  document.body.classList.toggle('cockpit-mode', isCockpitView);

  if (isManagerView) {
    await chargerDashboardManager();
  }

  if (isInvitationsView) {
    await chargerInvitations();
  }
}

async function refreshCockpit() {
  await chargerSignaux();
  await chargerTop3();
  await chargerAContacter();
  await chargerHistorique();
  await chargerStats();
}

function appliquerFiltreCommercial(query) {
  if (!user?.id) return query;
  return query.eq('commercial_id', user.id);
}

async function garantirContexteSignal() {
  if (!user?.id) {
    alert("Tu dois être connecté.");
    return null;
  }

  let profil = currentProfil;

  if (!profil?.id || profil.id !== user.id || profil.team_id === undefined) {
    const { data, error } = await supabaseClient
      .from('commerciaux')
      .select('id, email, prenom, nom, role, team_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      alert("Erreur lecture profil commercial : " + error.message);
      return null;
    }

    if (!data) {
      alert("Profil commercial introuvable.");
      return null;
    }

    profil = data;
    currentProfil = { ...currentProfil, ...data };
  }

  if (!profil.team_id) {
    alert("Aucune équipe n'est rattachée à ce profil. Impossible de créer un signal sécurisé.");
    return null;
  }

  return {
    commercial_id: user.id,
    team_id: profil.team_id
  };
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
      ${s.feedback_commercial ? `<small><b>Feedback :</b> ${formatFeedback(s.feedback_commercial)}</small><br>` : ''}

      ${showButtons ? `<div style="margin-top:8px;">${showButtons}</div>` : ''}
    </div>
    <hr>
  `;
}

function boutonsSignalActif(s) {
  const feedback = s.statut === 'traite' ? boutonsFeedback(s) : '';

  return `
    <button onclick="changerStatut('${s.id}', 'a_contacter')">📌 À contacter</button>
    <button onclick="changerStatut('${s.id}', 'traite')">✅ Traité / feedback</button>
    <button onclick="changerStatut('${s.id}', 'ignore')">❌ Ignorer</button>
    ${feedback}
  `;
}

function boutonsAContacter(s) {
  return `
    <button onclick="changerStatut('${s.id}', 'traite')">✅ Traité / feedback</button>
    <button onclick="changerStatut('${s.id}', 'ignore')">❌ Ignorer</button>
  `;
}

function boutonsFeedback(s) {
  return `
    <button onclick="enregistrerFeedback('${s.id}', 'interet_confirme')">✅ Confirmé</button>
    <button onclick="enregistrerFeedback('${s.id}', 'interet_non_confirme')">❌ Non confirmé</button>
    <button onclick="enregistrerFeedback('${s.id}', 'a_requalifier')">⏳ Requalifier</button>
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

  let query = appliquerFiltreCommercial(
   supabaseClient
      .from('signaux')
      .select('*')
      .not('statut', 'in', '("a_contacter","historique")')
      .order('created_at', { ascending: false })
      .limit(20)
  );

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
  if (!container) return;

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

    let query = appliquerFiltreCommercial(
    supabaseClient
      .from('signaux')
      .select('*')
      .eq('statut', 'analyse')
  );

  const { data, error } = await query
    .order('score_pertinence', { ascending: false })
    .order('date_signal', { ascending: false, nullsFirst: false })
    .limit(3);

  if (error) {
    alert("Erreur chargement Top 3 : " + error.message);
    return;
  }

  const container = document.getElementById('top3');
  if (!container) return;

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

   let query = appliquerFiltreCommercial(
    supabaseClient
      .from('signaux')
      .select('*')
      .eq('statut', 'a_contacter')
  );

  const { data, error } = await query
    .order('score_pertinence', { ascending: false });

  if (error) {
    alert("Erreur chargement à contacter : " + error.message);
    return;
  }

  const container = document.getElementById('aContacter');
  if (!container) return;

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

    let query = appliquerFiltreCommercial(
    supabaseClient
      .from('signaux')
      .select('*')
      .eq('statut', 'historique')
  );

  const { data, error } = await query
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
      buttons: boutonsFeedback(s)
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

  const contexteSignal = await garantirContexteSignal();
  if (!contexteSignal) return;

  const { error } = await supabaseClient
    .from('signaux')
    .insert([{
     commercial_id: contexteSignal.commercial_id,
     team_id: contexteSignal.team_id,
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

    const { data: signalData, error: signalError } = await supabaseClient
      .from('signaux')
      .select('chaleur')
      .eq('id', signalId)
      .single();

    if (signalError) {
      console.error("Erreur lecture chaleur signal :", signalError);
    }

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

    if (signalData?.chaleur === 'froid') {
      updateData.relance_due_at = null;
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

  await refreshCockpit();
}

async function enregistrerFeedback(signalId, feedback) {
  const { error } = await supabaseClient
    .from('signaux')
    .update({
      feedback_commercial: feedback,
      date_derniere_action: new Date().toISOString()
    })
    .eq('id', signalId);

  if (error) {
    alert("Erreur feedback : " + error.message);
    return;
  }

  await refreshCockpit();
}

async function chargerStats() {
  try {
    const { data, error } = await supabaseClient
      .from('signaux')
      .select('statut, chaleur')
      .eq('commercial_id', user.id);

    if (error) throw error;

    const signaux = data || [];

    const actifs = signaux.filter(s =>
      !['ignore', 'a_contacter', 'historique'].includes(s.statut)
    ).length;

    const chauds = signaux.filter(s =>
      s.chaleur === 'chaud' &&
      !['ignore', 'historique'].includes(s.statut)
    ).length;

    const aContacter = signaux.filter(s =>
      s.statut === 'a_contacter'
    ).length;

    const nouveaux = signaux.filter(s =>
      s.statut === 'nouveau'
    ).length;

    const statActifs = document.getElementById('statActifs');
    const statChauds = document.getElementById('statChauds');
    const statAContacter = document.getElementById('statAContacter');
    const statNouveaux = document.getElementById('statNouveaux');

    if (statActifs) statActifs.textContent = actifs;
    if (statChauds) statChauds.textContent = chauds;
    if (statAContacter) statAContacter.textContent = aContacter;
    if (statNouveaux) statNouveaux.textContent = nouveaux;

  } catch (err) {
    console.error('Erreur chargement statistiques :', err);
  }
}

// =========================
// DASHBOARD PRO MANAGER
// =========================

function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSignalDate(s) {
  return s.date_signal || s.created_at || null;
}

function getManagerDateKey(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay() === 0 ? 6 : d.getDay() - 1;
}

function renderMiniSparkline(values) {
  const max = Math.max(...values, 1);
  return values.map(v => {
    const height = Math.max(6, Math.round((v / max) * 26));
    return `<span style="height:${height}px" title="${v}"></span>`;
  }).join('');
}

function managerLabel(value, fallback = 'Non renseigné') {
  return String(value || '').trim() || fallback;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setWidth(id, value) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function normalizeManagerSource(s) {
  return managerLabel(s.type_source || s.source || s.source_nom || s.origine, 'Source non renseignée');
}

function commercialDisplayName(c) {
  return managerLabel(
    c.nom_complet ||
    [c.prenom, c.nom].filter(Boolean).join(' ') ||
    c.email,
    'Commercial'
  );
}

function renderManagerRows(containerId, rows, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="manager-empty">${emptyText}</div>`;
    return;
  }

  container.innerHTML = rows.join('');
}

async function chargerDashboardManager() {
  if (!user) return;

  try {
    const teamId = currentProfil?.team_id;

    if (!teamId) {
      console.warn('Dashboard Manager : team_id manquant pour le profil courant.');
      return;
    }

    const startWeek = getStartOfWeek();
    const now = new Date();

    const { data, error } = await supabaseClient
      .from('signaux')
      .select('*')
      .eq('team_id', teamId)
      .gte('created_at', startWeek.toISOString())
      .lte('created_at', now.toISOString());

    if (error) throw error;

    const signaux = data || [];

    const { data: commerciauxData, error: commerciauxError } = await supabaseClient
      .from('commerciaux')
      .select('*')
      .eq('team_id', teamId);

    if (commerciauxError) {
      console.warn('Dashboard Manager : commerciaux indisponibles', commerciauxError);
    }

    const commerciaux = commerciauxData || [];
    const commerciauxMap = new Map(commerciaux.map(c => [c.id, commercialDisplayName(c)]));

    const teamNameEl = document.getElementById('managerTeamName');
    const teamCountEl = document.getElementById('managerTeamCount');
    const teamMembersEl = document.getElementById('managerTeamMembers');

    if (teamNameEl) {
      teamNameEl.textContent = currentProfil?.societe
        ? `Équipe ${currentProfil.societe}`
        : 'Équipe commerciale';
    }

    const commerciauxEquipe = commerciaux.filter(c => c.role !== 'manager');

    if (teamCountEl) {
      teamCountEl.textContent = `${commerciauxEquipe.length} commercial${commerciauxEquipe.length > 1 ? 'aux' : ''}`;
    }

    if (teamMembersEl) {
      if (!commerciauxEquipe.length) {
        teamMembersEl.innerHTML = '<small>Aucun commercial rattaché</small>';
      } else {
        teamMembersEl.innerHTML = commerciauxEquipe
          .map(c => `<div class="manager-team-member">• ${commercialDisplayName(c)}</div>`)
          .join('');
     }
   }

    const actifs = signaux.filter(s => !['ignore', 'historique'].includes(s.statut));
    const nouveaux = signaux.filter(s => s.statut === 'nouveau');
    const leadsChauds = signaux.filter(s => s.chaleur === 'chaud');
    const aContacter = signaux.filter(s => s.statut === 'a_contacter');
    const leadsTraites = signaux.filter(s => s.statut === 'traite' || s.statut === 'historique' || s.date_traitement);

    const relancesRetard = signaux.filter(s => {
      if (!s.relance_due_at) return false;
      if (['historique', 'ignore'].includes(s.statut)) return false;
      return new Date(s.relance_due_at) < now;
    });

    const confirmes = signaux.filter(s => s.feedback_commercial === 'interet_confirme');
    const nonConfirmes = signaux.filter(s => s.feedback_commercial === 'interet_non_confirme');
    const requalifier = signaux.filter(s => s.feedback_commercial === 'a_requalifier');
    const totalFeedback = confirmes.length + nonConfirmes.length + requalifier.length;
    const tauxConfirmation = totalFeedback > 0 ? Math.round((confirmes.length / totalFeedback) * 100) : 0;

    setText('mgrSignauxActifs', actifs.length);
    setText('mgrNouveauxSignaux', nouveaux.length);
    setText('mgrLeadsChauds', leadsChauds.length);
    setText('mgrAContacter', aContacter.length);
    setText('mgrRelancesRetardKpi', relancesRetard.length);
    setText('mgrRelancesRetardInfo', relancesRetard.length ? 'Action manager' : 'Situation maîtrisée');

    const dailyActifs = [0, 0, 0, 0, 0, 0, 0];
    const dailyNouveaux = [0, 0, 0, 0, 0, 0, 0];
    const dailyChauds = [0, 0, 0, 0, 0, 0, 0];
    const dailyAContacter = [0, 0, 0, 0, 0, 0, 0];
    const dailyRelances = [0, 0, 0, 0, 0, 0, 0];

    signaux.forEach(s => {
      const index = getManagerDateKey(getSignalDate(s));
      if (index === null) return;
      dailyActifs[index]++;
      if (s.statut === 'nouveau') dailyNouveaux[index]++;
      if (s.chaleur === 'chaud') dailyChauds[index]++;
      if (s.statut === 'a_contacter') dailyAContacter[index]++;
    });

    relancesRetard.forEach(s => {
      const index = getManagerDateKey(s.relance_due_at);
      if (index !== null) dailyRelances[index]++;
    });

    const sparkActifs = document.getElementById('mgrSparklineActifs');
    const sparkNouveaux = document.getElementById('mgrSparklineNouveaux');
    const sparkChauds = document.getElementById('mgrSparklineChauds');
    const sparkAContacter = document.getElementById('mgrSparklineAContacter');
    const sparkRelances = document.getElementById('mgrSparklineRelances');

    if (sparkActifs) sparkActifs.innerHTML = renderMiniSparkline(dailyActifs);
    if (sparkNouveaux) sparkNouveaux.innerHTML = renderMiniSparkline(dailyNouveaux);
    if (sparkChauds) sparkChauds.innerHTML = renderMiniSparkline(dailyChauds);
    if (sparkAContacter) sparkAContacter.innerHTML = renderMiniSparkline(dailyAContacter);
    if (sparkRelances) sparkRelances.innerHTML = renderMiniSparkline(dailyRelances);

    setText('mgrConfirmes', confirmes.length);
    setText('mgrNonConfirmes', nonConfirmes.length);
    setText('mgrRequalifier', requalifier.length);
    setText('mgrTotalFeedback', totalFeedback);
    setText('mgrTauxConfirmation', `${tauxConfirmation}%`);
    setText('mgrTauxConfirmationDetail', `${confirmes.length} confirmé(s) / ${totalFeedback} feedback(s)`);
    setText('mgrQualityBadge', `${totalFeedback} feedback${totalFeedback > 1 ? 's' : ''}`);
    setWidth('mgrTauxConfirmationBar', tauxConfirmation);

    const pctConfirmes = totalFeedback ? (confirmes.length / totalFeedback) * 100 : 0;
    const pctRequalifier = totalFeedback ? (requalifier.length / totalFeedback) * 100 : 0;
    const pctNonConfirmes = totalFeedback ? (nonConfirmes.length / totalFeedback) * 100 : 0;

    const donutConfirmes = document.getElementById('donutConfirmes');
    const donutRequalifier = document.getElementById('donutRequalifier');
    const donutNonConfirmes = document.getElementById('donutNonConfirmes');

    if (donutConfirmes && donutRequalifier && donutNonConfirmes) {
      donutConfirmes.setAttribute('stroke-dasharray', `${pctConfirmes} 100`);
      donutConfirmes.setAttribute('stroke-dashoffset', '0');

      donutRequalifier.setAttribute('stroke-dasharray', `${pctRequalifier} 100`);
      donutRequalifier.setAttribute('stroke-dashoffset', `-${pctConfirmes}`);

      donutNonConfirmes.setAttribute('stroke-dasharray', `${pctNonConfirmes} 100`);
      donutNonConfirmes.setAttribute('stroke-dashoffset', `-${pctConfirmes + pctRequalifier}`);
    }

    const activityByCommercial = new Map();
    signaux.forEach(s => {
      const commercialId = s.assigne_a || s.commercial_id || 'non_assigne';
      const current = activityByCommercial.get(commercialId) || {
        label: commerciauxMap.get(commercialId) || (commercialId === 'non_assigne' ? 'Non assigné' : 'Commercial'),
        total: 0,
        chauds: 0,
        traites: 0,
        confirmes: 0,
        feedbacks: 0
      };
      current.total++;
      if (s.chaleur === 'chaud') current.chauds++;
      if (s.statut === 'traite' || s.statut === 'historique' || s.date_traitement) current.traites++;
      if (s.feedback_commercial) current.feedbacks++;
      if (s.feedback_commercial === 'interet_confirme') current.confirmes++;
      activityByCommercial.set(commercialId, current);
    });

    const maxActivity = Math.max(...Array.from(activityByCommercial.values()).map(x => x.total), 1);
    const activityRows = Array.from(activityByCommercial.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(item => {
        const rate = item.feedbacks ? Math.round((item.confirmes / item.feedbacks) * 100) : 0;
        const width = Math.round((item.total / maxActivity) * 100);
        return `
          <div class="manager-row">
            <div>
              <div class="manager-row-title">${item.label}</div>
              <div class="manager-row-sub">${item.total} signaux · ${item.chauds} chaud(s) · ${item.traites} traité(s)</div>
              <div class="manager-progress"><i style="width:${width}%"></i></div>
            </div>
            <div class="manager-row-score">${rate}%</div>
          </div>`;
      });

    renderManagerRows('mgrActiviteCommerciaux', activityRows, 'Aucune activité équipe sur la période.');

    const sourcesMap = new Map();
    signaux.forEach(s => {
      const source = normalizeManagerSource(s);
      const current = sourcesMap.get(source) || { total: 0, confirmes: 0, feedbacks: 0 };
      current.total++;
      if (s.feedback_commercial) current.feedbacks++;
      if (s.feedback_commercial === 'interet_confirme') current.confirmes++;
      sourcesMap.set(source, current);
    });

    const maxSource = Math.max(...Array.from(sourcesMap.values()).map(x => x.total), 1);
    const sourceRows = Array.from(sourcesMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([source, item]) => {
        const width = Math.round((item.total / maxSource) * 100);
        const rate = item.feedbacks ? Math.round((item.confirmes / item.feedbacks) * 100) : 0;
        return `
          <div class="manager-source-row">
            <div>
              <div class="manager-source-title">${source}</div>
              <div class="manager-source-sub">${item.total} signal(aux) · ${rate}% confirmés</div>
              <div class="manager-progress"><i style="width:${width}%"></i></div>
            </div>
            <div class="manager-row-score">${item.total}</div>
          </div>`;
      });

    renderManagerRows('mgrSources', sourceRows, 'Aucune source exploitable sur la période.');

    const relanceRows = relancesRetard
      .sort((a, b) => new Date(a.relance_due_at) - new Date(b.relance_due_at))
      .slice(0, 5)
      .map(s => {
        const retardJours = Math.max(1, Math.ceil((now - new Date(s.relance_due_at)) / (1000 * 60 * 60 * 24)));
        return `
          <div class="manager-relance-row">
            <div>
              <div class="manager-relance-title">${managerLabel(s.titre, 'Signal sans titre')}</div>
              <div class="manager-relance-sub">${managerLabel(s.entreprise_nom, 'Entreprise non renseignée')}</div>
            </div>
            <div class="manager-delay">${retardJours} j</div>
          </div>`;
      });

    setText('mgrRelancesBadge', relancesRetard.length);
    renderManagerRows('mgrRelances', relanceRows, 'Aucune relance en retard.');

  } catch (err) {
    console.error('Erreur Dashboard Manager :', err);
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

function formatFeedback(feedback) {
  if (feedback === 'interet_confirme') {
    return '✅ Intérêt confirmé';
  }

  if (feedback === 'interet_non_confirme') {
    return '❌ Intérêt non confirmé';
  }

  if (feedback === 'a_requalifier') {
    return '⏳ À requalifier plus tard';
  }

  return feedback || '';
}

function scoringLocal(titre, entreprise) {
  const texte = `${titre || ''} ${entreprise || ''}`.toLowerCase();

  let score = 30;
  let type_signal = 'autre';
  let raison_score = "Signal peu qualifié.";
  let angle_commercial = "Approche découverte.";
  let action_recommandee = "Surveiller.";

  const hasAny = (mots) => mots.some(mot => texte.includes(mot));

  // =========================
  // 0. LISTES DE MOTS-CLÉS MÉTIER
  // =========================

  const intentionAchat = [
    "consultation",
    "appel d'offre",
    "appel d’offres",
    "appel offre",
    "marché public",
    "marche public",
    "boamp",
    "cahier des charges",
    "recherche fournisseur",
    "demande de prix",
    "demande de devis",
    "consultation fournisseurs",
    "benchmark équipement",
    "benchmark equipement",
    "mise en conformité",
    "mise en conformite",
    "remplacement",
    "renouvellement équipement",
    "renouvellement equipement"
  ];

  const projetInvestissement = [
    "investissement",
    "millions",
    "projet",
    "construction",
    "nouveau",
    "nouvelle usine",
    "nouveau projet",
    "usine",
    "ultramoderne",
    "modernisation",
    "extension",
    "agrandissement",
    "nouveau site",
    "augmentation capacité",
    "augmentation capacite",
    "augmentation production",
    "montée en cadence",
    "montee en cadence",
    "atelier",
    "site de production",
    "investissement industriel",
    "modernisation usine"
  ];

  const recrutementIndustriel = [
    "recrutement",
    "embauche",
    "directeur de production",
    "directeur production",
    "responsable production",
    "responsable maintenance",
    "responsable qualité",
    "responsable qualite",
    "technicien maintenance",
    "ingénieur process",
    "ingenieur process",
    "travaux neufs",
    "responsable industrialisation",
    "responsable amélioration continue",
    "responsable amelioration continue"
  ];

  const qualiteCorpsEtrangers = [
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
    "détecteur de métaux",
    "detecteur de metaux",
    "rayon x",
    "xray",
    "contamination",
    "urgence",
    "non conformité",
    "non conformite",
    "incident qualité",
    "incident qualite",
    "sécurité alimentaire",
    "securite alimentaire",
    "audit ifs",
    "audit brc"
  ];

  const pesageControle = [
    "pesage",
    "contrôle poids",
    "controle poids",
    "contrôle pondéral",
    "controle ponderal",
    "trieuse pondérale",
    "trieuse ponderale",
    "checkweigher",
    "peseuse",
    "pesage dynamique",
    "balance industrielle",
    "poids prix",
    "étiquetage",
    "etiquetage",
    "traçabilité",
    "tracabilite"
  ];

  const ligneConditionnement = [
    "ligne",
    "nouvelles lignes",
    "nouvelle ligne",
    "ligne automatisée",
    "ligne automatisee",
    "ligne de conditionnement",
    "fabrication",
    "conditionnement",
    "emballage",
    "découpe",
    "decoupe",
    "ensachage",
    "tranchage",
    "thermoformage",
    "mise en barquette",
    "fin de ligne",
    "palettisation"
  ];

  const secteurAgro = [
    "abattoir",
    "viande",
    "volaille",
    "salaison",
    "charcuterie",
    "fromage",
    "laiterie",
    "fruits",
    "légumes",
    "legumes",
    "traiteur",
    "plats cuisinés",
    "plats cuisines",
    "conserverie",
    "boulangerie",
    "pâtisserie",
    "patisserie"
  ];

  // =========================
  // 1. INTENTION D'ACHAT / APPEL D'OFFRE
  // =========================

  if (hasAny(intentionAchat)) {
    score += 25;
    type_signal = 'appel_offre';
    raison_score = "Intention d'achat détectée : consultation, appel d'offre, demande de prix ou recherche fournisseur.";
    angle_commercial = "Approche rapide avec proposition de solution adaptée.";
    action_recommandee = "Identifier le décideur et prendre contact rapidement.";
  }

  // =========================
  // 2. MOTS CLÉS FORTS — INVESTISSEMENT / PROJET
  // =========================

  if (hasAny(projetInvestissement)) {
    score += 25;
    type_signal = type_signal === 'autre' ? 'investissement' : type_signal;
    raison_score += " Projet industriel détecté : investissement, construction, modernisation, extension ou nouvelle usine.";
  }

  // =========================
  // 3. RECRUTEMENT INDUSTRIEL
  // =========================

  if (hasAny(recrutementIndustriel)) {
    score += 18;
    type_signal = type_signal === 'autre' ? 'recrutement' : type_signal;
    raison_score += " Recrutement industriel pouvant révéler une évolution d'organisation, une montée en charge ou un projet de ligne.";
  }

  if (
    texte.includes("directeur") ||
    texte.includes("responsable")
  ) {
    score += 5;
  }

  // =========================
  // 4. RAPPEL CONSO / QUALITÉ / CORPS ÉTRANGERS
  // =========================

  if (hasAny(qualiteCorpsEtrangers)) {
    score += 35;
    type_signal = 'qualite_rappel_conso';
    raison_score = "Contexte qualité sensible détecté : rappel conso, contamination, corps étranger ou sécurité alimentaire.";
    angle_commercial = "Approche conseil qualité et sécurisation de ligne.";
    action_recommandee = "Identifier responsable qualité ou maintenance et proposer un échange rapide.";
  }

  // =========================
  // 5. PESAGE / CONTRÔLE POIDS / ÉTIQUETAGE
  // =========================

  if (hasAny(pesageControle)) {
    score += 25;
    type_signal = type_signal === 'autre' ? 'investissement' : type_signal;
    raison_score += " Besoin potentiel autour du pesage, contrôle poids, étiquetage ou traçabilité.";
    angle_commercial = "Positionnement pesage, contrôle poids, étiquetage et automatisation.";
    action_recommandee = "Préparer un angle pesage / contrôle poids / ligne.";
  }

  // =========================
  // 6. CAPACITÉ / PRODUCTION
  // =========================

  if (
    texte.includes("capacité") ||
    texte.includes("capacite") ||
    texte.includes("production") ||
    texte.includes("augmentation") ||
    texte.includes("cadence")
  ) {
    score += 15;
    raison_score += " Impact potentiel sur la capacité de production.";
  }

  // =========================
  // 7. LIGNE / CONDITIONNEMENT
  // =========================

  if (hasAny(ligneConditionnement)) {
    score += 20;
    type_signal = 'nouvelle_ligne';
    raison_score += " Présence de ligne, fabrication, conditionnement ou fin de ligne.";
    angle_commercial = "Projet ligne ou conditionnement : opportunité équipement.";
    action_recommandee = "Identifier production / maintenance / travaux neufs.";
  }

  // =========================
  // 8. SECTEUR AGROALIMENTAIRE
  // =========================

  if (hasAny(secteurAgro)) {
    score += 5;
    raison_score += " Secteur agroalimentaire identifié.";
  }

  // =========================
  // 9. BONUS COMBINÉS — SIGNAUX PLUS FIABLES
  // =========================

  if (hasAny(["consultation", "demande de prix", "demande de devis", "appel d'offre", "appel d’offres"]) && hasAny(pesageControle)) {
    score += 25;
    type_signal = 'appel_offre';
    raison_score += " Combinaison forte : intention d'achat + pesage / contrôle poids.";
    angle_commercial = "Opportunité directe : répondre rapidement avec une approche solution.";
    action_recommandee = "Contacter rapidement avec un message ciblé pesage / contrôle poids.";
  }

  if (
    hasAny(["rappel produit", "rappel conso", "contamination", "corps étranger", "corps etranger"]) &&
    hasAny(["métal", "metal", "verre", "plastique dur", "rayon x", "détecteur de métaux", "detecteur de metaux"])
  ) {
    score += 25;
    type_signal = 'qualite_rappel_conso';
    raison_score += " Combinaison critique : rappel ou contamination + corps étranger.";
    angle_commercial = "Approche conseil qualité, audit de ligne et sécurisation détection.";
    action_recommandee = "Priorité haute : contacter le responsable qualité.";
  }

  if (
    hasAny(["nouvelle usine", "nouveau site", "extension", "agrandissement", "usine"]) &&
    hasAny(ligneConditionnement)
  ) {
    score += 20;
    type_signal = 'nouvelle_ligne';
    raison_score += " Combinaison forte : site industriel ou extension + ligne / conditionnement.";
    angle_commercial = "Projet industriel structurant : opportunité équipement ligne.";
    action_recommandee = "Identifier travaux neufs, production ou maintenance.";
  }

  if (
    hasAny(["responsable maintenance", "technicien maintenance", "travaux neufs"]) &&
    hasAny(["ligne", "automatisée", "automatisee", "contrôle qualité", "controle qualite", "conditionnement"])
  ) {
    score += 12;
    raison_score += " Recrutement technique lié à ligne ou contrôle qualité.";
  }

  // =========================
  // 10. SUPER SIGNATURES — OPPORTUNITÉS TRÈS FORTES
  // =========================

  if (
    hasAny(["consultation", "appel d'offre", "appel d’offres", "demande de prix", "demande de devis"]) &&
    hasAny(["pesage", "contrôle poids", "controle poids", "trieuse pondérale", "trieuse ponderale", "pesage dynamique"])
  ) {
    score = Math.max(score, 88);
    type_signal = 'appel_offre';
    raison_score = "Signal très fort : consultation ou demande commerciale explicite autour du pesage / contrôle poids.";
    angle_commercial = "Approche commerciale directe et rapide.";
    action_recommandee = "Contacter en priorité avec une réponse ciblée.";
  }

  if (
    hasAny(["rappel produit", "rappel conso", "contamination", "corps étranger", "corps etranger"]) &&
    hasAny(["sécurité alimentaire", "securite alimentaire", "incident qualité", "incident qualite", "rayon x", "détecteur de métaux", "detecteur de metaux"])
  ) {
    score = Math.max(score, 90);
    type_signal = 'qualite_rappel_conso';
    raison_score = "Signal critique qualité : contexte de rappel, contamination ou sécurité alimentaire.";
    angle_commercial = "Approche conseil qualité et sécurisation de ligne.";
    action_recommandee = "Priorité haute : prise de contact rapide avec qualité / maintenance.";
  }

  // =========================
  // 11. NORMALISATION
  // =========================

  if (type_signal === 'appel_offre') {
  score = Math.min(score, 95);
} else if (type_signal === 'qualite_rappel_conso') {
  score = Math.min(score, 95);
} else {
  score = Math.min(score, 92);
}

  let chaleur = 'froid';
  if (score >= 80) chaleur = 'chaud';
  else if (score >= 60) chaleur = 'tiede';

  // =========================
  // 12. ANGLE + ACTION PAR DÉFAUT
  // =========================

  if (type_signal === 'qualite_rappel_conso') {
    angle_commercial = "Approche conseil qualité et sécurisation de ligne.";
    action_recommandee = "Identifier responsable qualité ou maintenance et proposer un échange rapide.";
    } else if (score >= 80) {
    if (angle_commercial === "Approche découverte.") {
      angle_commercial = "Projet en cours : positionnement rapide sur équipements.";
    }
    if (action_recommandee === "Surveiller.") {
      action_recommandee = "Identifier décideur production / maintenance et prendre contact rapidement.";
    }
  } else if (score >= 60) {
    if (angle_commercial === "Approche découverte.") {
      angle_commercial = "Opportunité probable à moyen terme.";
    }
    if (action_recommandee === "Surveiller.") {
      action_recommandee = "Surveiller + identifier contact.";
    }
  }

  // =========================
  // 13. RETOUR STANDARD FLAIR
  // =========================

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
    let query = appliquerFiltreCommercial(
    supabaseClient
      .from('signaux')
      .select('*')
      .eq('statut', 'nouveau')
  );

  const { data, error } = await query;

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
// INVITATIONS MANAGER
// =========================

function invitationStatusLabel(statut) {
  if (statut === 'acceptee') return 'Acceptée';
  if (statut === 'expiree') return 'Expirée';
  return 'En attente';
}

function formatManagerDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('fr-FR');
  } catch (err) {
    return '—';
  }
}
function construireLienInvitation(token) {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?invitation=${token}`;
}

async function copierLienInvitation(token) {
  const lien = construireLienInvitation(token);

  try {
    await navigator.clipboard.writeText(lien);
    alert("Lien d’invitation copié.");
  } catch (err) {
    prompt("Copie ce lien d’invitation :", lien);
  }
}


async function chargerInvitations() {
  if (!user || currentProfil?.role !== 'manager') return;

  const teamId = currentProfil?.team_id;
  if (!teamId) {
    alert("Aucune équipe n'est rattachée à ce profil manager.");
    return;
  }

  const teamName = currentProfil?.societe ? `Équipe ${currentProfil.societe}` : 'Équipe commerciale';
  setText('inviteTeamName', teamName);

  const { data: invitationsData, error: invitationsError } = await supabaseClient
    .from('invitations')
    .select('*')
    .order('created_at', { ascending: false });

  if (invitationsError) {
    alert("Erreur chargement invitations : " + invitationsError.message);
    return;
  }

  const { data: commerciauxData, error: commerciauxError } = await supabaseClient
    .from('commerciaux')
    .select('*')
    .eq('team_id', teamId);

  if (commerciauxError) {
    alert("Erreur chargement équipe : " + commerciauxError.message);
    return;
  }

  const invitations = invitationsData || [];
  const commerciaux = (commerciauxData || []).filter(c => c.role !== 'manager');

  setText('invitePendingCount', `${invitations.length} invitation${invitations.length > 1 ? 's' : ''}`);
  setText('inviteMembersCount', `${commerciaux.length} membre${commerciaux.length > 1 ? 's' : ''}`);

  const invitationsContainer = document.getElementById('invitePendingList');
  if (invitationsContainer) {
    if (!invitations.length) {
      invitationsContainer.innerHTML = '<div class="manager-empty">Aucune invitation en attente.</div>';
    } else {

  invitationsContainer.innerHTML = invitations.map(invitation => {
  const lienInvitation = construireLienInvitation(invitation.token);

  return `
    <div class="invite-row invite-row-with-link">

      <div>
        <strong>
          ${managerLabel(
            [invitation.prenom, invitation.nom].filter(Boolean).join(' '),
            invitation.email
          )}
        </strong>

        <small>${invitation.email}</small>
      </div>

      <div>
        <span class="invite-status">
          ${invitationStatusLabel(invitation.statut)}
        </span>

        <small>
          ${formatManagerDateTime(invitation.created_at)}
        </small>
      </div>

      <button
        class="invite-icon-btn"
        title="Copier le lien"
        onclick="copierLienInvitation('${invitation.token}')">
        ⧉
      </button>

      <button
        class="invite-icon-btn danger"
        title="Supprimer l'invitation"
        onclick="supprimerInvitation('${invitation.id}')">
        ×
      </button>

      <div class="invite-copy-link">
        <span>Lien d’invitation</span>

        <input
          value="${lienInvitation}"
          readonly />
      </div>

    </div>
  `;
}).join('');
    }
  }
         
  const membersContainer = document.getElementById('inviteMembersList');
  if (membersContainer) {
    if (!commerciaux.length) {
      membersContainer.innerHTML = '<div class="manager-empty">Aucun commercial rattaché pour le moment.</div>';
    } else {
      membersContainer.innerHTML = commerciaux.map(commercial => `
        <div class="invite-row invite-member-row">
          <div>
            <strong>${commercialDisplayName(commercial)}</strong>
            <small>${commercial.email || 'Email non renseigné'}</small>
          </div>
          <div>
            <span class="invite-status active">Actif</span>
            <small>${managerLabel(commercial.region, 'Région non renseignée')}</small>
          </div>
        </div>
      `).join('');
    }
  }
}

async function envoyerInvitation() {
  if (!user || currentProfil?.role !== 'manager') {
    alert("Seul un manager peut inviter un commercial.");
    return;
  }

  const teamId = currentProfil?.team_id;
  if (!teamId) {
    alert("Aucune équipe n'est rattachée à ce profil manager.");
    return;
  }

  const email = document.getElementById('inviteEmail')?.value.trim().toLowerCase();
  const prenom = document.getElementById('invitePrenom')?.value.trim();
  const nom = document.getElementById('inviteNom')?.value.trim();
  const fonction = document.getElementById('inviteFonction')?.value || 'commercial_industrie';
  const region = document.getElementById('inviteRegion')?.value || currentProfil?.region || '';

  if (!email) {
    alert("Merci d’indiquer l’email du commercial à inviter.");
    return;
  }

  const { error } = await supabaseClient
    .from('invitations')
    .insert([{
      team_id: teamId,
      manager_id: user.id,
      email,
      prenom,
      nom,
      fonction,
      region,
      statut: 'en_attente'
    }]);

  if (error) {
    alert("Erreur invitation : " + error.message);
    return;
  }

  ['inviteEmail', 'invitePrenom', 'inviteNom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  await chargerInvitations();
  alert("Invitation enregistrée. Le lien copiable est maintenant disponible.");
}

async function supprimerInvitation(invitationId) {
  if (!invitationId) return;

  const confirmation = confirm("Supprimer cette invitation ?");
  if (!confirmation) return;

  const { error } = await supabaseClient
    .from('invitations')
    .delete()
    .eq('id', invitationId);

  if (error) {
    alert("Erreur suppression invitation : " + error.message);
    return;
  }

  await chargerInvitations();
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
window.enregistrerFeedback = enregistrerFeedback;
window.afficherVue = afficherVue;
window.envoyerInvitation = envoyerInvitation;
window.supprimerInvitation = supprimerInvitation;
window.copierLienInvitation = copierLienInvitation;

// =========================
// SESSION AUTO AU CHARGEMENT
// =========================

(async function initFlair() {
  await chargerInvitationDepuisUrl();

  if (invitationCourante) {
    return;
  }

  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    user = data.session.user;
    initUser();
  }
})();
