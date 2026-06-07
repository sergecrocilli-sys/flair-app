
async function resetPassword() {
  const email = document.getElementById('email').value.trim();
  if (!email) {
    alert('Veuillez saisir votre email avant de réinitialiser le mot de passe.');
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  if (error) {
    alert('Erreur réinitialisation : ' + error.message);
    return;
  }

  alert("Un email de réinitialisation vient d’être envoyé.");
}

function togglePasswordVisibility() {
  const input = document.getElementById('password');
  const btn = document.querySelector('.toggle-password-btn');
  if (!input) return;

  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';

  if (btn) {
    btn.classList.toggle('is-visible', isHidden);
    btn.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    btn.setAttribute('title', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  }
}
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
// Objectif : gestion de l'attention commerciale, sans logique CRM lourde.
// Feedback discret uniquement après passage en À contacter : confirme, non_confirme.
// Le CRM reste externe ; FLAIR peut seulement marquer qu'une opportunité CRM a été créée.

function getInvitationTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('invitation');
}

function normaliserEmail(email) {
  return (email || '').trim().toLowerCase();
}

function roleDepuisFonction(fonction) {
  return [
    'manager_commercial',
    'responsable_grands_comptes',
    'direction_commerciale'
  ].includes(fonction) ? 'manager' : 'commercial';
}

function roleDepuisInvitation(invitation) {
  if (!invitation) return null;
  return invitation.role || roleDepuisFonction(invitation.fonction || 'commercial_industrie');
}

function normaliserListeRegionsSecondaires(value) {
  if (Array.isArray(value)) {
    return value.map(v => String(v || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split(/[,;|]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function labelRegionCommerciale(value) {
  const labels = {
    grand_est: 'Grand Est',
    ile_de_france: 'Île-de-France',
    hauts_de_france: 'Hauts-de-France',
    bourgogne_franche_comte: 'Bourgogne-Franche-Comté',
    auvergne_rhone_alpes: 'Auvergne-Rhône-Alpes',
    nouvelle_aquitaine: 'Nouvelle-Aquitaine',
    occitanie: 'Occitanie',
    paca: 'PACA',
    bretagne: 'Bretagne',
    normandie: 'Normandie',
    pays_de_la_loire: 'Pays de la Loire',
    centre_val_de_loire: 'Centre-Val de Loire',
    corse: 'Corse',
    france: 'France entière'
  };

  return labels[value] || managerLabel(String(value || '').replaceAll('_', ' '), 'Non renseignée');
}

function labelRegionsSecondaires(value) {
  const regions = normaliserListeRegionsSecondaires(value);
  if (!regions.length) return '';
  return regions.map(labelRegionCommerciale).join(', ');
}

function labelProfilMetier(value) {
  const labels = {
    pesage: 'Pesage / étiquetage industriel',
    detection: 'Détection / contrôle qualité',
    vision: 'Vision industrielle / contrôle qualité',
    packaging: 'Packaging / films / étiquettes',
    process: 'Process agroalimentaire',
    chimie_logistique: 'Chimie / process / logistique industrielle',
    batiment_industriel: 'Bâtiment industriel',
    autre: 'Autre spécialité industrielle'
  };

  return labels[value] || managerLabel(String(value || '').replaceAll('_', ' '), 'Métier non renseigné');
}

function invitationCorrespondUtilisateur(invitation, authUser) {
  if (!invitation || !authUser?.email) return true;
  return normaliserEmail(invitation.email) === normaliserEmail(authUser.email);
}

function invitationStatutValide(statut) {
  return ['en_attente', 'acceptee', 'acceptée', 'accepte'].includes(statut);
}

async function chargerInvitationCourantePourUtilisateur(authUser) {
  const invitationEmail = await recupererInvitationUtilisateurParEmail(authUser);

  if (
    invitationEmail &&
    invitationStatutValide(invitationEmail.statut) &&
    invitationCorrespondUtilisateur(invitationEmail, authUser)
  ) {
    invitationCourante = invitationEmail;
  }

  return invitationCourante;
}

function construirePayloadInvitation(invitation) {
  if (!invitation) return {};

  const payload = {};

  if (invitation.team_id) payload.team_id = invitation.team_id;
  if (invitation.team_nom) payload.societe = invitation.team_nom;
  if (invitation.region) payload.region = invitation.region;
  if (invitation.regions_secondaires) payload.regions_secondaires = normaliserListeRegionsSecondaires(invitation.regions_secondaires);
  if (invitation.profil_metier) payload.profil_metier = invitation.profil_metier;
  if (invitation.prenom) payload.prenom = invitation.prenom;
  if (invitation.nom) payload.nom = invitation.nom;
  if (invitation.fonction) payload.fonction = invitation.fonction;

  const role = roleDepuisInvitation(invitation);
  if (role) payload.role = role;

  return payload;
}

async function completerInvitationDepuisTable(invitation, token) {
  if (!token) return invitation;
  if (invitation?.id && invitation?.team_id && invitation?.region) {
    return { ...invitation, token: invitation.token || token };
  }

  const { data, error } = await supabaseClient
    .from('invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.warn('Complément invitation indisponible :', error.message);
    return { ...(invitation || {}), token };
  }

  return { ...(invitation || {}), ...(data || {}), token };
}

async function enrichirInvitationAvecEquipe(invitation) {
  if (!invitation?.team_id) return invitation;

  const { data, error } = await supabaseClient
    .from('teams')
    .select('id, nom')
    .eq('id', invitation.team_id)
    .maybeSingle();

  if (error) {
    console.warn('Nom équipe invitation indisponible :', error.message);
    return invitation;
  }

  return {
    ...invitation,
    team_nom: data?.nom || invitation.team_nom || ''
  };
}

async function recupererInvitationUtilisateurParEmail(authUser) {
  const email = normaliserEmail(authUser?.email);
  if (!email) return null;

  const { data, error } = await supabaseClient
    .from('invitations')
    .select('*')
    .ilike('email', email)
    .in('statut', ['en_attente', 'acceptee', 'acceptée', 'accepte'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Invitation par email indisponible :', error.message);
    return null;
  }

  console.log("Invitation récupérée par email :", data);

  return data ? enrichirInvitationAvecEquipe(data) : null;
}
async function marquerInvitationAcceptee(invitation) {
  if (!invitation?.id) return;

  const { error } = await supabaseClient
    .from('invitations')
    .update({
      statut: 'acceptee',
      accepted_at: new Date().toISOString()
    })
    .eq('id', invitation.id);

  if (error) {
    console.warn('Invitation non marquée comme acceptée :', error.message);
  }
}

async function chargerInvitationDepuisUrl() {
  const token = getInvitationTokenFromUrl();
  if (!token) return;

  const { data, error } = await supabaseClient
    .from('invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    alert("Erreur lecture invitation : " + error.message);
    return;
  }

  if (!data) {
    alert("Invitation introuvable. Merci de demander un nouveau lien à votre manager.");
    return;
  }

  if (data.statut === 'expiree' || (data.expires_at && new Date(data.expires_at) < new Date())) {
    alert("Cette invitation a expiré. Merci de demander un nouveau lien à votre manager.");
    return;
  }

  invitationCourante = await enrichirInvitationAvecEquipe(data);

  if (data.statut === 'acceptee') {
    afficherInvitationRecue(invitationCourante);
    return;
  }

  afficherInvitationRecue(invitationCourante);
}

function afficherInvitationRecue(invitation) {
  const bloc = document.getElementById('invitationLanding');
  if (bloc) bloc.style.display = 'block';

  const emailInput = document.getElementById('email');
  if (emailInput) emailInput.value = invitation.email || '';

  const teamLabel = managerLabel(invitation.team_nom, 'votre équipe');
  const regionLabel = labelRegionCommerciale(invitation.region || '');
  const regionsSecondairesLabel = labelRegionsSecondaires(invitation.regions_secondaires);
  const profilMetierLabel = labelProfilMetier(invitation.profil_metier || '');
  const prenomLabel = invitation.prenom ? ` ${invitation.prenom}` : '';

  const title = document.getElementById('invitationLandingTitle');
  if (title) {
    title.textContent = `Bienvenue${prenomLabel}, vous rejoignez ${teamLabel}`;
  }

  const text = document.getElementById('invitationLandingText');
  if (text) {
    const metierPart = invitation.profil_metier ? ` Métier : ${profilMetierLabel}.` : '';
    text.textContent = regionsSecondairesLabel
      ? `Votre accès est préparé pour l’équipe ${teamLabel}. Métier : ${profilMetierLabel}. Région principale : ${regionLabel}. Régions secondaires : ${regionsSecondairesLabel}. Créez votre compte avec l’email invité pour finaliser le rattachement.`
      : `Votre accès est préparé pour l’équipe ${teamLabel}.${metierPart} Région principale : ${regionLabel}. Créez votre compte avec l’email invité pour finaliser le rattachement.`;
  }

  const email = document.getElementById('invitationLandingEmail');
  if (email) email.textContent = invitation.email || 'Email non renseigné';

  const region = document.getElementById('invitationLandingRegion');
  if (region) {
    const metierMeta = invitation.profil_metier ? ` · Métier ${profilMetierLabel}` : '';
    region.textContent = regionsSecondairesLabel
      ? `Équipe ${teamLabel}${metierMeta} · Région principale ${regionLabel} · Secondaires ${regionsSecondairesLabel}`
      : `Équipe ${teamLabel}${metierMeta} · Région principale ${regionLabel}`;
  }

  const meta = document.querySelector('.invitation-landing-meta');
  if (meta) meta.style.display = '';
}

// =========================
// AUTH
// =========================

async function signUp() {
  const email = normaliserEmail(document.getElementById('email').value);
  const password = document.getElementById('password').value.trim();

  if (invitationCourante && normaliserEmail(invitationCourante.email) !== email) {
    alert("Merci d'utiliser l'email associé à cette invitation.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    alert("Erreur création compte : " + error.message);
    return;
  }

  if (data?.user && data?.session) {
    user = data.user;
    await initUser();
    return;
  }

  alert("Compte créé. Vous pouvez maintenant vous connecter.");
}

async function signIn() {
  const email = normaliserEmail(document.getElementById('email').value);
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

  if (invitationCourante && !invitationCorrespondUtilisateur(invitationCourante, user)) {
    alert("Cette invitation est associée à un autre email.");
    await supabaseClient.auth.signOut();
    document.getElementById('auth').style.display = "block";
    return;
  }

  let profil = data;

  if (!invitationCourante) {
    await chargerInvitationCourantePourUtilisateur(user);
  }

  const payloadInvitation = construirePayloadInvitation(invitationCourante);

  // Sécurité : si le profil existe déjà en base avec un team_id, on le conserve.
  if (!payloadInvitation.team_id && profil?.team_id) {
    payloadInvitation.team_id = profil.team_id;
  }

  console.log("Invitation initUser :", invitationCourante);
  console.log("Payload invitation initUser :", payloadInvitation);

  if (!profil) {
    const { data: insertedProfil, error: insertError } = await supabaseClient
      .from('commerciaux')
      .insert([{
        id: user.id,
        email: normaliserEmail(user.email),
        onboarding_done: false,
        ...payloadInvitation
      }])
      .select('*')
      .single();

    if (insertError) {
      alert("Erreur création profil commercial : " + insertError.message);
      return;
    }

    profil = insertedProfil;
  } else if (invitationCourante && Object.keys(payloadInvitation).length) {
    const doitSynchroniserInvitation =
      (payloadInvitation.team_id && profil.team_id !== payloadInvitation.team_id) ||
      (payloadInvitation.societe && profil.societe !== payloadInvitation.societe) ||
      (payloadInvitation.region && profil.region !== payloadInvitation.region) ||
      (payloadInvitation.regions_secondaires && JSON.stringify(normaliserListeRegionsSecondaires(profil.regions_secondaires)) !== JSON.stringify(normaliserListeRegionsSecondaires(payloadInvitation.regions_secondaires))) ||
      (payloadInvitation.profil_metier && profil.profil_metier !== payloadInvitation.profil_metier) ||
      (payloadInvitation.role && profil.role !== payloadInvitation.role) ||
      (payloadInvitation.fonction && profil.fonction !== payloadInvitation.fonction);

    if (doitSynchroniserInvitation) {
      const { data: updatedProfil, error: updateError } = await supabaseClient
        .from('commerciaux')
        .update(payloadInvitation)
        .eq('id', user.id)
        .select('*')
        .single();

      if (updateError) {
        alert("Erreur rattachement équipe : " + updateError.message);
        return;
      }

      profil = updatedProfil;
    }
  }

  if (profil.onboarding_done && invitationCourante?.id) {
    await marquerInvitationAcceptee(invitationCourante);
  }

  if (!profil.onboarding_done) {
    afficherOnboardingMetier(profil);
    return;
  }

  currentProfil = await reparerEquipeManagerSiNecessaire(profil);
  chargerProfilMetier(currentProfil.profil_metier || 'pesage');
  afficherApplication();
}

function afficherOnboardingMetier(profil = {}) {
  document.body.classList.add('onboarding-mode');
  document.body.classList.remove('cockpit-mode', 'manager-mode');

  document.getElementById('auth').style.display = "none";
  document.getElementById('app').style.display = "none";
  document.getElementById('onboardingMetier').style.display = "flex";

  const invitationLanding = document.getElementById('invitationLanding');
  if (invitationLanding) invitationLanding.style.display = 'none';

  document.getElementById('onboardingPrenom').value = profil.prenom || invitationCourante?.prenom || '';
  document.getElementById('onboardingNom').value = profil.nom || invitationCourante?.nom || '';
  document.getElementById('onboardingSociete').value = profil.societe || invitationCourante?.societe || invitationCourante?.team_nom || '';
  document.getElementById('onboardingProfilMetier').value = profil.profil_metier || invitationCourante?.profil_metier || 'pesage';
  document.getElementById('onboardingFonction').value = profil.fonction || invitationCourante?.fonction || 'commercial_industrie';

  const regionValue = profil.region || invitationCourante?.region || 'grand_est';
  document.getElementById('onboardingRegion').value = regionValue;

  const onboardingText =
    document.getElementById('onboardingIntroText') ||
    document.getElementById('onboardingSubtitle') ||
    document.querySelector('[data-onboarding-intro]') ||
    document.querySelector('.onboarding-subtitle');

  if (onboardingText) {
    if (invitationCourante?.team_id || profil.team_id) {
      const teamLabel = managerLabel(invitationCourante?.team_nom || profil.societe, 'votre équipe');
      const prenomLabel = managerLabel(profil.prenom || invitationCourante?.prenom, '');
      const fonctionBrute = profil.fonction || invitationCourante?.fonction || 'commercial';
      const fonctionLabel = managerLabel(String(fonctionBrute).replaceAll('_', ' '), 'commercial');
      const profilMetierValue = profil.profil_metier || invitationCourante?.profil_metier || '';
      const profilMetierLabel = labelProfilMetier(profilMetierValue);
      const regionLabel = labelRegionCommerciale(regionValue);
      const regionsSecondairesLabel = labelRegionsSecondaires(profil.regions_secondaires || invitationCourante?.regions_secondaires);

      onboardingText.textContent =
        `Bienvenue ${prenomLabel}, vous rejoignez l’équipe ${teamLabel}. ` +
        `Votre rôle est ${fonctionLabel}, votre métier est ${profilMetierLabel} et votre région principale est préconfigurée : ${regionLabel}. ` +
        (regionsSecondairesLabel ? `Régions secondaires : ${regionsSecondairesLabel}. ` : '') +
        `Vérifiez les informations puis validez votre cockpit.`;
    } else {
      onboardingText.textContent =
        `Configurez votre environnement métier afin que FLAIR détecte les signaux les plus pertinents pour votre activité dans la région : ${labelRegionCommerciale(regionValue)}`;
    }
  }
}

function afficherApplication() {
  document.body.classList.remove('onboarding-mode', 'manager-mode');
  document.body.classList.add('cockpit-mode');

  const invitationLanding = document.getElementById('invitationLanding');
  if (invitationLanding) invitationLanding.style.display = 'none';

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

  const cockpitRegionLabel = document.getElementById('cockpitRegionLabel');
  if (cockpitRegionLabel) {
    const regionPrincipale = currentProfil?.region || '';
    const regionsSecondairesLabel = labelRegionsSecondaires(currentProfil?.regions_secondaires);
    cockpitRegionLabel.textContent = regionPrincipale
      ? `📍 Région principale : ${labelRegionCommerciale(regionPrincipale)}${regionsSecondairesLabel ? ` · Secondaires : ${regionsSecondairesLabel}` : ''}`
      : '📍 Région principale non renseignée';
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


async function garantirEquipeManagerPourProfil(profilPayload = {}) {
  const role = profilPayload.role || currentProfil?.role;
  const societe = (profilPayload.societe || currentProfil?.societe || '').trim();

  if (role !== 'manager') {
    return null;
  }

  if (!user?.id) {
    alert("Utilisateur non connecté. Impossible de rattacher l'équipe manager.");
    return null;
  }

  if (!societe) {
    alert("Merci d’indiquer la société pour créer ou retrouver l’équipe.");
    return null;
  }

  const nomEquipe = societe;
  let equipe = null;

  const { data: equipesExistantes, error: rechercheError } = await supabaseClient
    .from('teams')
    .select('id, nom, manager_id, description')
    .ilike('nom', nomEquipe)
    .limit(1);

  if (rechercheError) {
    alert("Erreur recherche équipe : " + rechercheError.message);
    return null;
  }

  if (equipesExistantes && equipesExistantes.length > 0) {
    equipe = equipesExistantes[0];

    if (equipe.manager_id !== user.id) {
      const { data: equipeMaj, error: majEquipeError } = await supabaseClient
        .from('teams')
        .update({ manager_id: user.id })
        .eq('id', equipe.id)
        .select('id, nom, manager_id')
        .single();

      if (majEquipeError) {
        console.warn("Manager non mis à jour sur l'équipe :", majEquipeError.message);
      } else {
        equipe = equipeMaj;
      }
    }
  } else {
    const { data: nouvelleEquipe, error: creationEquipeError } = await supabaseClient
      .from('teams')
      .insert([{
        nom: nomEquipe,
        manager_id: user.id,
        description: `Équipe commerciale ${nomEquipe} créée depuis l’onboarding FLAIR`
      }])
      .select('id, nom, manager_id')
      .single();

    if (creationEquipeError) {
      alert("Erreur création équipe : " + creationEquipeError.message);
      return null;
    }

    equipe = nouvelleEquipe;
  }

  if (!equipe?.id) {
    alert("Équipe introuvable ou non créée. Impossible de finaliser l’onboarding manager.");
    return null;
  }

  return equipe.id;
}

async function reparerEquipeManagerSiNecessaire(profil = {}) {
  if (!profil || profil.role !== 'manager' || profil.team_id) {
    return profil;
  }

  const teamId = await garantirEquipeManagerPourProfil({
    role: profil.role,
    societe: profil.societe,
    region: profil.region
  });

  if (!teamId) {
    return profil;
  }

  const { data: profilMaj, error: updateError } = await supabaseClient
    .from('commerciaux')
    .update({ team_id: teamId })
    .eq('id', profil.id || user.id)
    .select('*')
    .single();

  if (updateError) {
    alert("Erreur rattachement équipe manager : " + updateError.message);
    return profil;
  }

  return profilMaj || { ...profil, team_id: teamId };
}


async function sauvegarderOnboardingMetier() {
  const prenom = document.getElementById('onboardingPrenom').value.trim();
  const nom = document.getElementById('onboardingNom').value.trim();
  const societe = document.getElementById('onboardingSociete').value.trim();
  const profil_metier = document.getElementById('onboardingProfilMetier').value;
  const fonction = document.getElementById('onboardingFonction').value;
  const role = roleDepuisFonction(fonction);
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

  await chargerInvitationCourantePourUtilisateur(user);

  const { data: profilActuel } = await supabaseClient
    .from('commerciaux')
    .select('team_id, role')
    .eq('id', user.id)
    .maybeSingle();

  const payloadInvitation = construirePayloadInvitation(invitationCourante);

  // Sécurité : si le profil existe déjà en base avec un team_id, on le conserve.
  if (!payloadInvitation.team_id && profilActuel?.team_id) {
    payloadInvitation.team_id = profilActuel.team_id;
  }

  console.log("Invitation onboarding :", invitationCourante);
  console.log("Payload invitation :", payloadInvitation);

  if (role === 'commercial' && !payloadInvitation.team_id) {
    alert("Invitation introuvable ou équipe non rattachée. Merci de demander une nouvelle invitation à votre manager.");
    return;
  }

  const profilPayload = {
    prenom,
    nom,
    societe,
    profil_metier,
    fonction,
    region,
    role,
    onboarding_done: true,
    ...payloadInvitation
  };

  if (role === 'manager' && !profilPayload.team_id) {
    const teamId = await garantirEquipeManagerPourProfil(profilPayload);
    if (!teamId) return;
    profilPayload.team_id = teamId;
  }

  const { data: updatedProfil, error } = await supabaseClient
    .from('commerciaux')
    .update(profilPayload)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) {
    alert("Erreur sauvegarde profil métier : " + error.message);
    return;
  }

  currentProfil = updatedProfil || {
    id: user.id,
    email: normaliserEmail(user.email),
    ...profilPayload
  };

  await marquerInvitationAcceptee(invitationCourante);

  chargerProfilMetier(currentProfil.profil_metier || profil_metier);
  afficherApplication();
}

function chargerProfilMetier(profilMetier) {
  window.FLairProfilMetier = profilMetier;

  console.log("Profil métier FLAIR chargé :", profilMetier);

  // Préparation future :
  // pesage        -> scoring/pesage.js
  // detection     -> scoring/detection.js
  // vision        -> scoring/vision.js
  // packaging     -> scoring/packaging.js
  // chimie_logistique  -> scoring/chimie_logistique.js
}

 // =========================
// HELPERS AFFICHAGE
// =========================



function afficherSectionCockpit(section = 'main') {
  const sectionValide = ['main', 'actifs', 'historique'].includes(section) ? section : 'main';

  document.querySelectorAll('[data-cockpit-section]').forEach(el => {
    el.style.display = el.dataset.cockpitSection === sectionValide ? '' : 'none';
  });

  document.querySelectorAll('[data-cockpit-section-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cockpitSectionBtn === sectionValide);
  });

  if (sectionValide === 'actifs') {
    chargerSignaux();
  }

  if (sectionValide === 'historique') {
    chargerHistorique();
  }
}

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

  if (isCockpitView) {
    afficherSectionCockpit('main');
  }

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
      .select('id, email, prenom, nom, role, team_id, region, regions_secondaires, profil_metier')
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
  const invitationEmail = await recupererInvitationUtilisateurParEmail(user);

  if (
    invitationEmail &&
    invitationEmail.team_id &&
    invitationCorrespondUtilisateur(invitationEmail, user)
  ) {
    const payloadInvitation = construirePayloadInvitation(invitationEmail);

    const { data: profilRepare, error: repairError } = await supabaseClient
      .from('commerciaux')
      .update(payloadInvitation)
      .eq('id', user.id)
      .select('*')
      .single();

    if (!repairError && profilRepare?.team_id) {
      currentProfil = { ...currentProfil, ...profilRepare };
      profil = profilRepare;
    }
  }
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

function nettoyerEntrepriseNomRegion(value) {
  return String(value || '')
    .replace(/\s*[—–-]\s*(?:r[eé]gion|region)\s*[:：-]\s*[^|\n\r]+/i, '')
    .replace(/\s+(?:r[eé]gion|region)\s*[:：-]\s*[^|\n\r]+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function signalCompany(s) {
  return nettoyerEntrepriseNomRegion(s.entreprise_nom || '');
}

function extraireRegionDepuisSignalTexte(s = {}) {
  const texte = [
    s.titre,
    s.entreprise_nom,
    s.description,
    s.contenu,
    s.resume,
    s.raison_score,
    s.angle_commercial,
    s.action_recommandee,
    s.texte_original
  ].filter(Boolean).join(' ');

  const match = String(texte || '').match(/(?:^|[\n\r\s—–-])(?:r[eé]gion|region|zone)\s*[:：-]\s*([^\n\r|]+)/i);
  if (!match) return '';

  return normaliserRegionImport(match[1]);
}

function signalRegion(s) {
  return normaliserRegionImport(s.region_nom || s.region || s.region_signal || s.zone || extraireRegionDepuisSignalTexte(s) || '');
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
  const region = signalRegion(s) || 'Non renseignée';
  const departement = signalDepartement(s);

  return `
    <div class="signal-card">
      <b>${rank}${signalTitle(s)}</b><br>
      ${signalCompany(s)}<br>

      <div class="badge-row">
        ${badgeChaleur(s.chaleur)}
        ${badgeType(s.type_signal)}
        ${showStatus ? badgeStatut(s.statut) : ''}
      </div>

      <small><b>Région :</b> ${region}</small><br>
      ${departement ? `<small><b>Département :</b> ${departement}</small><br>` : ''}
      ${date ? `<small><b>Date :</b> ${date}</small><br>` : ''}
      Score : ${s.score_pertinence || '-'}<br>

      ${s.raison_score ? `<small><b>Pourquoi c’est important :</b> ${s.raison_score}</small><br>` : ''}
      ${s.angle_commercial ? `<small><b>Opportunité commerciale :</b> ${s.angle_commercial}</small><br>` : ''}
      ${s.action_recommandee ? `<small><b>Action conseillée :</b> ${s.action_recommandee}</small><br>` : ''}
      ${s.commentaire_action ? `<small><b>Commentaire :</b> ${s.commentaire_action}</small><br>` : ''}
      ${s.feedback_commercial ? `<small><b>Feedback :</b> ${formatFeedback(s.feedback_commercial)}</small><br>` : ''}
      ${s.crm_cree ? `<small><b>CRM :</b> Opportunité créée</small><br>` : ''}

      ${showButtons ? `<div style="margin-top:8px;">${showButtons}</div>` : ''}
    </div>
    <hr>
  `;
}

function boutonsSignalActif(s) {
  return `
    <button onclick="changerStatut('${s.id}', 'a_contacter')">📞 À contacter</button>
    <button onclick="changerStatut('${s.id}', 'a_suivre')">⏳ À suivre</button>
    <button onclick="changerStatut('${s.id}', 'ignore')">❌ Ignorer</button>
  `;
}

function boutonsAContacter(s) {
  const crmButton = s.crm_cree
    ? '<span class="badge badge-statut">↗ Opportunité CRM créée</span>'
    : `<button onclick="marquerOpportuniteCrm('${s.id}')">↗ Opportunité CRM créée</button>`;

  return `
    <button onclick="enregistrerFeedback('${s.id}', 'interet_confirme')">✅ Confirmé</button>
    <button onclick="enregistrerFeedback('${s.id}', 'interet_non_confirme')">❌ Non confirmé</button>
    ${crmButton}
    <button onclick="changerStatut('${s.id}', 'a_suivre')">⏳ À suivre</button>
    <button onclick="changerStatut('${s.id}', 'ignore')">❌ Ignorer</button>
  `;
}

function boutonsSuivi(s) {
  return `
    <button onclick="changerStatut('${s.id}', 'a_contacter')">📞 À contacter</button>
    <button onclick="changerStatut('${s.id}', 'ignore')">❌ Ignorer</button>
  `;
}

function boutonsHistorique(s) {
  if (s.statut === 'a_suivre') return boutonsSuivi(s);
  return '';
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
      .order('created_at', { ascending: false })
      .limit(20)
  );

  if (!filtreStatut) {
    // V4.2 — les anciens statuts "traite" ne doivent plus être considérés comme des signaux actifs radar.
    query = query.not('statut', 'in', '("top3","a_contacter","a_suivre","historique","traite")');
  }

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

async function recupererTop3Actuel() {
  let query = appliquerFiltreCommercial(
    supabaseClient
      .from('signaux')
      .select('*')
      .eq('statut', 'top3')
  );

  return query
    .order('score_pertinence', { ascending: false })
    .order('date_signal', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(3);
}

async function recupererCandidatsTop3(nombrePlaces) {
  let query = appliquerFiltreCommercial(
    supabaseClient
      .from('signaux')
      .select('*')
      .eq('statut', 'analyse')
  );

  return query
    .order('score_pertinence', { ascending: false })
    .order('date_signal', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(nombrePlaces);
}

async function actualiserTop3() {
  if (!user) return;

  const { data: top3Actuel, error: top3Error } = await recupererTop3Actuel();

  if (top3Error) {
    alert("Erreur lecture Top 3 actuel : " + top3Error.message);
    return;
  }

  const placesDisponibles = Math.max(0, 3 - ((top3Actuel || []).length));

  if (placesDisponibles === 0) {
    await chargerTop3();
    return;
  }

  const { data: candidats, error: candidatsError } = await recupererCandidatsTop3(placesDisponibles);

  if (candidatsError) {
    alert("Erreur sélection candidats Top 3 : " + candidatsError.message);
    return;
  }

  if (candidats && candidats.length) {
    const ids = candidats.map(signal => signal.id);

    const { error: updateError } = await supabaseClient
      .from('signaux')
      .update({
        statut: 'top3',
        date_derniere_action: new Date().toISOString()
      })
      .in('id', ids);

    if (updateError) {
      alert("Erreur actualisation Top 3 : " + updateError.message);
      return;
    }
  }

  await refreshCockpit();
}

async function chargerTop3() {
  if (!user) return;

  const container = document.getElementById('top3');
  if (!container) return;

  // V4.5 — le TOP 3 est une zone de focus volontaire.
  // Il n'est alimenté que lorsque le commercial clique sur "Actualiser le Top 3".
  // Règle UX : un signal ne doit être visible que dans une seule zone.
  // nouveau -> Analyser -> analyse -> Signaux actifs
  // analyse -> Actualiser Top 3 -> top3
  // top3 -> À contacter / À suivre / Ignorer -> sortie du Top 3
  const { data, error } = await recupererTop3Actuel();

  if (error) {
    alert("Erreur chargement Top 3 : " + error.message);
    return;
  }

  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Aucun signal dans le Top 3 pour le moment. Analysez des signaux actifs puis cliquez sur Actualiser le Top 3.</p>";
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
      .in('statut', ['a_suivre', 'historique'])
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
      buttons: boutonsHistorique(s)
    });

    container.appendChild(div);
  });
}

function normaliserTexteSimple(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function nettoyerValeurImport(value) {
  return String(value || '')
    .replace(/^[-•\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extraireChampStructure(texte, libelles) {
  const lignes = String(texte || '').split(/\r?\n/);
  const labels = libelles.map(normaliserTexteSimple);

  for (const ligne of lignes) {
    const index = ligne.search(/[:：]/);
    if (index === -1) continue;

    const label = normaliserTexteSimple(ligne.slice(0, index));
    const valeur = nettoyerValeurImport(ligne.slice(index + 1));

    if (labels.some(l => label === l || label.startsWith(l))) {
      return valeur;
    }
  }

  return '';
}

function normaliserRegionImport(value) {
  let region = nettoyerValeurImport(value);

  // Sécurité import FLAIR :
  // Si le texte collé est sur une seule ligne, la valeur après "Région :"
  // peut embarquer la suite du diagnostic métier. On coupe uniquement l'excédent
  // pour conserver une région courte et laisser Pourquoi / Opportunité / Action
  // dans leurs champs dédiés.
  const separateursMetier = [
    /\s+pourquoi\s+c['’]est\s+important\s*[:：-]?/i,
    /\s+opportunit[eé]\s+commerciale\s*[:：-]?/i,
    /\s+action\s+(?:rapide\s+)?conseill[eé]e\s*[:：-]?/i,
    /\s+l['’]entreprise\s+/i,
    /\s+projet\s+industriel\s+/i,
    /\s+signal\s+(?:directement\s+)?/i,
    /\s+se\s+positionner\s+/i,
    /\s+identifier\s+/i,
    /\s+contacter\s+/i,
    /\s+date\s*[:：-]/i,
    /\s+score\s*[:：-]/i,
    /\s+type\s*[:：-]/i,
    /\s+entreprise\s*[:：-]/i
  ];

  let coupeIndex = -1;
  separateursMetier.forEach(regex => {
    const match = region.match(regex);
    if (match && match.index !== undefined) {
      coupeIndex = coupeIndex === -1 ? match.index : Math.min(coupeIndex, match.index);
    }
  });

  if (coupeIndex > 0) {
    region = region.slice(0, coupeIndex);
  }

  return region
    .replace(/\s*[.;,]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Référentiel léger côté client pour normaliser les zones prioritaires FLAIR.
// La table Supabase departements reste la référence base ; ce tableau permet
// de structurer immédiatement les imports sans appel supplémentaire.
const FLAIR_DEPARTEMENTS_REFERENCE = [
  { region: 'Bretagne', nom: 'Côtes-d\'Armor', code: '22', alias: ['cotes d armor', 'cotes-d armor', 'côtes d armor'] },
  { region: 'Bretagne', nom: 'Finistère', code: '29', alias: ['finistere'] },
  { region: 'Bretagne', nom: 'Ille-et-Vilaine', code: '35', alias: ['ille et vilaine'] },
  { region: 'Bretagne', nom: 'Morbihan', code: '56', alias: [] },

  { region: 'Normandie', nom: 'Calvados', code: '14', alias: [] },
  { region: 'Normandie', nom: 'Eure', code: '27', alias: [] },
  { region: 'Normandie', nom: 'Manche', code: '50', alias: ['la manche'] },
  { region: 'Normandie', nom: 'Orne', code: '61', alias: [] },
  { region: 'Normandie', nom: 'Seine-Maritime', code: '76', alias: ['seine maritime'] },

  { region: 'Pays de la Loire', nom: 'Loire-Atlantique', code: '44', alias: ['loire atlantique'] },
  { region: 'Pays de la Loire', nom: 'Maine-et-Loire', code: '49', alias: ['maine et loire'] },
  { region: 'Pays de la Loire', nom: 'Mayenne', code: '53', alias: [] },
  { region: 'Pays de la Loire', nom: 'Sarthe', code: '72', alias: [] },
  { region: 'Pays de la Loire', nom: 'Vendée', code: '85', alias: ['vendee'] },

  { region: 'Hauts-de-France', nom: 'Aisne', code: '02', alias: [] },
  { region: 'Hauts-de-France', nom: 'Nord', code: '59', alias: [] },
  { region: 'Hauts-de-France', nom: 'Oise', code: '60', alias: [] },
  { region: 'Hauts-de-France', nom: 'Pas-de-Calais', code: '62', alias: ['pas de calais'] },
  { region: 'Hauts-de-France', nom: 'Somme', code: '80', alias: [] },

  { region: 'Grand Est', nom: 'Ardennes', code: '08', alias: [] },
  { region: 'Grand Est', nom: 'Aube', code: '10', alias: [] },
  { region: 'Grand Est', nom: 'Marne', code: '51', alias: [] },
  { region: 'Grand Est', nom: 'Haute-Marne', code: '52', alias: ['haute marne'] },
  { region: 'Grand Est', nom: 'Meurthe-et-Moselle', code: '54', alias: ['meurthe et moselle'] },
  { region: 'Grand Est', nom: 'Meuse', code: '55', alias: [] },
  { region: 'Grand Est', nom: 'Moselle', code: '57', alias: [] },
  { region: 'Grand Est', nom: 'Bas-Rhin', code: '67', alias: ['bas rhin'] },
  { region: 'Grand Est', nom: 'Haut-Rhin', code: '68', alias: ['haut rhin'] },
  { region: 'Grand Est', nom: 'Vosges', code: '88', alias: [] },

  { region: 'Occitanie', nom: 'Ariège', code: '09', alias: ['ariege'] },
  { region: 'Occitanie', nom: 'Aude', code: '11', alias: [] },
  { region: 'Occitanie', nom: 'Aveyron', code: '12', alias: [] },
  { region: 'Occitanie', nom: 'Gard', code: '30', alias: [] },
  { region: 'Occitanie', nom: 'Haute-Garonne', code: '31', alias: ['haute garonne'] },
  { region: 'Occitanie', nom: 'Gers', code: '32', alias: [] },
  { region: 'Occitanie', nom: 'Hérault', code: '34', alias: ['herault'] },
  { region: 'Occitanie', nom: 'Lot', code: '46', alias: [] },
  { region: 'Occitanie', nom: 'Lozère', code: '48', alias: ['lozere'] },
  { region: 'Occitanie', nom: 'Hautes-Pyrénées', code: '65', alias: ['hautes pyrenees'] },
  { region: 'Occitanie', nom: 'Pyrénées-Orientales', code: '66', alias: ['pyrenees orientales'] },
  { region: 'Occitanie', nom: 'Tarn', code: '81', alias: [] },
  { region: 'Occitanie', nom: 'Tarn-et-Garonne', code: '82', alias: ['tarn et garonne'] }
];

const FLAIR_REGIONS_REFERENCE = [
  'Bretagne',
  'Normandie',
  'Pays de la Loire',
  'Hauts-de-France',
  'Grand Est',
  'Occitanie'
];

function normaliserCleGeographie(value) {
  return normaliserTexteSimple(value)
    .replace(/['’]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trouverRegionReference(value) {
  const cle = normaliserCleGeographie(value);
  if (!cle) return '';

  const aliasRegions = [
    { region: 'Grand Est', alias: ['alsace', 'lorraine', 'champagne ardenne', 'champagne-ardenne'] },
    { region: 'Bretagne', alias: ['vannes', 'lorient', 'rennes', 'brest', 'quimper', 'saint brieuc', 'saint-brieuc'] },
    { region: 'Hauts-de-France', alias: ['hauts de france', 'nord pas de calais', 'nord-pas-de-calais', 'picardie'] },
    { region: 'Pays de la Loire', alias: ['pays de loire', 'nantes', 'angers', 'le mans', 'laval', 'la roche sur yon'] },
    { region: 'Normandie', alias: ['rouen', 'caen', 'le havre', 'evreux', 'évreux'] },
    { region: 'Occitanie', alias: ['toulouse', 'montpellier', 'perpignan', 'nimes', 'nîmes'] }
  ];

  const aliasMatch = aliasRegions.find(item =>
    item.alias.some(alias => {
      const aliasCle = normaliserCleGeographie(alias);
      return cle === aliasCle || cle.includes(aliasCle);
    })
  );

  if (aliasMatch) return aliasMatch.region;

  return FLAIR_REGIONS_REFERENCE.find(region => {
    const regionCle = normaliserCleGeographie(region);
    return cle === regionCle || cle.includes(regionCle) || regionCle.includes(cle);
  }) || '';
}

function trouverDepartementReference(value) {
  const cle = normaliserCleGeographie(value);
  if (!cle) return null;

  return FLAIR_DEPARTEMENTS_REFERENCE.find(dep => {
    const noms = [dep.nom, dep.code, ...(dep.alias || [])];
    return noms.some(nom => {
      const depCle = normaliserCleGeographie(nom);
      return cle === depCle || cle.includes(depCle) || depCle.includes(cle);
    });
  }) || null;
}

function normaliserGeographieImport(value) {
  const brut = normaliserRegionImport(value);
  if (!brut) {
    return { region_nom: '', departement_nom: '', departement_code: '' };
  }

  const morceaux = brut
    .split(/\s*(?:\/|\||;|,|\bet\b|\(|\)|-)\s*/i)
    .map(part => nettoyerValeurImport(part))
    .filter(Boolean);

  const regionDirecte = trouverRegionReference(brut);
  const departementDirect = trouverDepartementReference(brut);
  let regionNom = regionDirecte || departementDirect?.region || '';
  let departementNom = departementDirect?.nom || '';
  let departementCode = departementDirect?.code || '';

  morceaux.forEach(part => {
    const region = trouverRegionReference(part);
    const departement = trouverDepartementReference(part);

    if (!regionNom && region) regionNom = region;
    if (!departementNom && departement) {
      departementNom = departement.nom;
      departementCode = departement.code;
      if (!regionNom) regionNom = departement.region;
    }
  });

  if (!regionNom) regionNom = brut;

  return {
    region_nom: regionNom,
    departement_nom: departementNom,
    departement_code: departementCode
  };
}

function signalDepartement(s) {
  const nom = s.departement_nom || s.departement || '';
  const code = s.departement_code || '';
  if (nom && code) return `${nom} (${code})`;
  return nom || code || '';
}

function extraireRegionImportDepuisTexte(texte) {
  const regionStructuree = extraireChampStructure(texte, [
    'Région',
    'Region',
    'Zone',
    'Localisation',
    'Territoire'
  ]);

  if (regionStructuree) return normaliserRegionImport(regionStructuree);

  const match = String(texte || '').match(/(?:^|\n|\r)\s*(?:r[eé]gion|region|zone)\s*[:：-]\s*([^\n\r]+)/i);
  if (match) return normaliserRegionImport(match[1]);

  return '';
}


function normaliserDateSignalImport(value) {
  const brut = String(value || '').trim();
  if (!brut) return '';

  const iso = brut.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return brut;

  const fr = brut.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (fr) {
    const jour = fr[1].padStart(2, '0');
    const mois = fr[2].padStart(2, '0');
    return `${fr[3]}-${mois}-${jour}`;
  }

  return '';
}

function regionsCommercialesPreparees() {
  const regionPrincipale = currentProfil?.region || '';
  const regionsSecondaires = currentProfil?.regions_secondaires || currentProfil?.regionsSecondaires || [];
  const listeSecondaire = Array.isArray(regionsSecondaires)
    ? regionsSecondaires
    : String(regionsSecondaires || '').split(/[,;|]/);

  return [regionPrincipale, ...listeSecondaire]
    .map(r => normaliserTexteSimple(r))
    .filter(Boolean);
}

function signalDansPerimetreRegionPrepare(signal) {
  const regions = regionsCommercialesPreparees();
  if (!regions.length) return true;

  const regionSignal = normaliserTexteSimple(signalRegion(signal));
  if (!regionSignal) return true;

  return regions.some(regionCommerciale =>
    regionSignal.includes(regionCommerciale) || regionCommerciale.includes(regionSignal)
  );
}

function extraireScoreImport(texte) {
  const match = String(texte || '').match(/score\s*:\s*(\d{1,3})(?:\s*\/\s*100)?/i);
  if (!match) return null;
  const score = Math.max(0, Math.min(100, Number(match[1]) || 0));
  return score;
}

function chaleurDepuisScoreFlair(score) {
  const valeur = Number(score) || 0;
  if (valeur >= 80) return 'chaud';
  if (valeur >= 60) return 'tiede';
  return 'froid';
}

function normaliserTypeSignalImport(typeLibre) {
  const type = normaliserTexteSimple(typeLibre);

  if (!type) return 'autre';
  if (type.includes('appel') || type.includes('consultation') || type.includes('devis')) return 'appel_offre';
  if (type.includes('rappel') || type.includes('contamination') || type.includes('qualite')) return 'qualite_rappel_conso';
  if (type.includes('ligne')) return 'nouvelle_ligne';
  if (type.includes('usine') || type.includes('investissement') || type.includes('extension') || type.includes('agrandissement') || type.includes('modernisation')) return 'investissement';
  if (type.includes('recrutement')) return 'recrutement';

  return 'autre';
}

function premiereLignePertinente(texte) {
  return String(texte || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .find(l => l && !l.includes(':')) || '';
}

function extraireSignalDepuisArticle(texteBrut) {
  const texte = String(texteBrut || '').trim();
  const entreprise = extraireChampStructure(texte, ['Entreprise', 'Société', 'Societe']);
  const regionImportee = extraireRegionImportDepuisTexte(texte);
  // Si aucune ligne structurée "Région :" n'est présente, FLAIR tente aussi
  // d'inférer la géographie directement depuis le texte libre.
  // Exemples : Morbihan -> Bretagne, Bas-Rhin -> Grand Est, Alsace -> Grand Est.
  const geographie = normaliserGeographieImport(regionImportee || texte);
  const region = geographie.region_nom || regionImportee;
  const typeLibre = extraireChampStructure(texte, ['Type', 'Nature du signal']);
  const pourquoi = extraireChampStructure(texte, [
    'Pourquoi c’est important',
    "Pourquoi c'est important",
    'Pourquoi',
    'Contexte'
  ]);
  const opportunite = extraireChampStructure(texte, [
    'Opportunité commerciale possible',
    'Opportunite commerciale possible',
    'Opportunité commerciale',
    'Opportunite commerciale',
    'Opportunité',
    'Opportunite'
  ]);
  const actionRapide = extraireChampStructure(texte, [
    'Action rapide conseillée',
    'Action rapide conseillee',
    'Action conseillée',
    'Action conseillee',
    'Action'
  ]);
  const quiContacter = extraireChampStructure(texte, ['Qui contacter', 'Contact cible', 'Contacts cibles']);
  const dateSignal = normaliserDateSignalImport(extraireChampStructure(texte, ['Date']));
  const scoreExplicite = extraireScoreImport(texte);

  const titre = nettoyerValeurImport(
    extraireChampStructure(texte, ['Titre', 'Signal']) ||
    premiereLignePertinente(texte) ||
    (entreprise ? `${entreprise} — signal importé` : 'Signal importé')
  );

  const texteScoring = [titre, entreprise, region, typeLibre, pourquoi, opportunite, actionRapide, quiContacter, texte]
    .filter(Boolean)
    .join(' ');

  const resultatInitial = scoringLocal(texteScoring, entreprise);
  const resultatEnrichi = enrichirScoringAvecSourceVeille({
    titre,
    entreprise_nom: entreprise,
    region,
    type_signal: typeLibre,
    description: texte,
    contenu: texte,
    resume: pourquoi,
    type_source: 'manuel'
  }, resultatInitial);

  const scoreFinal = scoreExplicite !== null
    ? Math.max(0, Math.min(100, scoreExplicite))
    : resultatEnrichi.score_pertinence;

  const actionComplete = actionRapide || (quiContacter ? `Contacter : ${quiContacter}.` : resultatEnrichi.action_recommandee);

  return {
    titre,
    entreprise_nom: entreprise,
    region,
    region_nom: region,
    departement_nom: geographie.departement_nom,
    departement_code: geographie.departement_code,
    date_signal: dateSignal,
    score_pertinence: scoreFinal,
    chaleur: chaleurDepuisScoreFlair(scoreFinal),
    type_signal: normaliserTypeSignalImport(typeLibre) !== 'autre'
      ? normaliserTypeSignalImport(typeLibre)
      : resultatEnrichi.type_signal,
    raison_score: pourquoi || resultatEnrichi.raison_score,
    angle_commercial: opportunite || resultatEnrichi.angle_commercial,
    action_recommandee: actionComplete,
    texte_original: texte
  };
}

async function insererSignalAvecFallback(payload) {
  const variantes = [];
  const ajouterVariante = (variante) => {
    const nettoyee = { ...variante };
    Object.keys(nettoyee).forEach(key => {
      if (nettoyee[key] === undefined) delete nettoyee[key];
    });

    const signature = JSON.stringify(Object.keys(nettoyee).sort());
    if (!variantes.some(v => JSON.stringify(Object.keys(v).sort()) === signature)) {
      variantes.push(nettoyee);
    }
  };

  const supprimerChamps = (source, champs) => {
    const variante = { ...source };
    champs.forEach(champ => delete variante[champ]);
    return variante;
  };

  ajouterVariante(payload);

  // Compatibilité progressive avec les bases Supabase qui n'ont pas encore
  // toutes les colonnes préparatoires. Important : on teste séparément region_nom,
  // region et region_signal pour conserver la région dès qu'une de ces colonnes existe.
  const champsOptionnels = [
    'texte_original',
    'description',
    'region_nom',
    'region',
    'region_signal',
    'departement_nom',
    'departement_code',
    'date_signal'
  ];

  champsOptionnels.forEach(champ => {
    if (Object.prototype.hasOwnProperty.call(payload, champ)) {
      ajouterVariante(supprimerChamps(payload, [champ]));
    }
  });

  if (payload.region_nom || payload.region || payload.region_signal) {
    ajouterVariante(supprimerChamps(payload, ['region_nom']));
    ajouterVariante(supprimerChamps(payload, ['region']));
    ajouterVariante(supprimerChamps(payload, ['region_signal']));
    ajouterVariante(supprimerChamps(payload, ['region', 'region_signal']));
    ajouterVariante(supprimerChamps(payload, ['region_nom', 'region_signal']));
    ajouterVariante(supprimerChamps(payload, ['region_nom', 'region']));
  }

  if (payload.departement_nom || payload.departement_code) {
    ajouterVariante(supprimerChamps(payload, ['departement_nom']));
    ajouterVariante(supprimerChamps(payload, ['departement_code']));
    ajouterVariante(supprimerChamps(payload, ['departement_nom', 'departement_code']));
  }

  if (payload.description && payload.texte_original) {
    ajouterVariante(supprimerChamps(payload, ['texte_original']));
    ajouterVariante(supprimerChamps(payload, ['description']));
  }

  // Combinaisons utiles les plus probables :
  // - region_nom absente mais region/region_signal existe
  // - region ou region_signal absentes mais region_nom existe
  // - texte_original absent mais description existe
  // - description absente mais texte_original existe
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_signal', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'description']));
  ajouterVariante(supprimerChamps(payload, ['region', 'description']));
  ajouterVariante(supprimerChamps(payload, ['region_signal', 'description']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'description']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'description', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'departement_nom', 'departement_code', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'departement_nom', 'departement_code', 'description']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'departement_nom', 'departement_code', 'description', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'departement_nom', 'departement_code', 'description', 'texte_original', 'date_signal']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'description', 'texte_original', 'date_signal']));

  // Dernier filet de sécurité : si la base ne possède ni region_nom, ni region, ni region_signal,
  // ni description/texte_original, on conserve quand même la région dans un champ
  // déjà existant presque partout : entreprise_nom.
  // signalCompany() nettoie ensuite cet ajout à l'affichage, tandis que signalRegion()
  // peut le relire pour afficher la ligne Région.
  const regionFallback = payload.region_nom || payload.region || payload.region_signal || '';
  if (regionFallback && payload.entreprise_nom) {
    const entrepriseAvecRegion = {
      ...payload,
      entreprise_nom: `${nettoyerEntrepriseNomRegion(payload.entreprise_nom)} — Région : ${regionFallback}`
    };
    ajouterVariante(supprimerChamps(entrepriseAvecRegion, ['region_nom', 'region', 'region_signal']));
    ajouterVariante(supprimerChamps(entrepriseAvecRegion, ['region_nom', 'region', 'region_signal', 'texte_original']));
    ajouterVariante(supprimerChamps(entrepriseAvecRegion, ['region_nom', 'region', 'region_signal', 'description']));
    ajouterVariante(supprimerChamps(entrepriseAvecRegion, ['region_nom', 'region', 'region_signal', 'description', 'texte_original']));
  }

  let derniereErreur = null;

  for (const variante of variantes) {
    const { error } = await supabaseClient
      .from('signaux')
      .insert([variante]);

    if (!error) return null;
    derniereErreur = error;

    const message = String(error.message || '').toLowerCase();
    if (!message.includes('column') && !message.includes('schema cache')) {
      break;
    }
  }

  return derniereErreur;
}

async function analyserArticleImporte() {
  if (!user) {
    alert('Tu dois être connecté.');
    return;
  }

  const textarea = document.getElementById('texteSignalImport');
  const status = document.getElementById('importSignalStatus');
  const texte = textarea?.value?.trim() || '';

  if (!texte) {
    alert('Merci de coller un article ou un signal à analyser.');
    return;
  }

  const contexteSignal = await garantirContexteSignal();
  if (!contexteSignal) return;

  if (status) status.textContent = 'Analyse en cours…';

  const signalImporte = extraireSignalDepuisArticle(texte);
  const regionProfil = currentProfil?.region || '';
  const regionFinale = signalImporte.region_nom || signalImporte.region || regionProfil;

  const payload = {
    commercial_id: contexteSignal.commercial_id,
    team_id: contexteSignal.team_id,
    titre: signalImporte.titre,
    entreprise_nom: signalImporte.entreprise_nom,
    statut: 'analyse',
    type_source: 'manuel',
    score_pertinence: signalImporte.score_pertinence,
    chaleur: signalImporte.chaleur,
    type_signal: signalImporte.type_signal,
    raison_score: signalImporte.raison_score,
    angle_commercial: signalImporte.angle_commercial,
    action_recommandee: signalImporte.action_recommandee
  };

  if (regionFinale) {
    // Compatibilité schéma Supabase :
    // - region_nom : colonne réelle de la table signaux
    // - region / region_signal : anciens noms ou variantes possibles
    payload.region_nom = regionFinale;
    payload.region = regionFinale;
    payload.region_signal = regionFinale;
  }
  if (signalImporte.departement_nom) payload.departement_nom = signalImporte.departement_nom;
  if (signalImporte.departement_code) payload.departement_code = signalImporte.departement_code;
  if (signalImporte.date_signal) payload.date_signal = signalImporte.date_signal;

  // On conserve le texte importé quand la colonne existe.
  // Cela permet aussi à signalRegion() de retrouver la région même si la colonne region
  // n'existe pas encore dans certaines bases Supabase.
  if (signalImporte.texte_original) {
    payload.description = signalImporte.texte_original;
    payload.texte_original = signalImporte.texte_original;
  }

  const error = await insererSignalAvecFallback(payload);

  if (error) {
    if (status) status.textContent = '';
    alert('Erreur import signal : ' + error.message);
    return;
  }

  if (textarea) textarea.value = '';
  if (status) status.textContent = `Signal ajouté au radar · score ${signalImporte.score_pertinence}/100 · ${signalImporte.chaleur}`;

  await refreshCockpit();
}

async function ajouterSignal() {
  // Compatibilité avec d'anciens boutons éventuels : la saisie manuelle simple reste possible si les champs existent encore.
  if (!user) {
    alert('Tu dois être connecté.');
    return;
  }

  const titre = document.getElementById('titre')?.value?.trim() || '';
  const entreprise = document.getElementById('entreprise')?.value?.trim() || '';

  if (!titre) {
    alert('Merci de saisir un titre.');
    return;
  }

  const contexteSignal = await garantirContexteSignal();
  if (!contexteSignal) return;

  const { error } = await supabaseClient
    .from('signaux')
    .insert([{
      commercial_id: contexteSignal.commercial_id,
      team_id: contexteSignal.team_id,
      titre,
      entreprise_nom: entreprise,
      statut: 'nouveau',
      type_source: 'manuel'
    }]);

  if (error) {
    alert('Erreur insertion : ' + error.message);
    return;
  }

  const titreInput = document.getElementById('titre');
  const entrepriseInput = document.getElementById('entreprise');
  if (titreInput) titreInput.value = '';
  if (entrepriseInput) entrepriseInput.value = '';

  await refreshCockpit();
}

async function changerStatut(signalId, nouveauStatut) {
  const nowIso = new Date().toISOString();
  const updateData = {
    statut: nouveauStatut,
    date_derniere_action: nowIso
  };

  let signalData = null;

  if (['a_contacter', 'a_suivre'].includes(nouveauStatut)) {
    const { data, error: signalError } = await supabaseClient
      .from('signaux')
      .select('chaleur')
      .eq('id', signalId)
      .single();

    if (signalError) {
      console.error("Erreur lecture chaleur signal :", signalError);
    }

    signalData = data;
  }

  if (nouveauStatut === 'a_contacter') {
    updateData.date_a_contacter = nowIso;

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

  if (nouveauStatut === 'a_suivre') {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    updateData.relance_due_at = d.toISOString();
  }

  if (nouveauStatut === 'ignore') {
    updateData.statut = 'historique';
    updateData.relance_due_at = null;
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


async function marquerOpportuniteCrm(signalId) {
  const nowIso = new Date().toISOString();

  // V4.1 — FLAIR reste un radar : on ne transforme plus le statut du signal.
  // L'information CRM est un marqueur léger, exploitable par le dashboard manager.
  const updateData = {
    crm_cree: true,
    date_crm_cree: nowIso,
    date_derniere_action: nowIso,
    relance_due_at: null
  };

  const { error } = await supabaseClient
    .from('signaux')
    .update(updateData)
    .eq('id', signalId);

  if (error) {
    alert("Erreur création opportunité CRM : " + error.message);
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
      !['ignore', 'a_contacter', 'a_suivre', 'historique', 'traite'].includes(s.statut)
    ).length;

    const chauds = signaux.filter(s =>
      s.chaleur === 'chaud' &&
      !['ignore', 'a_contacter', 'a_suivre', 'historique', 'traite'].includes(s.statut)
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

function isDateInManagerPeriod(value, period) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d >= period.start && d <= period.end;
}

function isSignalCreatedInPeriod(s, period) {
  return isDateInManagerPeriod(getSignalDate(s), period);
}

function isSignalContactedInPeriod(s, period) {
  // V4.1 — compatible avec les anciens signaux qui n'ont pas encore date_a_contacter.
  if (isDateInManagerPeriod(s.date_a_contacter, period)) return true;
  if (s.statut === 'a_contacter' && isDateInManagerPeriod(s.date_derniere_action, period)) return true;
  return false;
}

function isSignalCrmCreatedInPeriod(s, period) {
  if (s.crm_cree !== true) return false;
  if (isDateInManagerPeriod(s.date_crm_cree, period)) return true;
  if (!s.date_crm_cree && isDateInManagerPeriod(s.date_derniere_action, period)) return true;
  return false;
}

function getFeedbackSignals(signaux) {
  // Le taux de pertinence doit rester lisible même avec peu de signaux :
  // il est donc calculé sur les feedbacks existants, pas uniquement sur les créations du jour.
  return signaux.filter(s =>
    ['interet_confirme', 'interet_non_confirme'].includes(s.feedback_commercial)
  );
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

function safePercent(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function renderManagerEvolutionChart(values = []) {
  const container = document.getElementById('mgrEvolutionChart');
  if (!container) return;

  const nums = values.map(v => Number(v) || 0);
  const max = Math.max(...nums, 1);
  const width = 420;
  const height = 150;
  const padX = 24;
  const padY = 18;
  const step = nums.length > 1 ? (width - padX * 2) / (nums.length - 1) : 0;

  const points = nums.map((value, index) => {
    const x = padX + index * step;
    const y = height - padY - ((value / max) * (height - padY * 2));
    return { x, y, value };
  });

  const line = points.map(p => `${p.x},${p.y}`).join(' ');
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="manager-v51-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="flairChartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a855f7" stop-opacity="0.34"></stop>
          <stop offset="100%" stop-color="#a855f7" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <g class="manager-chart-grid">
        <line x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}"></line>
        <line x1="${padX}" y1="${height / 2}" x2="${width - padX}" y2="${height / 2}"></line>
        <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}"></line>
      </g>
      <polygon points="${area}" class="manager-chart-area"></polygon>
      <polyline points="${line}" class="manager-chart-line"></polyline>
      ${points.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="3.2" class="manager-chart-dot"><title>Jour ${i + 1} : ${p.value}</title></circle>`).join('')}
    </svg>
    <div class="manager-chart-axis">${nums.map((_, i) => `<span>${i + 1}</span>`).join('')}</div>
  `;
}

function renderManagerHeatDonut(signaux = []) {
  const container = document.getElementById('mgrHeatDonut');
  if (!container) return;

  const chaud = signaux.filter(s => s.chaleur === 'chaud').length;
  const tiede = signaux.filter(s => s.chaleur === 'tiede').length;
  const froid = signaux.filter(s => s.chaleur === 'froid').length;
  const total = Math.max(chaud + tiede + froid, 0);

  const pChaud = safePercent(chaud, total);
  const pTiede = safePercent(tiede, total);
  const pFroid = Math.max(0, 100 - pChaud - pTiede);

  container.innerHTML = `
    <div class="manager-heat-donut" style="background: conic-gradient(#e4574f 0 ${pChaud}%, #f2a93b ${pChaud}% ${pChaud + pTiede}%, #6ea8ff ${pChaud + pTiede}% 100%);">
      <div><strong>${total}</strong><small>total</small></div>
    </div>
    <div class="manager-heat-legend">
      <div><span class="heat-dot hot"></span>Chaud <strong>${chaud} (${pChaud}%)</strong></div>
      <div><span class="heat-dot warm"></span>Tiède <strong>${tiede} (${pTiede}%)</strong></div>
      <div><span class="heat-dot cold"></span>Froid <strong>${froid} (${pFroid}%)</strong></div>
    </div>
  `;
}

function renderManagerBars(containerId, entries = [], emptyText = 'Aucune donnée.') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = `<div class="manager-empty">${emptyText}</div>`;
    return;
  }

  const max = Math.max(...entries.map(entry => entry.value), 1);

  container.innerHTML = entries.slice(0, 5).map((entry, index) => {
    const pct = Math.round((entry.value / max) * 100);
    return `
      <div class="manager-v51-bar-row">
        <div class="manager-v51-bar-head">
          <span>${index + 1}. ${entry.label}</span>
          <strong>${entry.value}${entry.detail ? ` ${entry.detail}` : ''}</strong>
        </div>
        <div class="manager-v51-bar"><i style="width:${pct}%"></i></div>
      </div>`;
  }).join('');
}

function formatManagerTypeLabel(type) {
  const labels = {
    appel_offre: 'Appel d’offre',
    investissement: 'Projet d’investissement',
    recrutement: 'Recrutement',
    nouvelle_ligne: 'Nouvelle ligne',
    qualite_rappel_conso: 'Qualité / rappel conso',
    autre: 'Surveillance / veille'
  };

  return labels[type] || managerLabel(type, 'Autre');
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


function getManagerPeriodConfig() {
  const value = document.getElementById('managerPeriodFilter')?.value || '7';
  const now = new Date();
  const start = new Date(now);
  let label = '7 derniers jours';

  if (value === '30') {
    start.setDate(now.getDate() - 30);
    label = '30 derniers jours';
  } else if (value === '90') {
    start.setDate(now.getDate() - 90);
    label = '90 derniers jours';
  } else if (value === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    label = `Année ${now.getFullYear()}`;
  } else {
    start.setDate(now.getDate() - 7);
  }

  start.setHours(0, 0, 0, 0);
  now.setHours(23, 59, 59, 999);

  return { value, start, end: now, label };
}

function calculerTempsMoyenAvantAction(signaux) {
  const delais = signaux
    .filter(s => s.created_at && s.date_a_contacter)
    .map(s => {
      const created = new Date(s.created_at).getTime();
      const contacted = new Date(s.date_a_contacter).getTime();
      if (Number.isNaN(created) || Number.isNaN(contacted) || contacted < created) return null;
      return contacted - created;
    })
    .filter(v => v !== null);

  if (!delais.length) return '—';

  const moyenneMs = delais.reduce((total, v) => total + v, 0) / delais.length;
  const heures = moyenneMs / (1000 * 60 * 60);

  if (heures < 24) return `${Math.max(1, Math.round(heures))} h`;
  return `${Math.round(heures / 24)} j`;
}

async function chargerDashboardManager() {
  if (!user) return;

  try {
    const teamId = currentProfil?.team_id;

    if (!teamId) {
      console.warn('Dashboard Manager : team_id manquant pour le profil courant.');
      return;
    }

    const period = getManagerPeriodConfig();
    const startWeek = period.start;
    const now = period.end;

    setText('managerPeriodLabel', period.label);
    setText('managerPeriodSmall', period.label);

    const { data, error } = await supabaseClient
      .from('signaux')
      .select('*')
      .eq('team_id', teamId);

    if (error) throw error;

    const allSignaux = data || [];
    const signaux = allSignaux.filter(s =>
      isSignalCreatedInPeriod(s, period) ||
      isSignalContactedInPeriod(s, period) ||
      isSignalCrmCreatedInPeriod(s, period) ||
      isDateInManagerPeriod(s.date_derniere_action, period) ||
      isDateInManagerPeriod(s.relance_due_at, period)
    );

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

    const actifs = signaux.filter(s => !['ignore', 'historique', 'a_contacter', 'a_suivre', 'traite'].includes(s.statut));
    const nouveaux = signaux.filter(s => s.statut === 'nouveau');
    const leadsChauds = signaux.filter(s => s.chaleur === 'chaud' && !['ignore', 'historique', 'a_contacter', 'a_suivre', 'traite'].includes(s.statut));
    const aContacter = signaux.filter(s => s.statut === 'a_contacter');

    // V4.1 — KPI Signaux contactés : statut à contacter OU date de contact renseignée.
    const signauxContactes = allSignaux.filter(s =>
      s.statut === 'a_contacter' || Boolean(s.date_a_contacter)
    );

    const signauxContactesPeriode = allSignaux.filter(s =>
      isSignalContactedInPeriod(s, period)
    );

    // V4.1 — CRM = booléen léger, sans changement de statut.
    const opportunitesCrm = allSignaux.filter(s => s.crm_cree === true);
    const opportunitesCrmPeriode = allSignaux.filter(s => isSignalCrmCreatedInPeriod(s, period));

    const relancesRetard = allSignaux.filter(s => {
      if (!s.relance_due_at) return false;
      if (['historique', 'ignore', 'traite'].includes(s.statut)) return false;
      if (s.crm_cree === true) return false;
      return new Date(s.relance_due_at) < now;
    });

    const feedbackSignals = getFeedbackSignals(allSignaux);
    const confirmes = feedbackSignals.filter(s => s.feedback_commercial === 'interet_confirme');
    const nonConfirmes = feedbackSignals.filter(s => s.feedback_commercial === 'interet_non_confirme');
    const totalFeedback = feedbackSignals.length;
    const tauxPertinence = totalFeedback > 0 ? Math.round((confirmes.length / totalFeedback) * 100) : 0;
    const tempsMoyenAction = calculerTempsMoyenAvantAction(allSignaux);

    setText('mgrSignauxActifs', signaux.length);
    setText('mgrNouveauxSignaux', leadsChauds.length);
    setText('mgrLeadsChauds', signauxContactes.length);
    setText('mgrAContacter', opportunitesCrm.length);
    setText('mgrRelancesRetardKpi', relancesRetard.length);
    setText('mgrSignauxActifsInfo', 'Signaux détectés');
    setText('mgrNouveauxInfo', 'Signaux chauds');
    setText('mgrLeadsChaudsInfo', 'Signaux contactés');
    setText('mgrAContacterInfo', 'Créées dans le CRM');
    setText('mgrRelancesRetardInfo', relancesRetard.length ? 'Attention requise' : 'Situation maîtrisée');

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
    });

    allSignaux.forEach(s => {
      const contactDate = s.date_a_contacter || (s.statut === 'a_contacter' ? s.date_derniere_action : null);
      if (!isDateInManagerPeriod(contactDate, period)) return;
      const index = getManagerDateKey(contactDate);
      if (index !== null) dailyAContacter[index]++;
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

    // V5.1 — rendu visuel manager premium, sans modifier la logique métier.
    renderManagerEvolutionChart(dailyActifs);
    renderManagerHeatDonut(signaux);

    setText('mgrConfirmes', confirmes.length);
    setText('mgrNonConfirmes', nonConfirmes.length);
    setText('mgrRequalifier', 0);
    setText('mgrTotalFeedback', totalFeedback);
    setText('mgrTauxConfirmation', `${tauxPertinence}%`);
    setText('mgrTauxConfirmationDetail', `${confirmes.length} confirmé(s) / ${totalFeedback} retour(s) · temps moyen action : ${tempsMoyenAction}`);
    setText('mgrQualityBadge', `${totalFeedback} retour${totalFeedback > 1 ? 's' : ''}`);
    setWidth('mgrTauxConfirmationBar', tauxPertinence);

    const pctConfirmes = totalFeedback ? (confirmes.length / totalFeedback) * 100 : 0;
    const pctNonConfirmes = totalFeedback ? (nonConfirmes.length / totalFeedback) * 100 : 0;

    const donutConfirmes = document.getElementById('donutConfirmes');
    const donutRequalifier = document.getElementById('donutRequalifier');
    const donutNonConfirmes = document.getElementById('donutNonConfirmes');

    if (donutConfirmes && donutRequalifier && donutNonConfirmes) {
      donutConfirmes.setAttribute('stroke-dasharray', `${pctConfirmes} 100`);
      donutConfirmes.setAttribute('stroke-dashoffset', '0');

      donutRequalifier.setAttribute('stroke-dasharray', `0 100`);
      donutRequalifier.setAttribute('stroke-dashoffset', `-${pctConfirmes}`);

      donutNonConfirmes.setAttribute('stroke-dasharray', `${pctNonConfirmes} 100`);
      donutNonConfirmes.setAttribute('stroke-dashoffset', `-${pctConfirmes}`);
    }

    const activityByCommercial = new Map();
    allSignaux.forEach(s => {
      const commercialId = s.assigne_a || s.commercial_id || 'non_assigne';
      const current = activityByCommercial.get(commercialId) || {
        id: commercialId,
        label: commerciauxMap.get(commercialId) || (commercialId === 'non_assigne' ? 'Non assigné' : 'Commercial'),
        total: 0,
        chauds: 0,
        contactes: 0,
        confirmes: 0,
        feedbacks: 0
      };
      current.total++;
      if (s.chaleur === 'chaud') current.chauds++;
      if (s.statut === 'a_contacter' || s.date_a_contacter) current.contactes++;
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
              <div class="manager-row-sub">${item.total} signaux · ${item.chauds} chaud(s) · ${item.contactes} contacté(s)</div>
              <div class="manager-progress"><i style="width:${width}%"></i></div>
            </div>
            <div class="manager-row-score">${rate}%</div>
          </div>`;
      });

    renderManagerRows('mgrActiviteCommerciaux', activityRows, 'Aucune activité équipe sur la période.');

    const sourcesMap = new Map();
    allSignaux.forEach(s => {
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
              <div class="manager-source-sub">${item.total} signal(aux) · ${rate}% pertinents</div>
              <div class="manager-progress"><i style="width:${width}%"></i></div>
            </div>
            <div class="manager-row-score">${item.total}</div>
          </div>`;
      });

    renderManagerRows('mgrSources', sourceRows, 'Aucune source exploitable sur la période.');

    const topCrmEntries = Array.from(activityByCommercial.values())
      .map(item => ({
        label: item.label,
        value: opportunitesCrm.filter(s => (s.assigne_a || s.commercial_id || 'non_assigne') === item.id).length
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    renderManagerBars('mgrTopCrm', topCrmEntries, 'Aucune opportunité CRM créée.');

    const typeMap = new Map();
    signaux.forEach(s => {
      const label = formatManagerTypeLabel(s.type_signal || 'autre');
      typeMap.set(label, (typeMap.get(label) || 0) + 1);
    });

    const totalAngles = Math.max(signaux.length, 1);
    const angleEntries = Array.from(typeMap.entries())
      .map(([label, value]) => ({
        label,
        value,
        detail: `(${safePercent(value, totalAngles)}%)`
      }))
      .sort((a, b) => b.value - a.value);

    renderManagerBars('mgrAngles', angleEntries, 'Aucun angle exploitable sur la période.');

    const suivis = allSignaux.filter(s => s.statut === 'a_suivre');
    const suivisRows = suivis
      .sort((a, b) => new Date(a.relance_due_at || a.date_derniere_action || a.created_at || 0) - new Date(b.relance_due_at || b.date_derniere_action || b.created_at || 0))
      .slice(0, 5)
      .map(s => {
        const prochaineAction = s.relance_due_at ? formatDate(s.relance_due_at) : 'à surveiller';
        return `
          <div class="manager-relance-row">
            <div>
              <div class="manager-relance-title">${managerLabel(s.titre, 'Signal sans titre')}</div>
              <div class="manager-relance-sub">${managerLabel(s.entreprise_nom, 'Entreprise non renseignée')}</div>
            </div>
            <div class="manager-delay">${prochaineAction}</div>
          </div>`;
      });

    setText('mgrASuivreBadge', suivis.length);
    renderManagerRows('mgrASuivre', suivisRows, 'Aucun signal à suivre.');

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

  const labels = {
    nouveau: 'nouveau',
    analyse: 'analysé',
    top3: 'top 3',
    a_contacter: 'à contacter',
    a_suivre: 'à suivre',
    historique: 'ignoré',
    traite: 'traité',
    crm_cree: 'CRM créé'
  };

  return badge(labels[statut] || statut, 'statut');
}

function formatFeedback(feedback) {
  if (feedback === 'interet_confirme') {
    return '✅ Confirmé';
  }

  if (feedback === 'interet_non_confirme') {
    return '❌ Non confirmé';
  }

  return feedback || '';
}


function plafonnerScoreParChaleur(score, chaleur) {
  const valeur = Number(score) || 0;

  if (chaleur === 'froid') {
    return Math.min(valeur, 39);
  }

  if (chaleur === 'tiede') {
    return Math.min(valeur, 79);
  }

  if (chaleur === 'chaud') {
    return Math.min(valeur, 100);
  }

  return Math.min(valeur, 100);
}

function normaliserResultatScoring(resultat) {
  const scorePlafonne = plafonnerScoreParChaleur(resultat.score_pertinence, resultat.chaleur);
  return {
    ...resultat,
    score_pertinence: scorePlafonne
  };
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
    "agrandit",
    "agrandir",
    "augmentation de capacité",
    "augmentation de capacite",
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
    "audit brc",
    "brcgs",
    "haccp",
    "ccp",
    "point critique"
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
    "plusieurs lignes",
    "lignes de production",
    "ligne automatisée",
    "ligne automatisee",
    "ligne de conditionnement",
    "ligne de production",
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

return normaliserResultatScoring({
  score_pertinence: score,
  chaleur,
  type_signal,
  raison_score,
  angle_commercial,
  action_recommandee
});
}

 // =========================
 // ENRICHISSEMENT SOURCE-VEILLE
 // =========================

 function enrichirScoringAvecSourceVeille(signal, resultatInitial) {

  if (
    !window.FLAIR_SOURCE_VEILLE ||
    typeof window.FLAIR_SOURCE_VEILLE.analyserSignalAvecRegles !== 'function'
  ) {
    return resultatInitial;
  }

  const enrichissement = window.FLAIR_SOURCE_VEILLE
    .analyserSignalAvecRegles(signal);

  if (!enrichissement) {
    return resultatInitial;
  }

  const scoreFinal = Math.min(
    (resultatInitial.score_pertinence || 0) +
    (enrichissement.score_bonus || 0),
    95
  );

  const chaleurRank = { froid: 1, tiede: 2, chaud: 3 };

  function chaleurDepuisScore(score) {
    if (score >= 80) return 'chaud';
    if (score >= 60) return 'tiede';
    return 'froid';
  }

  function garderChaleurLaPlusForte(...valeurs) {
    return valeurs
      .filter(Boolean)
      .sort((a, b) => (chaleurRank[b] || 0) - (chaleurRank[a] || 0))[0] || 'froid';
  }

  const chaleurFinale = garderChaleurLaPlusForte(
    resultatInitial.chaleur,
    enrichissement.chaleur,
    chaleurDepuisScore(scoreFinal)
  );

  return normaliserResultatScoring({
    ...resultatInitial,

    score_pertinence: scoreFinal,

    chaleur: chaleurFinale,

    type_signal:
      enrichissement.type_signal ||
      resultatInitial.type_signal,

    raison_score:
      enrichissement.raison ||
      resultatInitial.raison_score,

    angle_commercial:
      enrichissement.opportunite ||
      resultatInitial.angle_commercial,

    action_recommandee:
      enrichissement.action ||
      resultatInitial.action_recommandee
  });
}

  async function analyserNouveauxSignaux(options = {}) {
    const { silent = false, refresh = true, max = null } = options || {};

    let query = appliquerFiltreCommercial(
      supabaseClient
        .from('signaux')
        .select('*')
        .eq('statut', 'nouveau')
        .order('created_at', { ascending: false })
    );

    if (max) {
      query = query.limit(max);
    }

    const { data, error } = await query;

  if (error) {
    if (!silent) alert("Erreur chargement signaux : " + error.message);
    return 0;
  }

  if (!data || data.length === 0) {
    if (!silent) alert("Aucun signal nouveau à analyser.");
    return 0;
  }

  let nbAnalyses = 0;

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

    const resultatInitial = scoringLocal(texteComplet, '');

    const resultat = enrichirScoringAvecSourceVeille(
      signal,
      resultatInitial
    );

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
    } else {
      nbAnalyses++;
    }
  }

  if (refresh) await refreshCockpit();
  if (!silent) alert("Analyse terminée.");
  return nbAnalyses;
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


async function reconcilerInvitationsEquipe(teamId) {
  if (!teamId) return;

  const { data: invitations, error: invitationsError } = await supabaseClient
    .from('invitations')
    .select('*')
    .eq('team_id', teamId)
    .eq('statut', 'en_attente');

  if (invitationsError) {
    console.warn('Réconciliation invitations impossible :', invitationsError.message);
    return;
  }

  const invitationsEnAttente = invitations || [];
  if (!invitationsEnAttente.length) return;

  const emails = invitationsEnAttente
    .map(invitation => normaliserEmail(invitation.email))
    .filter(Boolean);

  if (!emails.length) return;

  const { data: profils, error: profilsError } = await supabaseClient
    .from('commerciaux')
    .select('*')
    .in('email', emails);

  if (profilsError) {
    console.warn('Réconciliation profils impossible :', profilsError.message);
    return;
  }

  const profilsParEmail = new Map((profils || []).map(profil => [normaliserEmail(profil.email), profil]));

  for (const invitation of invitationsEnAttente) {
    const profil = profilsParEmail.get(normaliserEmail(invitation.email));
    if (!profil?.id || !profil.onboarding_done) continue;

    const payloadInvitation = construirePayloadInvitation(invitation);

    const doitRattacher =
      !profil.team_id ||
      profil.team_id !== invitation.team_id ||
      !profil.region ||
      JSON.stringify(normaliserListeRegionsSecondaires(profil.regions_secondaires)) !== JSON.stringify(normaliserListeRegionsSecondaires(invitation.regions_secondaires)) ||
      !profil.role;

    if (doitRattacher) {
      const { error: updateProfilError } = await supabaseClient
        .from('commerciaux')
        .update(payloadInvitation)
        .eq('id', profil.id);

      if (updateProfilError) {
        console.warn('Profil non rattaché automatiquement :', updateProfilError.message);
        continue;
      }
    }

    await marquerInvitationAcceptee(invitation);
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

  await reconcilerInvitationsEquipe(teamId);

  const { data: invitationsData, error: invitationsError } = await supabaseClient
    .from('invitations')
    .select('*')
    .eq('team_id', teamId)
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

  // Sécurité UI : même si Supabase renvoie encore des invitations acceptées
  // après une réconciliation ou un cache, le bloc "Invitations en attente"
  // n'affiche que les invitations réellement en_attente.
  const invitations = (invitationsData || []).filter(invitation => invitation.statut === 'en_attente');
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
        ${invitation.profil_metier ? `<small>Métier : ${labelProfilMetier(invitation.profil_metier)}</small>` : ''}
      </div>

      <div>
        <span class="invite-status">
          ${invitationStatusLabel(invitation.statut)}
        </span>

        <small>
          ${formatManagerDateTime(invitation.created_at)}
        </small>
        ${labelRegionsSecondaires(invitation.regions_secondaires) ? `<small>Secondaires : ${labelRegionsSecondaires(invitation.regions_secondaires)}</small>` : ''}
      </div>

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
            ${commercial.profil_metier ? `<small>Métier : ${labelProfilMetier(commercial.profil_metier)}</small>` : ''}
          </div>
          <div style="justify-self:end;text-align:right;min-width:210px;">
            <span class="invite-status active">Actif</span>
            <small>${labelRegionCommerciale(commercial.region || '')}</small>
            ${labelRegionsSecondaires(commercial.regions_secondaires) ? `<small>Secondaires : ${labelRegionsSecondaires(commercial.regions_secondaires)}</small>` : ''}
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
  const profilMetier = document.getElementById('inviteProfilMetier')?.value || '';
  const region = document.getElementById('inviteRegion')?.value || currentProfil?.region || '';
  const regionsSecondaires = Array.from(document.getElementById('inviteRegionsSecondaires')?.selectedOptions || [])
    .map(option => option.value)
    .filter(value => value && value !== region);

  if (!email) {
    alert("Merci d’indiquer l’email du commercial à inviter.");
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const invitationToken = crypto.randomUUID();

  const { error } = await supabaseClient
    .from('invitations')
    .insert([{
      team_id: teamId,
      manager_id: user.id,
      email,
      prenom,
      nom,
      fonction,
      profil_metier: profilMetier,
      region,
      regions_secondaires: regionsSecondaires,
      role: roleDepuisFonction(fonction),
      token: invitationToken,
      statut: 'en_attente',
      expires_at: expiresAt.toISOString()
    }]);

  if (error) {
    alert("Erreur invitation : " + error.message);
    return;
  }

  ['inviteEmail', 'invitePrenom', 'inviteNom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const regionsSecondairesSelect = document.getElementById('inviteRegionsSecondaires');
  if (regionsSecondairesSelect) {
    Array.from(regionsSecondairesSelect.options).forEach(option => { option.selected = false; });
  }

  await chargerInvitations();
  alert("Invitation enregistrée.");
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

window.resetPassword = resetPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
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
window.marquerOpportuniteCrm = marquerOpportuniteCrm;
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
