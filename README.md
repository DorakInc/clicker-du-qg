# Clicker du QG

Jeu clicker de gestion de carrière d'artiste : on fait des beats au QG, on gère l'argent, le cannabis et les fans pour ne pas « fail out ».

Le plan complet est dans [Plan de match - Clicker du QG.md](Plan%20de%20match%20-%20Clicker%20du%20QG.md).

## Organisation du dépôt

| Dossier | Volet | Contenu |
|---|---|---|
| `src/` | A, Gameplay et code | Logique du jeu, affichage, audio (code) |
| `data/` | A et C | Fichiers de données : personnages, upgrades, paliers, textes (JSON) |
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
