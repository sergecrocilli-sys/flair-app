const SUPABASE_URL = "https://viafuquomtshuzuldwpq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpYWZ1cXVvbXRzaHV6dWxkd3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTkyODUsImV4cCI6MjA5MzQ3NTI4NX0.KtUZPsG04HF0AtdTCwYLyaH8IFBI2BBELIageV2xiM8";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function chargerSignaux() {
  const { data, error } = await supabaseClient
    .from('signaux')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

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
      <b>${s.titre}</b><br>
      ${s.entreprise_nom || ''}<br>
      Score : ${s.score_pertinence || '-'}<br>
      Statut : ${s.statut || '-'}<br>
      <hr>
    `;
    container.appendChild(div);
  });
}

async function ajouterSignal() {
  const titre = document.getElementById('titre').value.trim();
  const entreprise = document.getElementById('entreprise').value.trim();

  if (!titre) {
    alert("Merci de saisir un titre.");
    return;
  }

  const { error } = await supabaseClient
    .from('signaux')
    .insert([
      {
        titre: titre,
        entreprise_nom: entreprise,
        statut: 'nouveau',
        type_source: 'manuel'
      }
    ]);

  if (error) {
    console.error("Erreur insertion :", error);
    alert("Erreur insertion : " + error.message);
    return;
  }

  document.getElementById('titre').value = "";
  document.getElementById('entreprise').value = "";

  await chargerSignaux();
}

window.chargerSignaux = chargerSignaux;
window.ajouterSignal = ajouterSignal;

chargerSignaux();
