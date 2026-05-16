const SUPABASE_URL = "https://viafuquomtshuzuldwpq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpYWZ1cXVvbXRzaHV6dWxkd3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTkyODUsImV4cCI6MjA5MzQ3NTI4NX0.KtUZPsG04HF0AtdTCwYLyaH8IFBI2BBELIageV2xiM8";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null;

// =========================
// DOCTRINE MÉTIER FLAIR
// =========================
// FLAIR détecte, score, priorise et déclenche l'action.
// Le CRM gère ensuite la relation commerciale.
// Objectif : feedback ultra rapide, sans logique CRM.
// Feedback autorisé : interet_confirme, interet_non_confirme, a_requalifier.

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

  document.body.classList.add('cockpit-mode');
  document.body.classList.remove('manager-mode');

  await refreshCockpit();
}

// =========================
// HELPERS AFFICHAGE
// =========================


async function afficherVue(vue) {
  const cockpitView = document.getElementById('cockpitView');
  const managerView = document.getElementById('managerView');
  const btnCockpit = document.getElementById('btnCockpit');
  const btnManager = document.getElementById('btnManager');

  if (!cockpitView || !managerView) return;

  const isManager = vue === 'manager';

  cockpitView.style.display = isManager ? 'none' : 'block';
  managerView.style.display = isManager ? 'grid' : 'none';

  btnCockpit?.classList.toggle('active', !isManager);
  btnManager?.classList.toggle('active', isManager);
  document.body.classList.toggle('manager-mode', isManager);
  document.body.classList.toggle('cockpit-mode', !isManager);

  if (isManager) {
    await chargerDashboardManager();
  }
}

async function refreshCockpit() {
  await chargerSignaux();
  await chargerTop3();
  await chargerAContacter();
  await chargerHistorique();
  await chargerStats();
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
      .select('statut, chaleur');

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
    const startWeek = getStartOfWeek();
    const now = new Date();

    const { data, error } = await supabaseClient
      .from('signaux')
      .select('*')
      .gte('created_at', startWeek.toISOString())
      .lte('created_at', now.toISOString());

    if (error) throw error;

    const signaux = data || [];

    const { data: commerciauxData, error: commerciauxError } = await supabaseClient
      .from('commerciaux')
      .select('*');

    if (commerciauxError) {
      console.warn('Dashboard Manager : commerciaux indisponibles', commerciauxError);
    }

    const commerciaux = commerciauxData || [];
    const commerciauxMap = new Map(commerciaux.map(c => [c.id, commercialDisplayName(c)]));

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
window.enregistrerFeedback = enregistrerFeedback;
window.afficherVue = afficherVue;

// =========================
// SESSION AUTO AU CHARGEMENT
// =========================

supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    user = data.session.user;
    initUser();
  }
});
