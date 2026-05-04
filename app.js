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

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

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
    console.error("Erreur lecture commercial :", error);
    alert("Erreur lecture profil commercial : " + error.message);
    return;
  }

  if (!data) {
    const { error: insertError } = await supabaseClient
      .from('commerciaux')
      .insert([
        {
          id: user.id,
          email: user.email
        }
      ]);

    if (insertError) {
      console.error("Erreur création commercial :", insertError);
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
    console.error("Erreur chargement signaux :", error);
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
// =========================
// EXPOSER LES FONCTIONS AUX BOUTONS HTML
// =========================

window.signUp = signUp;
window.signIn = signIn;
window.logout = logout;
window.chargerSignaux = chargerSignaux;
window.ajouterSignal = ajouterSignal;

// =========================
// SESSION AUTO AU CHARGEMENT
// =========================

supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    user = data.session.user;
    initUser();
  }
});
