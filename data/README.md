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
| `greenhouse.json` | La serre : palier de déblocage, équipement ($ → grammes), variétés (grammes → bonus) | A (chiffres), C (noms) |
| `map.json` | La carte : territoires, voisins, hype à atteindre, rivaux, bonus de conquête | A (chiffres), C (noms, descriptions, rivaux) |
| `texts.json` | Messages du jeu, réactions des fans, libellés des statistiques | Volet C |
| `sounds.json` | Quel fichier audio joue pour quel événement | Volet C |
| `fx.json` | Réglages des animations : plafonds de particules et de nombres flottants, seuils du « gros beat », durées de tenue (voir `docs/animations/`) | A et B |
| `online.json` | Classement en ligne : adresse du projet Supabase et **clé publique** (jamais la clé secrète), taille du top, fréquence d'envoi. Vide = classement hors ligne. Voir `supabase/README.md` | A |
| `pets.json` | Animaux de compagnie : prix d'adoption, palier, effets par niveau d'amitié | A (chiffres), B (images), C (noms, descriptions) |
| `events.json` | Événements à la BitLife (police, impôts, beat viral…) : fréquence, conditions, effets, choix et leurs chances. Les textes sont à réécrire par le volet C. Essai direct : `?evenement=<id>` | A (règles), C (textes) |

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
| `quality` | inspiration : multiplie la qualité des beats (même à jeun ; la qualité fait aussi gagner plus de fans) |

Les **variétés** de la serre ont des niveaux sans fin : le niveau N coûte `cost × costGrowth^N` grammes, et chaque niveau applique encore une fois ses `effects` (deux stats en plus : `grow` pour la pousse et `harvest` pour la récolte au clic).

Les **animaux** (`pets.json`) marchent comme les variétés, mais en argent : le niveau 0 → 1 est l'adoption (`cost`), puis chaque gâterie coûte `cost × costGrowth^niveau` et applique encore une fois les `effects`. Tous les animaux adoptés donnent leur bonus ; celui choisi « à côté de moi » s'affiche au QG, et on peut le flatter (des cœurs, sans effet sur le jeu). `species` sert pour le dessin.

Les **territoires** de la carte (`map.json`) : `x` et `y` placent le marqueur sur la carte de 160 × 100 ; `requires` liste les voisins (un seul suffit, ou tous si `requiresAll` vaut `true`) ; `hype` est la barre à remplir ; `defense` est la hype que le rival enlève chaque seconde ; `effects` est le bonus permanent une fois conquis (stat en plus : `hype` pour la vitesse de conquête).

`requiresTier` (producteurs, upgrades) est le numéro du palier qui débloque l'élément : 0 pour le premier palier de `tiers.json`, 1 pour le deuxième, etc.

## Images (volet B)

Le jeu cherche les images à ces emplacements, par `id`. Tant qu'un fichier n'existe pas, un remplaçant texte s'affiche.

| Élément | Fichier |
|---|---|
| Feuille de sprites d'un personnage | `assets/images/personnages/<id>-sheet.png` (ex. `xavier-sheet.png`) |
| Décor du QG | `assets/images/qg/fond.png` (160 × 100, généré par `npm run sprites`) |
| Décor de la serre | `assets/images/serre/fond.png` (160 × 100, généré) |
| Plant de la serre | `assets/images/serre/plante.png` (3 stades de 16 × 24, généré) |
| Carte du monde | `assets/images/carte/fond.png` (160 × 100, généré) |
| Objet du QG (upgrade acheté) | `assets/images/qg/<id>.png` (ex. `casque.png`) |
| Animal de compagnie | `assets/images/animaux/<id>.png` (2 images de 28 × 20 côte à côte, de profil vers la droite ; généré par `npm run sprites`, provisoire) |

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

Événements : `click`, `buyProducer`, `adoptPet`, `treatPet`, `petPet` (flatter l'animal), `buyUpgrade`, `cannabisBuy`, `cannabisEmpty` (l'effet est fini), `overdose` (trop gelé), `broke` (à sec), `failStart`, `failEnd`, `tierUp`, `characterSelect`.

Musique (`music`) : une boucle par ambiance, qui change selon l'état du jeu : `normal`, `cannabis` (effet actif), `baisse` (fans en baisse), `echec` (fail out). Mettre `null` tant qu'il n'y a pas de fichier.

## Textes (volet C)

Dans `texts.json`, chaque message est une liste : une phrase est tirée au hasard. Les mots entre accolades sont remplacés par le jeu : `{name}`, `{tier}`, `{duration}`, `{money}`. Les textes actuels sont **temporaires**.

- `ticker` : les phrases qui défilent sur la radio « QG FM » en haut de l'écran.
- `fanHandles` : les noms d'utilisateur des fans dans le fil « QGram ».
- `fanReactions` : ce que les fans écrivent quand l'audience monte (`up`) ou baisse (`down`).

## Événements (`events.json`)

Un événement tombe toutes les `minGapSeconds` à `maxGapSeconds` secondes de jeu (jamais avant `firstDelaySeconds`, ni avant le palier `minTier`, ni un mauvais événement pendant un fail out). Le même ne revient pas avant `repeatCooldownSeconds`.

- `tone` : `good`, `bad` ou `neutral` (couleur de la carte) ; `weight` : plus il est haut, plus il est fréquent.
- `requires` : `minTier`, `minMoney`, `minIncome` ($/s), `minBps`, `stash` (zen ou grammes à saisir), `greenhouse`, `map`, `campaign`.
- Soit `effects` (appliqués tout de suite), soit `choices` : chaque choix a un `label` et des `outcomes` dont les `chance` font 1.
- Effets : `money` (`multiply`, ou `incomeSeconds` : ± N secondes de revenu), `fans` (`multiply`), `grams` (`multiply`, `add`), `stash` (`share` : part saisie du zen et des grammes), `hype` (`multiply`, campagne en cours), `buff` (`stat`, `multiply`, `seconds` : effet temporaire).
