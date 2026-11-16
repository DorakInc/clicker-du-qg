# Clicker du QG

Jeu clicker de gestion de carrière d'artiste : on fait des beats au QG, on gère l'argent, le cannabis et les fans pour ne pas « fail out ».

Le plan complet est dans [Plan de match - Clicker du QG.md](Plan%20de%20match%20-%20Clicker%20du%20QG.md).

## Jouer

Il faut [Node.js](https://nodejs.org) (version 18 ou plus), sur Mac comme sur Windows.

```bash
npm start
```

Puis ouvrir http://localhost:8000 dans le navigateur. Le jeu est pensé pour le téléphone (une colonne, gros bouton au centre, navigation en bas) ; sur ordinateur, il s'affiche au centre de l'écran. Sur téléphone, « Ajouter à l'écran d'accueil » l'ouvre en plein écran comme une app. La démonstration des animations est sur http://localhost:8000/demo/animations.html (voir [docs/animations/](docs/animations/charte.md)). Ouvrir `index.html` directement ne marche pas : le jeu doit charger ses fichiers de données.

Pour essayer un événement sans attendre : http://localhost:8000/?evenement=police (les identifiants sont dans `data/events.json`).

Pour vérifier la logique du jeu et les fichiers de `data/` :

```bash
npm test
```

## Créer un personnage

```bash
npm run atelier
```

Puis ouvrir http://127.0.0.1:8001 : l'atelier des personnages. On y dépose les photos en T-pose (de face, de profil, de dos) pour prendre les couleurs à la pipette, on compose le look en pixel art avec des pièces (coiffure, haut, bas, souliers, accessoires…), on choisit les pouvoirs et la description, et « Enregistrer dans le jeu » écrit la fiche dans `data/characters.json` et génère sa planche de sprites. Les photos ne quittent jamais le navigateur. Détails dans [data/README.md](data/README.md#personnages-charactersjson).

## Organisation du dépôt

| Dossier | Volet | Contenu |
|---|---|---|
| `src/game/` | A, Gameplay | Logique du jeu, sans affichage (testée par `npm test`) |
| `src/ui/` | A, puis B | Affichage et style (provisoire) |
| `src/audio/` | A | Lecture des sons déclarés dans `data/sounds.json` |
| `data/` | A, B et C | Contenu du jeu en JSON : voir [data/README.md](data/README.md) |
| `tests/` | A | Tests de la logique et des données |
| `outils/` | A, B, C | L'atelier des personnages (`npm run atelier`) |
| `src/poupee/` | A, B | La poupée de papier des personnages : corps + pièces (`parts/`), et le look encodé dans l'identifiant d'un perso créé (`code.js`). Sert au jeu, à l'atelier et à `npm run sprites` |
| `scripts/sprites/` | A, B | Les dessins en code (`npm run sprites`) |
| `assets/images/` | B, Visuel | `personnages/`, `qg/`, `interface/`, `effets/` |
| `assets/audio/` | C, Son | `musique/`, `effets/` (mp3 ou ogg) |

## Branches

- `main` : version stable, on y fusionne seulement par Pull Request relue par un autre membre.
- `gameplay` : volet A
- `visuel` : volet B
- `son` : volet C

## Routine de travail

```bash
git pull                     # avant de commencer
git add .
git commit -m "description courte"
git push
```

Rester dans son dossier autant que possible, et ne committer que les fichiers finaux (pas les projets Photoshop ou sessions audio).
