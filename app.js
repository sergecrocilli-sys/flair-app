const SUPABASE_URL = "https://viafuquomtshuzuldwpq.supabase.co";
const SUPABASE_ANON_KEY = "TA_CLE_ANON_ICI";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Charger les signaux
async function chargerSignaux() {
  const { data, error } = await supabase
    .from('signaux')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  const container = document.getElementById('signaux');
  container.innerHTML = "";

  data.forEach(s => {
    const div = document.createElement('div');
    div.innerHTML = `
      <b>${s.titre}</b><br>
      ${s.entreprise_nom || ''}<br>
      Score: ${s.score_pertinence || '-'}<br>
      <hr>
    `;
    container.appendChild(div);
  });
}

// Ajouter un signal
async function ajouterSignal() {
  const titre = document.getElementById('titre').value;
  const entreprise = document.getElementById('entreprise').value;

  const { error } = await supabase
    .from('signaux')
    .insert([
      {
        titre: titre,
        entreprise_nom: entreprise,
        statut: 'nouveau'
      }
    ]);

  if (error) {
    console.error(error);
    alert("Erreur insertion");
    return;
  }

  chargerSignaux();
}

// Chargement initial
chargerSignaux();
