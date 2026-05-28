# FLAIR — Radar commercial industriel

FLAIR est une application PWA de détection, qualification et priorisation de signaux commerciaux pour commerciaux industriels terrain.

## Philosophie produit

FLAIR n’est pas un CRM.

- FLAIR détecte, score, priorise et déclenche l’attention commerciale.
- Le CRM gère ensuite les opportunités, les devis, le pipeline et le forecast.
- Le commercial garde la main sur ses priorités.

## Logique radar validée

- `nouveau` : signal ajouté ou importé, en attente d’analyse.
- `analyse` : signal scoré et disponible dans le réservoir radar.
- `top3` : signal promu dans les 3 priorités du moment via “Actualiser le Top 3”.
- `a_contacter` : signal retenu pour action commerciale.
- `a_suivre` : signal à garder sous surveillance.
- `historique` : signal ignoré, clôturé ou archivé.

Un signal ne doit apparaître que dans une seule zone : actifs, Top 3, à contacter, à suivre ou historique.

## Version actuelle — V5.2 Polish

Cette version conserve la logique métier stable et apporte uniquement des ajustements UX/UI :

- cockpit commercial plus lisible et plus premium ;
- dashboard manager redesigné en logique SaaS professionnel ;
- KPI simplifiés ;
- courbe d’évolution et donut par chaleur ;
- tableau équipe premium ;
- cartes plus aérées, alignées et compactes ;
- réduction du scroll sur PC standard ;
- responsive conservé mobile/tablette/desktop.

## Points volontairement non modifiés

- Supabase ;
- statuts ;
- scoring ;
- logique Top 3 ;
- logique manager ;
- workflow commercial.

## Déploiement

Déposer les fichiers à la racine GitHub Pages du projet FLAIR.
Aucun SQL supplémentaire n’est nécessaire pour cette V5.2 si le patch V4.5 a déjà été exécuté.



## FLAIR — Onboarding manager sécurisé

Cette version améliore l'onboarding manager :

- si un manager termine son onboarding sans équipe existante, FLAIR crée automatiquement une équipe au nom de sa société ;
- si une équipe existe déjà avec le même nom de société, FLAIR la retrouve ;
- le profil manager reçoit automatiquement le `team_id` ;
- le manager peut ensuite inviter ses commerciaux immédiatement ;
- les commerciaux invités récupèrent le même `team_id` via l'invitation.

Principe V1 conservé :
`team_id = société cliente`
`region = périmètre manager / commercial`
`role = manager ou commercial`
