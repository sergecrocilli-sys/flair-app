# FLAIR — Patch V1 cockpit + règles métier

Modifications intégrées :

## index.html
- Ajout du rappel doctrine FLAIR.
- Conservation du bloc statistiques.
- Remise en place des scroll-zones Top 3 et À contacter.
- Ajout d'un bloc Historique récent.

## style.css
- Nettoyage des blocs @media.
- Dashboard cockpit en 3 colonnes plus homogènes.
- Cadre statistiques propre.
- Scroll interne Top 3 / À contacter.
- Style Historique récent.
- Responsive mobile conservé.

## app.js
- Ajout de la doctrine métier en commentaire.
- Ajout de refreshCockpit().
- Centralisation de l'affichage des cartes.
- Conservation du scoring local.
- Conservation des filtres rapides.
- Ajout de chargerHistorique().
- Statuts actifs : nouveau, analyse, a_contacter.
- Statuts de sortie : traite, ignore, historique.
- Le bouton Traité est renommé en Traité / feedback pour rappeler qu'un vrai retour prospect/client est attendu.

À tester après publication :
1. Connexion.
2. Ajout d'un signal.
3. Analyse des nouveaux signaux.
4. Filtres chaud / type / statut.
5. Passage en À contacter.
6. Passage en Traité / feedback.
7. Passage en Ignorer.
8. Vérification Historique récent.
9. Vérification mobile.
