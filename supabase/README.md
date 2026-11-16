# Classement en ligne (Supabase)

Le jeu affiche un onglet **🏆 Top** : chaque joueur choisit un pseudo et un code secret de 4 chiffres, son score part tout seul toutes les minutes, et le classement se met à jour en direct chez tout le monde. Deux classements :

- **🏆 Record** : l'argent total gagné pendant la meilleure partie de chacun ;
- **⚡ Temps réel** : la partie **en cours** de chacun (cash, $/s, abonnés, beats/s, territoires, serre, animaux), classée par $/s.

Toucher un joueur ouvre sa page **Carrière de l'artiste** : son personnage, son palier, sa partie en cours et son record.

Tant que le projet Supabase n'est pas branché, l'onglet indique « hors ligne ». Pour essayer l'interface sans compte : http://localhost:8000/?classement=demo (faux serveur en mémoire, avec des rivaux qui progressent).

## Mettre en route (une seule fois, environ 10 minutes)

Une seule personne de l'équipe le fait.

1. Créer un compte gratuit sur [supabase.com](https://supabase.com), puis **New project**. Nom : `clicker-du-qg` ; région : `Canada (Central)` ou la plus proche. Garder le mot de passe de la base dans un gestionnaire de mots de passe (le jeu n'en a pas besoin).
2. Dans le projet : **SQL Editor** → **New query** → coller tout le fichier [`migrations/20261115000000_classement.sql`](migrations/20261115000000_classement.sql) → **Run**. Le message doit être « Success. No rows returned ». Le fichier peut être relancé sans danger.
   Puis, de la même façon, coller et lancer [`migrations/20261116000000_sauvegarde.sql`](migrations/20261116000000_sauvegarde.sql) : la **sauvegarde en ligne** (la partie suit le pseudo et son code d'un appareil à l'autre). Sans ce fichier, le classement marche mais le jeu affiche « Sauvegarde en ligne pas encore activée ».
   Enfin, coller et lancer [`migrations/20261116120000_temps_reel.sql`](migrations/20261116120000_temps_reel.sql) : l'onglet **⚡ Temps réel** et la page de carrière. Sans ce fichier, la sauvegarde et le record marchent, et l'onglet affiche « pas encore activé sur le serveur ». Si on relance un jour le fichier de la sauvegarde, relancer celui-ci ensuite (il remplace `save_game`).
3. **Project Settings → API** (ou **Connect**) : copier
   - l'**URL du projet** (`https://xxxx.supabase.co`) ;
   - la clé **publique** : `anon` / `public`, ou `sb_publishable_…` sur les projets récents.
4. Les coller dans [`data/online.json`](../data/online.json) :
   ```json
   { "supabaseUrl": "https://xxxx.supabase.co", "supabaseKey": "la clé publique", ... }
   ```
5. Lancer `npm test` : un test refuse la clé si c'est la clé **secrète** (`service_role` ou `sb_secret_…`). Cette clé-là ne doit **jamais** aller dans le dépôt : elle donne tous les droits sur la base.
6. `npm start`, ouvrir l'onglet Classement : « ● en direct » doit s'afficher.

La clé publique peut être dans le dépôt et dans le navigateur : c'est prévu pour. Ce qui protège les données, ce sont les règles de la base (ci-dessous), pas le secret de cette clé.

## Ce que contient la base

| Élément | Rôle | Accès depuis le jeu |
|---|---|---|
| `players` | pseudo, code chiffré (bcrypt), compteur de mauvais codes, blocage | aucun (illisible) |
| `scores` | meilleure partie de chaque joueur : argent total gagné, palier, fans, territoires, personnage | lecture seule |
| `join_leaderboard(pseudo, code)` | crée le pseudo, ou s'y reconnecte avec le bon code | appel |
| `submit_score(...)` | vérifie le code et enregistre le score s'il bat le record | appel |
| `saves` | la partie en cours de chaque joueur (sauvegarde en ligne), avec un numéro de révision | aucun (illisible) |
| `load_game(pseudo, code)` / `save_game(...)` | reprendre ou sauvegarder sa partie ; si un autre appareil a sauvegardé entre-temps, répond « conflict » et le jeu demande quelle partie garder | appel |
| `live_stats` | stats **publiques** de la partie en cours (onglet Temps réel, page de carrière) : cash, $/s, argent gagné, palier, abonnés, beats/s, beats produits, territoires, serre, animaux et compagnon, fail out, temps de jeu, personnage | lecture seule |

**Ce qui est public, ce qui ne l'est pas.** `save_game` reçoit, en plus de la sauvegarde, un petit paquet de stats (`p_stats`, calculé par `liveFromState` dans `src/online/rules.js`). Le serveur le vérifie et le recopie dans `live_stats`. La sauvegarde complète (`saves`) et le code (`players`) restent illisibles depuis le navigateur ; `live_stats` ne contient ni l'un ni l'autre (pas même l'identifiant interne du joueur, qui n'est pas lu par le jeu).

Règles appliquées par le serveur :
- pseudo de 2 à 16 caractères (lettres, accents, chiffres, espace, `.` `-` `_`), unique sans tenir compte des majuscules ;
- 5 mauvais codes de suite → pseudo bloqué 15 minutes ;
- au plus un envoi de score toutes les 10 secondes par joueur ;
- un score plus bas que le record ne le remplace pas (« Nouvelle partie » ne fait pas perdre sa place) ;
- valeurs impossibles refusées (négatives, NaN, infini, palier hors limites) ;
- stats de la partie en cours : publiées **seulement si la sauvegarde passe** (un appareil en retard qui reçoit « conflict » ne remplace pas les stats de la partie la plus récente). Des stats invalides (texte, négatif, `null`, nombre trop grand, territoires ou niveau d'amitié non entier, plus de 32 animaux, identifiant d'animal en majuscules, paquet de plus de 4 Ko) sont ignorées sans bloquer la sauvegarde (réponse `stats: 'invalid'`). Les clés inconnues sont ignorées. Mêmes règles dans le faux serveur de la démo (`cleanLiveStats`), vérifiées par `npm test`.

## Vérifier

Ce SQL a été testé sur PostgreSQL 17 avec les rôles `anon` et `authenticated` de Supabase : création, reconnexion, mauvais code, blocage, envoi trop rapide, scores invalides, record conservé, et refus de lire `players` ou d'écrire directement dans `scores`.

`20261116120000_temps_reel.sql` a été testé de la même façon (PostgreSQL 17, après les deux autres fichiers, puis relancé) : sauvegarde sans stats (réponse identique à avant), avec stats, stats invalides ignorées, « conflict » et mauvais code sans effet sur `live_stats`, une seule fonction `save_game` après la migration, et refus pour `anon` d'écrire dans `live_stats`, de lire `saves` ou `players`, ou d'appeler `_live_stats_ok`.

Dans Supabase, après la mise en route : **Table Editor → scores** doit se remplir quand quelqu'un joue, et **live_stats** à chaque sauvegarde en ligne (toutes les minutes). Pour retirer un joueur : **Table Editor → players**, supprimer sa ligne (son score, sa sauvegarde et ses stats partent avec).

## Limites connues

- La partie est calculée dans le navigateur : un joueur motivé peut envoyer un faux score (ou de fausses stats « Temps réel »). Entre amis, c'est accepté ; des vérifications côté serveur pourront venir plus tard.
- « Temps réel » suit la sauvegarde en ligne : il se met à jour au plus une fois par minute, et seulement pour les joueurs connectés (pseudo + code). « ● en jeu » veut dire « sauvegardé il y a moins de 2 min 30 ».
- Le code à 4 chiffres est gardé dans le navigateur du joueur (pour l'envoi automatique). Ce n'est pas un mot de passe : ne pas réutiliser un code important.
- Le direct passe par une librairie chargée depuis jsDelivr (`@supabase/supabase-js@2.118.0`). Sans réseau, le jeu marche normalement et le classement réessaie plus tard.
- Le jeu doit être hébergé à une adresse publique pour que les amis y jouent (voir ROADMAP.md).
