# Données du jeu

Tout le contenu du jeu vit ici, séparé du code. Les volets B (visuel) et C (son, textes) peuvent modifier ces fichiers sans toucher à `src/`.

**Après chaque modification, lancer `npm test`** : les tests vérifient que les fichiers sont valides (identifiants, effets, ordre des paliers...) et disent précisément ce qui cloche.

## Les fichiers

| Fichier | Contenu | Qui y touche |
|---|---|---|
| `balance.json` | Tous les réglages d'équilibrage (prix, durées, seuils) | Volet A |
| `characters.json` | Xavier, Nathan, Émile : nom, force, description, bonus | A (bonus), C (textes) |
| `producers.json` | Producteurs automatiques (beats par seconde) | A (chiffres), C (noms, descriptions) |
| `upgrades.json` | Upgrades du QG, achetés une seule fois | A (chiffres), C (noms, descriptions) |
| `tiers.json` | Paliers de carrière, débloqués par le record de fans | A (seuils), C (noms) |
| `texts.json` | Messages du jeu, réactions des fans, libellés des statistiques | Volet C |
| `sounds.json` | Quel fichier audio joue pour quel événement | Volet C |

## Identifiants (`id`)

Chaque personnage, producteur, upgrade et palier a un `id` en minuscules avec des tirets (`panneaux-acoustiques`). **Ne pas changer un `id` existant** : il sert de lien avec les sauvegardes, les images et les sons. On peut changer le `name` librement.

## Effets

Personnages, upgrades et paliers ont une liste `effects`. Chaque effet multiplie une statistique :

```json
{ "stat": "beatValue", "multiply": 1.25 }
```

| `stat` | Effet |
|---|---|
| `click` | beats produits par clic |
| `bps` | beats par seconde des producteurs |
| `beatValue` | argent gagné par beat |
| `fanGain` | fans gagnés par beat |
| `churn` | perte naturelle de fans (moins de 1 = on garde mieux ses fans) |
| `cannabisDecay` | vitesse à laquelle l'effet du cannabis s'estompe (moins de 1 = dure plus longtemps) |
| `cannabisPrice` | prix du cannabis |
| `cannabisPower` | gain de qualité apporté par le cannabis |

`requiresTier` (producteurs, upgrades) est le numéro du palier qui débloque l'élément : 0 pour le premier palier de `tiers.json`, 1 pour le deuxième, etc.

## Images (volet B)

Le jeu cherche les images à ces emplacements, par `id`. Tant qu'un fichier n'existe pas, un remplaçant texte s'affiche.

| Élément | Fichier |
|---|---|
| Feuille de sprites d'un personnage | `assets/images/personnages/<id>-sheet.png` (ex. `xavier-sheet.png`) |
| Décor du QG | `assets/images/qg/fond.png` (160 × 100, généré par `npm run sprites`) |
| Objet du QG (upgrade acheté) | `assets/images/qg/<id>.png` (ex. `casque.png`) |

### Personnages en pixel art

Les sprites sont dessinés en code dans `scripts/sprites/characters.js`, d'après les photos de référence en T-pose. Après une modification, lancer `npm run sprites` pour régénérer les images.

- Chaque image fait 32 × 48 pixels, affichée agrandie sans flou.
- Feuille `<id>-sheet.png` : 3 lignes (face, profil tourné vers la droite, dos) × 2 images (respiration). Pour le profil gauche, on retourne l'image.
- `<id>.png` : la vue de face seule.
- `sprites.json` décrit la feuille pour le code.

Les animations suivantes (faire un beat, réaction, effet du cannabis, échec) et le fond du QG par palier viendront ensuite.

## Sons (volet C)

`sounds.json` associe chaque événement du jeu à une liste de fichiers dans `assets/audio/`. Quand il y a plusieurs fichiers, un est choisi au hasard (utile pour varier le son du clic).

```json
"click": ["effets/clic-1.mp3", "effets/clic-2.mp3", "effets/clic-3.mp3"]
```

Événements : `click`, `buyProducer`, `buyUpgrade`, `cannabisBuy`, `cannabisEmpty` (l'effet est fini), `overdose` (trop gelé), `broke` (à sec), `failStart`, `failEnd`, `tierUp`, `characterSelect`.

Musique (`music`) : une boucle par ambiance, qui change selon l'état du jeu : `normal`, `cannabis` (effet actif), `baisse` (fans en baisse), `echec` (fail out). Mettre `null` tant qu'il n'y a pas de fichier.

## Textes (volet C)

Dans `texts.json`, chaque message est une liste : une phrase est tirée au hasard. Les mots entre accolades sont remplacés par le jeu : `{name}`, `{tier}`, `{duration}`, `{money}`. Les textes actuels sont **temporaires**.

- `ticker` : les phrases qui défilent sur la radio « QG FM » en haut de l'écran.
- `fanHandles` : les noms d'utilisateur des fans dans le fil « QGram ».
- `fanReactions` : ce que les fans écrivent quand l'audience monte (`up`) ou baisse (`down`).
