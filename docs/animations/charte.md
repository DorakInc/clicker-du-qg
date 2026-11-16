# Charte d'animation — Clicker du QG

Version 0.1 (proposition, à valider avant la production du lot pilote).
Voir aussi : [catalogue.md](catalogue.md) (les 80 animations) et [lot-pilote.md](lot-pilote.md) (les 10 premières fiches).

## 1. Ce qu'on a trouvé dans le projet

| Sujet | Constat |
|---|---|
| Moteur | Aucun moteur de jeu : HTML + CSS + JavaScript (modules ES), sans framework ni canvas. L'affichage est du DOM rafraîchi 15 fois par seconde (`src/ui/view.js`), la boucle tourne sur `requestAnimationFrame` (`src/main.js`). |
| Événements | La logique (`src/game/`) renvoie des événements `{ type, ...détails }` que `main.js` distribue déjà à l'audio et au fil QGram. C'est le point de branchement idéal pour les animations. 22 types existent : `click`, `harvest`, `show`, `buyProducer`, `buyUpgrade`, `buyEquipment`, `buyStrain`, `cannabisBuy`, `jointHomegrown`, `cannabisEmpty`, `overdose`, `broke`, `failStart`, `failEnd`, `tierUp`, `greenhouseUnlock`, `mapUnlock`, `campaignStart`, `promo`, `samples`, `territoryConquered`, plus le retour hors ligne. |
| Visuels | Pixel art généré par code (`scripts/sprites/`, `npm run sprites`). Scènes de 160 × 100 px agrandies par la variable CSS `--s`. Personnages de 32 × 48 px : **2 images seulement par vue** (face, profil, dos). Le décor du QG est **une seule image plate** (`qg/fond.png`). |
| Interface | « Papier crème sur fond prune » : contours encre de 3 px, ombres franches décalées sans flou, autocollants légèrement penchés, polices Pixelify Sans et Silkscreen. Toutes les couleurs sont des variables dans `style.css`. |
| Animations existantes | Enfoncement du vinyle (`hit`, 120 ms), nombre flottant (`float-up`, 900 ms), respiration du sprite (2 images, 1,4 s), fumée du cannabis, tangage « trop gelé », tampon FAIL OUT, apparition des messages, clignotements (ON AIR, alerte, onglet nouveau), pulsation des marqueurs de la carte, balancement de la plante. |
| Cibles de clic | Trois : le **vinyle** (studio → beats, $), le bouton **Récolter** (serre → grammes), le **micro** (carte → hype). |
| Appareils | Mise en page adaptée jusqu'aux téléphones (point de rupture à 760 px, `touch-action: manipulation` sur les cibles) : le tactile est donc pris en compte, mais aucune cible matérielle n'est fixée. |
| Mouvements réduits | `prefers-reduced-motion` coupe certaines boucles, mais oublie les nombres flottants, le tampon, l'enfoncement et les messages. Aucune option dans le jeu. |
| Points faibles actuels | Un nouveau nœud DOM par nombre flottant, **sans plafond** : à 15 clics/s, une quinzaine de nœuds vivent en même temps. Les boutons trop chers sont `disabled` : un clic n'émet rien, donc aucun refus n'est possible à animer. |

## 2. L'identité du mouvement

**En une phrase : sec au clic, paresseux au repos, lourd et comique dans les grands moments, et tout bat au tempo du QG.**

### Le tempo du QG

Toutes les boucles de repos sont calées sur un tempo lo-fi de **86 BPM, soit un temps ≈ 700 ms**. La respiration actuelle (1,4 s) dure déjà exactement deux temps : on la garde comme référence.

| Durée de référence | Valeur | Usage |
|---|---|---|
| 1 temps | 700 ms | pulsations, clignements, hochements |
| 2 temps | 1 400 ms | respiration, boucles de repos |
| ½ temps | 350 ms | entrées de panneaux et de bannières (le tampon FAIL OUT dure déjà 350 ms) |
| ¼ temps | 175 ms | réponse à un clic, rebond |

Le tempo est une variable (`--tempo`). Avec le cannabis actif, il ralentit (×1,5, la « brume ») ; en fail out, il ralentit et tout s'affaisse.

### Quatre caractères selon le moment

| Moment | Caractère | Règle concrète |
|---|---|---|
| Clic, achat | **Sec, nerveux** | Attaque en moins de 60 ms, aucune anticipation qui retarde la réponse, rebond court. |
| Repos, ambiance | **Paresseux, chill** | Lent, `ease-in-out`, amplitude de 1 pixel art. Ça doit sentir le sous-sol à 2 h du matin. |
| Grands moments (palier, conquête, déblocage) | **Lourd et comique** | Le « tampon » : grossit à 2×, s'écrase à 1× avec un léger dépassement, penché de quelques degrés, puis se décolle comme un autocollant. |
| Échec (fail out, à sec, trop gelé) | **Mou, qui s'affaisse** | Ralentissement, désaturation, objets qui tombent d'un pixel. Jamais rouge clignotant plein écran. |

### Deux familles de matière

1. **Le papier (interface)** : cartes, boutons, autocollants, téléphone. Ça bouge comme du papier collé : décalage de l'ombre pour s'enfoncer (le bouton glisse sur son ombre), petites rotations de −3° à +3°, apparitions en « pop ». Pas de flou, pas de lueur douce.
2. **Le pixel (scènes)** : QG, serre, carte. Les déplacements se font **par pas d'un pixel art** (multiples de `--s`) et avec `steps()`, à environ 12 images/s, comme une animation dessinée. `image-rendering: pixelated` partout.

Les nombres flottants et les particules qui sortent d'une scène vers l'interface passent d'une famille à l'autre : ils naissent pixelisés (pas) et finissent en papier (pop).

## 3. Palette des effets

Uniquement les couleurs déjà définies dans `style.css`. Chaque couleur porte un sens, toujours le même :

| Variable | Sens dans les animations |
|---|---|
| `--lamp` (#ffd166) | **Argent** : pièces, gains en $, compteur « le cash » |
| `--weed` / `--weed-dark` | **Grammes, zen, cannabis** : récolte, joint, brume |
| `--pink` | **Fans et hype** : abonnés, QGram, conquête |
| `--sunset` | **Action et progression** : boutons actifs, paliers, bannières |
| `--paper` / `--paper-2` | Étincelles neutres, éclats, confettis secondaires |
| `--danger` | **Refus et échec seulement**, jamais en aplat qui clignote |
| `--ink` | Contour de toute particule de plus de 2 pixels art |
| `--lcd-text` | La radio QG FM (bandeau, « flash spécial ») |

Une variation de couleur seule ne fait **jamais** une nouvelle animation : la couleur suit la ressource, le mouvement suit l'événement.

## 4. Formes et lumière

- **Particules** : carrés d'un ou deux pixels art (`--s`), petites notes de musique ♪ en pixel, pièces de 6 × 6 avec contour encre, feuilles pour les grammes, cœurs pour les fans. Pas de cercles lisses dans les scènes.
- **Ondes** : anneaux concentriques à bords nets (comme les sillons du vinyle), qui avancent par pas.
- **Lumière** : pas de `blur` ni de `box-shadow` flou. Une lueur se dessine par anneaux durs (`radial-gradient` à arrêts francs, comme l'étiquette du vinyle) ; un reflet est une diagonale d'un pixel qui balaie l'objet.
- **Texte animé** : Silkscreen, ombre dure de 2 px (`--shadow`), comme les nombres flottants actuels.
- **Bannières** : autocollant papier, contour 3 px, ombre décalée 4–6 px, penché de −6° à +6°.

## 5. Fluidité du clicker

### Priorités visuelles

| Niveau | Contenu | Règle |
|---|---|---|
| **P0 — récompense majeure** | Palier, conquête, déblocage de zone, retour hors ligne | Une seule à la fois, les autres attendent en file (500 ms d'écart). Peut atténuer P2 et P3, ne bloque jamais le clic. |
| **P1 — action importante** | Achats, cannabis, début/fin de fail out, refus | Simultanées permises, une par élément d'interface. |
| **P2 — clic courant** | Écrasement, nombres, particules de clic | Plafonnées et regroupées pendant les rafales. Pendant un P0, particules ÷ 2. |
| **P3 — ambiance** | Respiration, poussières, décor | Mises en pause quand l'onglet est caché ou en mouvements réduits. |

### Règles de relance (chaque fiche en choisit une)

| Règle | Comportement |
|---|---|
| `restart` | Repart de l'image de contact (pas du début) pour éviter les sauts. |
| `merge` | L'instance en cours absorbe le nouvel événement (ex. le montant d'un nombre flottant augmente). |
| `stack` | Nouvelle instance jusqu'au plafond ; au-delà, la plus ancienne est recyclée. |
| `queue` | Attend la fin de l'instance en cours (P0). |
| `ignore` | Ignorée tant que l'instance en cours n'est pas finie. |

### Budgets proposés (à confirmer selon les appareils visés)

| Élément | Plafond |
|---|---|
| Nœuds d'effets en même temps (tous types) | 80 |
| Nombres flottants visibles | 6 |
| Particules de clic | 32 |
| Pièces en vol | 18 |
| Confettis d'un P0 | 24 |
| Temps d'effets par image | ≤ 2 ms sur un téléphone moyen, 60 i/s visées |
| Seuil de rafale (regroupement) | à partir de 8 clics/s |

Ces plafonds vivront dans un fichier de données (`data/fx.json`) pour être réglables sans toucher au code.

Règles techniques :
- On n'anime que `transform` et `opacity` (jamais `width`, `top`, `left`, `filter` pour les effets répétés).
- Les nœuds d'effets sont **réutilisés** (réserve créée au démarrage), jamais créés à chaque clic.
- Une seule lecture de position par clic ; les positions des compteurs sont mises en cache et recalculées au redimensionnement.
- Rien ne s'anime quand l'onglet est caché ; au retour, on n'enchaîne pas les animations accumulées (on montre seulement le résultat).

### Interdits

- Aucun flash plein écran, aucune alternance clair/sombre de plus de 3 fois par seconde.
- Aucun tremblement permanent. Un seul tremblement permis : P0, 2 pixels art maximum, 300 ms maximum, coupé en mouvements réduits.
- Aucune animation qui bloque un clic ou recouvre le vinyle plus de 350 ms (`pointer-events: none` sur tous les effets).
- L'existant à revoir dans ce sens : `alert-danger` clignote en continu tant que dure le fail out ; on le remplacera par un clignotement d'entrée puis un état fixe.

### Mouvements réduits

- Option dans le jeu (pied de page, à côté de « Couper le son ») avec trois états : **auto** (suit le système), **réduits**, **complets**. Enregistrée avec les réglages existants.
- En mode réduit : aucun déplacement, rebond, tremblement ni particule. On garde **toute l'information** : nombres affichés sur place puis estompés, changements de couleur, bannières qui apparaissent en fondu, compteurs mis à jour.

### Tactile

- Le retour visuel du clic part au `pointerdown` (plus rapide au doigt), la logique reste sur `click`.
- Nombres flottants décalés au-dessus du doigt (−40 px) pour rester visibles.
- Aucune information portée uniquement par le survol.

## 6. Architecture proposée

```
src/ui/fx/
  fx.js        point d'accès commun : fx.play(id, options), fx.onGameEvent(event)
  pool.js      réserve de nœuds réutilisables + plafonds
  catalog.js   fiche technique de chaque animation (durée, priorité, règle de relance)
  motion.js    mouvements réduits (auto / réduits / complets), vitesse globale
src/ui/fx.css  keyframes et classes des effets
data/fx.json   plafonds et réglages modifiables
demo/animations.html   page de démonstration (même code que le jeu)
```

- **Un seul point d'entrée** : `main.js` appelle `fx.onGameEvent(event)` dans sa fonction `handle()`, à côté de `audio.play(event.type)`. Chaque animation peut aussi être lancée à la main : `fx.play('tier_up', { name: 'Buzz local' })`.
- **Technique** : animations CSS pour les boucles, Web Animations API (`element.animate`) pour les effets lancés par un événement (relance, vitesse et annulation faciles). Pas de bibliothèque externe.
- **Sprites d'effets** (pièce, note, feuille, cœur, drapeau) générés par le même pipeline `scripts/sprites/` vers `assets/images/effets/`.
- **Images de personnage supplémentaires** (clignement, saut, étourdi) ajoutées aux feuilles existantes par `scripts/sprites/characters.js`, en gardant le format actuel (32 × 48, une ligne par vue) et en ajoutant des colonnes.
- **Démonstration** : un bouton par animation, curseur de vitesse (0,25× à 2×), rejouer, mouvements réduits, et un mode « stress » (20 clics/s simulés + plusieurs événements P0/P1 en même temps) avec compteur de nœuds actifs et d'images/s.

## 7. Informations manquantes

Voir la liste détaillée à la fin de [lot-pilote.md](lot-pilote.md#informations-manquantes).
