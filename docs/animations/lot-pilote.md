# Lot pilote — 10 fiches

Animations 01, 05, 06, 11, 22, 32, 34, 41, 45 et 55. Elles valident les clics, la personnalité, les ressources, l'interface et les récompenses avant les 70 autres.
Règles communes, couleurs et budgets : [charte.md](charte.md). Vue d'ensemble : [catalogue.md](catalogue.md).

Deux numéros du brief visaient des mécaniques absentes du jeu et sont remplacés :
- **06 « clic critique »** → `click_quality`, le **gros beat** fait sous l'effet du zen (le jeu n'a pas de coup critique, mais chaque clic porte déjà une `quality`).
- **55 « obtention d'un succès »** → `territory_conquered`, la **conquête d'un territoire** (le jeu n'a pas de succès ; la conquête est sa récompense permanente la plus proche).

## Ce qui distingue les dix

| Paire souvent confondue | Différence de mouvement |
|---|---|
| 01 `click_squash` / 06 `click_quality` | 01 est mécanique et toujours là (le disque s'enfonce). 06 s'ajoute seulement sous zen : des notes s'échappent de l'étiquette en arc et le nombre grossit. Sans zen, 06 n'existe pas. |
| 05 `gain_float` / 22 `coins_to_counter` | 05 = gain **direct**, né au point de contact, monte verticalement et éclate sur place. 22 = revenu **automatique**, voyage en courbe jusqu'au compteur. L'un monte, l'autre traverse. |
| 32 `ui_press` / 34 `ui_refuse` / 41 `shop_buy` | 32 = tout le bouton glisse sur son ombre (vertical, vers le bas-droite). 34 = seul le prix bouge, de gauche à droite (« non »). 41 = un tampon tombe sur l'article et le compteur ×N saute. |
| 45 `tier_up` / 55 `territory_conquered` | 45 se joue **sur le QG** : bannière autocollant, confettis, saut du personnage. 55 se joue **dans l'espace de la carte** : drapeau planté, anneaux sur la carte, routes qui se tracent vers les voisins. |
| 11 `char_breathe` | Seule boucle du lot : ne réagit à rien, change de rythme selon l'état. |

## Composants communs à créer

| Composant | Utilisé par |
|---|---|
| `fx.play` / `fx.onGameEvent` (point d'accès) | toutes |
| Réserve de nœuds + plafonds (`pool.js`, `data/fx.json`) | 05, 06, 22, 45 |
| Mouvement « tampon » (2× → 1× avec dépassement, penché) — déjà utilisé par FAIL OUT | 41, 45, 55 |
| Sortie « pop » (1 → 1,15 → 0 en 120 ms) | 05, 06, 22, 45 |
| Particule pixel (carré, note, pièce, confetti) | 06, 22, 45, 55 |
| File P0 (une récompense majeure à la fois) | 45, 55 |
| Tempo du QG (`--tempo`) et mouvements réduits (`motion.js`) | toutes |

---

## 01 — `click_squash`

| Champ | Contenu |
|---|---|
| **Intention** | Taper sur un pad de MPC : le joueur sent que son clic « rentre » dans le disque. |
| **Déclencheur** | `pointerdown` sur la cible (retour immédiat) ; `click` au clavier (Entrée, Espace). La logique de jeu reste sur `click`. |
| **Cible** | Le vinyle (`#beat-button`). Même composant pour Récolter et le micro, avec leurs propres couleurs. |
| **Déroulement** | *Anticipation* : aucune (un clicker ne doit jamais retarder la réponse). *Action* : le disque s'écrase à 93 % et descend de 1 pixel art ; l'anneau de la platine (`box-shadow` 6 px) passe à 2 px, comme s'il s'enfonçait ; le bras de lecture sursaute de 2°. *Sortie* : rebond à 103 %, puis retour à 100 %. |
| **Durée et rythme** | 180 ms : écrasement 50 ms (`ease-out`), rebond 70 ms, repos 60 ms. |
| **Technique** | Web Animations API sur un enveloppant du vinyle (pas sur `.vinyl-disc`, qui tourne déjà). Remplace l'animation CSS `hit` actuelle. |
| **Interruption** | `restart` depuis l'écrasement : si un clic arrive avant la fin du rebond, le disque reprend l'état écrasé et rebondit de nouveau. En rafale, il reste presque enfoncé et vibre légèrement : ça se lit comme « je martèle ». |
| **Priorité** | P2. Jamais masquée. 06 s'ajoute par-dessus. |
| **Mouvements réduits** | Aucun changement de taille. L'anneau de la platine passe à `--sunset` pendant 80 ms. |
| **Validation** | À 1 clic/s : écrasement et rebond visibles. À 15 clics/s pendant 5 s (mode stress) : pas d'accumulation ; 250 ms après le dernier clic, `getAnimations()` du vinyle est vide et sa taille est de 100 %. |

## 05 — `gain_float`

| Champ | Contenu |
|---|---|
| **Intention** | « Ce clic m'a rapporté ça. » Lire le gain sans quitter le vinyle des yeux. |
| **Déclencheur** | Événements `click` (montant en $), `harvest` (grammes), `show` (hype). |
| **Cible** | Couche d'effets au-dessus de la page, au point de contact (au-dessus du centre de la cible au clavier ; 40 px au-dessus du doigt au tactile). |
| **Déroulement** | *Anticipation* : apparaît à 70 % de sa taille et passe à 100 % en un pas. *Action* : monte de 48 px par pas (8 pas), dérive de côté de ±30 px, légère rotation. *Sortie* : « pop » (grossit à 115 % puis disparaît) au lieu d'un fondu. |
| **Durée et rythme** | 800 ms : apparition 40 ms, montée 640 ms (`steps(8)`), pop 120 ms. |
| **Technique** | Nœud texte de la réserve (6 visibles au maximum, 8 en réserve). Couleur selon la ressource : `--lamp` ($), `--weed` (g), `--pink` (hype). Montant formaté par `formatMoney` / `formatNumber`. |
| **Interruption** | `merge` : si un nombre de même ressource est né il y a moins de 250 ms, il absorbe le nouveau gain (« +12 $ » devient « +48 $ ») et fait un petit sursaut (110 %, 80 ms) au lieu d'en créer un autre. Au-delà de 6 visibles, le plus ancien est recyclé. |
| **Priorité** | P2. Pendant une animation P0, les nouveaux nombres se regroupent sur 500 ms au lieu de 250. |
| **Mouvements réduits** | Pas de montée ni de pop : le nombre s'affiche au-dessus de la cible, reste 600 ms, puis s'estompe. Le regroupement est conservé. |
| **Validation** | 20 clics/s pendant 5 s : jamais plus de 6 nombres dans le DOM ; la somme des montants affichés égale l'argent gagné ; 1 s après le dernier clic, aucun nombre ne reste. |

## 06 — `click_quality` (remplace « clic critique »)

| Champ | Contenu |
|---|---|
| **Intention** | Montrer que le zen rend les beats meilleurs : relier la décision « je me ravitaille » à ce que le joueur ressent sous son doigt. C'est la boucle centrale du jeu. |
| **Déclencheur** | Événement `click` dont `quality` dépasse un seuil. Proposition : **bon beat** à partir de ×1,5 (une dose), **gros beat** à partir de ×2,2 (deux doses). Seuils réglables dans `data/fx.json`. |
| **Cible** | L'étiquette orange du vinyle, et le nombre de 05. |
| **Déroulement** | *Anticipation* : l'étiquette gonfle d'un pixel art pendant l'écrasement de 01. *Action* : 2 notes ♪ (bon beat) ou 4 notes (gros beat) jaillissent de l'étiquette en arc, couleur `--weed` avec contour encre ; le nombre de 05 est 1,3× (bon) ou 1,6× (gros) plus grand avec une ombre verte. *Sortie* : les notes retombent de 6 pixels art et éclatent en « pop ». |
| **Durée et rythme** | 420 ms : jaillissement 175 ms (¼ temps), retombée 175 ms, pop 70 ms. |
| **Technique** | Particules de la réserve (sprite note 5 × 7 généré par `scripts/sprites/`), Web Animations API, trajectoire en arc. Le style du nombre est une variante de 05. |
| **Interruption** | `stack` limité : au plus une gerbe de notes toutes les 250 ms (sinon, sous zen, chaque clic en lancerait une). Le grossissement du nombre suit chaque clic, via le regroupement de 05. |
| **Priorité** | P2, au-dessus de 01. Notes ÷ 2 pendant un P0. Masquée par rien. |
| **Mouvements réduits** | Pas de notes. Le nombre garde sa taille et sa couleur de bon/gros beat : l'information « ce beat vaut plus » reste. |
| **Validation** | Sans zen : jamais de note. Une dose : 2 notes, nombre 1,3×. Deux doses : 4 notes, nombre 1,6×. À 15 clics/s sous zen : au plus 4 gerbes par seconde et jamais plus de 32 particules au total. |

## 11 — `char_breathe`

| Champ | Contenu |
|---|---|
| **Intention** | Le personnage est vivant et dans l'ambiance du sous-sol ; son état se lit sur son corps. |
| **Déclencheur** | Permanent, dès que le personnage est affiché (QG et serre). Le rythme change selon l'état : normal, zen (`state.high > 0`), fail out (`state.failOut`). |
| **Cible** | Le sprite du personnage (`.sprite` dans `#qg-character` et `#serre-character`). |
| **Déroulement** | Boucle sur 2 temps. *Normal* : alterne les 2 images existantes + monte d'un pixel art à l'inspiration. *Zen* : 1,5× plus lent, balancement latéral d'un pixel art (il plane). *Fail out* : 1,5× plus lent, posé un pixel art plus bas (les épaules tombent). |
| **Durée et rythme** | Normal 1,4 s (2 temps à 86 BPM, la durée actuelle) ; zen et fail out 2,1 s. Tout en `steps()`, aucun mouvement continu. |
| **Technique** | Animation CSS sur le sprite existant, vitesse liée à `--tempo` ; une classe d'état posée par `view.update`. Aucune nouvelle image. |
| **Interruption** | Un changement d'état attend la fin du cycle en cours pour ne pas faire sauter le sprite. Les réactions ponctuelles du personnage (lots suivants) suspendent la respiration puis la reprennent. |
| **Priorité** | P3. Mise en pause si l'onglet est caché. |
| **Mouvements réduits** | Image fixe (vue de face, image 1), comme aujourd'hui. L'état reste lisible grâce aux effets de scène existants (brume, grisaille). |
| **Validation** | Mesurer la période : 1,4 s au normal, 2,1 s en zen et en fail out. Passer de normal à zen en plein cycle : aucun saut de position visible. |

## 22 — `coins_to_counter`

| Champ | Contenu |
|---|---|
| **Intention** | L'argent rentre tout seul : les producteurs travaillent pour toi. Rendre visible le revenu automatique, invisible aujourd'hui. |
| **Déclencheur** | Toutes les 1,5 s, si les producteurs ont rapporté de l'argent depuis le dernier envoi (montant cumulé par l'affichage, pas par la logique). |
| **Cible** | Départ : le vinyle (studio) ou le haut de la scène (serre, carte). Arrivée : le compteur « le cash » dans l'en-tête. |
| **Déroulement** | *Anticipation* : les pièces sortent du disque en éventail de 8 pixels art, décalées de 40 ms l'une après l'autre. *Action* : trajectoire courbe vers le compteur, en accélérant (`ease-in`) : elles sont « aspirées ». *Sortie* : chaque pièce rétrécit et disparaît dans le compteur avec un éclat d'un pixel ; l'arrivée de la première fait grossir le compteur d'un cran (version minimale de 24, complétée au lot 3). |
| **Durée et rythme** | 650 ms par pièce, 3 à 6 pièces : de 650 à 850 ms en tout. |
| **Technique** | Sprite pièce 6 × 6 (`--lamp`, contour encre) généré par `scripts/sprites/`, nœuds de la réserve, Web Animations API. Nombre de pièces : 1 + log₁₀ du montant cumulé, entre 1 et 6. En fail out, mêmes pièces, ternies. |
| **Interruption** | `stack` jusqu'à 18 pièces en vol ; au-delà, l'envoi est sauté et son montant reporté au suivant. |
| **Priorité** | P2 (sous les clics). Envois suspendus pendant un P0 et quand l'onglet est caché. |
| **Mouvements réduits** | Aucune pièce. Le compteur prend la couleur `--paper-2` pendant 200 ms à chaque envoi. |
| **Validation** | Avec des producteurs : un envoi toutes les 1,5 s, jamais plus de 18 pièces visibles. Sans producteur : aucune pièce. Onglet caché 1 min puis revenu : pas de pluie de rattrapage. |

## 32 — `ui_press`

| Champ | Contenu |
|---|---|
| **Intention** | Chaque bouton papier se comporte comme un autocollant qu'on enfonce : même sensation partout. |
| **Déclencheur** | `pointerdown` / `pointerup` (et Espace / Entrée au clavier) sur les boutons papier : `.btn`, `.shop-item`, `.tab`, `.scene-tab`, cartes de personnage. |
| **Cible** | Le bouton appuyé. |
| **Déroulement** | *Anticipation* : aucune. *Action* : le bouton glisse sur son ombre (décalage égal à l'ombre, l'ombre tombe à 0) en 40 ms. *Sortie* : au relâchement, revient en 3 pas avec un dépassement d'un pixel. |
| **Durée et rythme** | 40 ms à l'appui, 120 ms au relâchement (`steps(3)`). |
| **Technique** | CSS : unifie les règles `:active` déjà présentes (`.btn`, `.shop-item`, `.character-card`) en une classe `.is-pressed` posée par JavaScript, pour que le tactile iOS réagisse et que le dépassement soit possible. |
| **Interruption** | `restart` : un nouvel appui reprend l'état enfoncé. |
| **Priorité** | P1. Jamais masquée. |
| **Mouvements réduits** | L'enfoncement est conservé (petit, sans effet vestibulaire), sans le dépassement. |
| **Validation** | Tous les boutons listés ont le même mouvement au doigt et à la souris. Un bouton désactivé (verrouillé ou déjà installé) ne s'enfonce pas. |

## 34 — `ui_refuse`

| Champ | Contenu |
|---|---|
| **Intention** | « Pas assez de cash » — sans punir ni alarmer, et en disant combien il manque. |
| **Déclencheur** | Clic sur un achat trop cher : articles des boutiques, « Se ravitailler », « Joint maison », « Promo », « Échantillons ». L'action de jeu renvoie déjà une liste vide quand l'argent manque ; l'affichage lance alors le refus. |
| **Cible** | Le prix de l'article (`.shop-item-cost`, `.btn-price`). |
| **Déroulement** | *Anticipation* : aucune. *Action* : le prix fait « non » (3 allers-retours de ±2 px) et une étiquette papier « il manque 85 $ » sort sous le prix. *Sortie* : l'étiquette se replie après 1,2 s. Pour un article verrouillé par palier, c'est le cadenas 🔒 qui bascule à la place. |
| **Durée et rythme** | Secousse 240 ms (`steps(6)`), étiquette affichée 1,2 s. |
| **Technique** | Web Animations API. **Changement nécessaire** : un bouton trop cher reçoit `aria-disabled="true"` et la classe `is-short` au lieu de `disabled` (sinon le clic n'existe pas). `disabled` reste pour « verrouillé » et « installé ». Bonus : ces boutons restent atteignables au clavier. |
| **Interruption** | `ignore` pendant la secousse ; un nouveau clic après la secousse prolonge l'étiquette. |
| **Priorité** | P1, discrète. Ne touche pas au compteur d'argent (pour ne pas confondre avec une perte). |
| **Mouvements réduits** | Pas de secousse : le prix est souligné en `--danger` pendant 400 ms ; l'étiquette « il manque… » apparaît pareil. |
| **Validation** | Cliquer 10 fois vite sur un article trop cher : au plus 4 secousses, l'argent ne change pas, l'étiquette affiche le bon montant manquant. Dès que l'argent suffit, le bouton redevient un vrai bouton d'achat. |

## 41 — `shop_buy`

| Champ | Contenu |
|---|---|
| **Intention** | « C'est à moi. » Un achat se sent comme un tampon de caisse, et on voit ce qui change (nombre possédé, nouveau prix). |
| **Déclencheur** | `buyProducer`, `buyUpgrade`, `buyEquipment`, `buyStrain`. |
| **Cible** | La ligne de la boutique : badge ×N (`.shop-item-owned`), prix (`.shop-item-cost`). |
| **Déroulement** | *Anticipation* : l'enfoncement de 32. *Action* : le badge ×N saute (140 %, puis 100 % avec un dépassement) et affiche le nouveau nombre ; le prix défile (l'ancien sort vers le haut, le nouveau entre par le bas). Pour une déco du QG (achat unique), un tampon « INSTALLÉ » tombe sur la ligne, penché de −8°. *Sortie* : le tampon reste (c'est l'état « installé au QG ») ; le reste revient au repos. |
| **Durée et rythme** | Badge 240 ms, prix 160 ms, tampon 350 ms (½ temps). |
| **Technique** | Web Animations API ; mouvement « tampon » partagé avec FAIL OUT et 45. Couleur du badge selon la ressource payée ($ ou grammes). Le vol de l'argent vers l'article est 28 (lot 3), la déco qui se pose dans le QG est 42 (lot 4). |
| **Interruption** | `restart` pour le badge (achats répétés : il saute à chaque fois) ; `merge` pour le prix (il affiche directement le dernier prix). |
| **Priorité** | P1. |
| **Mouvements réduits** | Pas de saut ni de défilement : le badge et le prix changent avec un contour `--sunset` de 400 ms ; le tampon apparaît en fondu. |
| **Validation** | Acheter 10 boîtes à rythmes vite : le badge finit sur ×10, le prix affiché est le bon, aucune animation ne reste active 500 ms après. Acheter une déco : tampon visible, bouton désactivé. |

## 45 — `tier_up`

| Champ | Contenu |
|---|---|
| **Intention** | Un vrai moment de carrière : « Tu es maintenant Buzz local ». Fierté, et un peu de ridicule. |
| **Déclencheur** | `tierUp` (avec `name`). |
| **Cible** | La scène visible (QG, serre ou carte), la pastille « palier » de l'en-tête, le personnage s'il est affiché. |
| **Déroulement** | *Anticipation* (200 ms) : la pastille rose « palier » gonfle et tremble d'un pixel. *Action* : une bannière autocollant `--sunset` « NOUVEAU PALIER — Buzz local » tombe sur la scène comme le tampon FAIL OUT (2× → 1×, penchée de +6°) ; 24 confettis carrés (`--lamp`, `--pink`, `--paper`) jaillissent de la bannière ; le personnage saute de 4 pixels art et s'écrase à l'atterrissage. *Sortie* : la bannière se décolle (rotation et sortie vers le haut) ; la pastille affiche le nouveau nom. |
| **Durée et rythme** | 2,4 s : anticipation 200 ms, tampon 350 ms, tenue 1,5 s, décollage 350 ms. |
| **Technique** | Bannière en HTML/CSS (texte lisible et traduisible), confettis de la réserve, Web Animations API. Le saut du personnage est fait par déplacement du sprite (aucune nouvelle image) en attendant 15 `char_cheer`. |
| **Interruption** | `queue` (P0). Plusieurs paliers d'un coup (chargement d'une sauvegarde) : une seule bannière avec le dernier palier et « +2 paliers ». Un déblocage de zone qui suit (serre, carte) attend la fin de la bannière. |
| **Priorité** | P0. Les particules de clic sont divisées par 2 pendant la bannière. La bannière ne bloque jamais le clic (`pointer-events: none`) et ne couvre pas le vinyle. |
| **Mouvements réduits** | Bannière en fondu de 150 ms, sans tampon, sans confettis, sans saut ; même texte, même durée de tenue. |
| **Validation** | Déclencher 5 `tierUp` en 1 s : une seule bannière avec le dernier palier. Cliquer sur le vinyle pendant la bannière : les gains comptent. 3 s après, aucun confetti ni bannière dans le DOM. |

## 55 — `territory_conquered` (remplace « obtention d'un succès »)

| Champ | Contenu |
|---|---|
| **Intention** | « Ce territoire est à moi pour toujours » : une récompense permanente qui ouvre la suite de la carte. |
| **Déclencheur** | `territoryConquered` (avec `id`, `name`). La conquête arrive souvent toute seule (la hype monte avec les fans), parfois pendant que le joueur est au studio. |
| **Cible** | Sur la carte : le marqueur du territoire, les liens vers ses voisins, la fiche du territoire. Hors de la carte : l'onglet « La carte » et la pastille « territoires ». |
| **Déroulement** | *Si le joueur est sur la carte* — *Anticipation* : la barre de hype se bloque à 100 %. *Action* : un drapeau pixel tombe dans le marqueur comme un tampon, le marqueur devient rose ; deux anneaux carrés s'étendent sur la carte par pas ; les routes vers les territoires qui s'ouvrent se tracent une par une et leurs marqueurs apparaissent en pop. *Sortie* : un autocollant « CONQUIS » se pose sur la fiche, avec la ligne du bonus surlignée en `--lamp`. *Si le joueur est ailleurs* : la pastille « territoires » saute, l'onglet « La carte » reçoit le signal « nouveau », et la séquence complète se joue une seule fois à la prochaine ouverture de la carte. |
| **Durée et rythme** | 2,2 s : drapeau 350 ms, anneaux 400 ms, routes 500 ms (+120 ms par route), autocollant 350 ms. |
| **Technique** | SVG existant pour les routes (`stroke-dashoffset`), sprite drapeau 7 × 9 généré, Web Animations API. Une file mémorise les conquêtes non vues (pas besoin de la sauvegarder : au rechargement, l'état final s'affiche simplement). |
| **Interruption** | `queue` (P0) : deux conquêtes rapprochées se jouent l'une après l'autre. Changer de scène pendant la séquence l'arrête proprement (l'état final s'affiche). |
| **Priorité** | P0. Ne bloque pas le bouton « Faire un show ». |
| **Mouvements réduits** | Le marqueur change de couleur, le drapeau et l'autocollant apparaissent en fondu, les routes passent à leur état final, la ligne du bonus est surlignée 2 s. |
| **Validation** | Conquête vue sur la carte : séquence complète, état final identique à celui d'un rechargement. Conquête au studio : signal sur l'onglet, séquence jouée une seule fois à l'ouverture de la carte. Deux conquêtes à la suite : jouées dans l'ordre, sans chevauchement. |

---

## Production

| Fichier | Rôle |
|---|---|
| `src/ui/fx/fx.js` | Point d'accès commun : `fx.play(id, options)`, `fx.onGameEvent(event)`, `fx.update(dt)` |
| `src/ui/fx/pool.js` | Réserve de nœuds réutilisables |
| `src/ui/fx/motion.js` | Mouvements réduits (auto / réduits / complets) et vitesse globale |
| `src/ui/fx/catalog.js` | Fiche courte de chaque animation, et quel événement du jeu lance quoi |
| `src/ui/fx.css` | Styles et keyframes des effets, respiration, enfoncement, règles en mouvements réduits |
| `data/fx.json` | Plafonds, seuils du gros beat, durées de tenue (vérifié par `npm test`) |
| `scripts/sprites/effets.js` | Sprites pièce, note, drapeau → `assets/images/effets/` (`npm run sprites`) |
| `demo/animations.html` + `demo.js` | Démonstration |

Branchement dans le jeu : `main.js` passe chaque événement à `fx.onGameEvent` (à côté de l'audio), lance 05/06 au clic et transmet le revenu automatique pour 22. `view.js` lance 01 au `pointerdown`, 34 sur les achats trop chers, l'humeur de 11 à chaque mise à jour, et fournit les « ancres » (où sont le compteur, les lignes de boutique, les marqueurs...). Nouveau lien « Animations : auto / réduites / complètes » dans le pied de page.

### Écarts par rapport aux fiches

- **11** : les deux images existantes font déjà monter le haut du corps d'un pixel ; on n'ajoute pas de déplacement du sprite entier (les pieds flotteraient). En fail out, le personnage ne « descend » pas : il garde la pose affaissée (2ᵉ image) les trois quarts du cycle.
- **34** : un article verrouillé par palier fait « non » avec son texte 🔒, sans étiquette (il ne manque pas d'argent, il manque un palier).
- **45 et 55** : la file des récompenses majeures ignore une conquête déjà en cours ou en file pour le même territoire, et garde au plus 4 récompenses en attente (la plus ancienne saute ; son résultat est déjà affiché). Découvert en mode stress : une conquête toutes les 3 s finissait par s'accumuler sans fin.
- **41** : le tampon « INSTALLÉ » reste affiché sur les déco achetées (c'est maintenant un état de la boutique, visible aussi après rechargement).

## Démonstration

`npm start`, puis http://localhost:8000/demo/animations.html. Elle utilise les mêmes fichiers que le jeu (`src/ui/fx/`, `fx.css`, `shopRow` de `view.js`).
- un bouton par animation, avec des valeurs réalistes ; « Rejouer la dernière » (ou touche R) ;
- vitesse de 0,25× à 2×, mouvements auto / réduits / complets ;
- niveau de zen (pour 06), humeur (pour 11), producteurs actifs (pour 22), « le joueur regarde la carte » (pour tester la conquête mise de côté) ;
- mode stress : 20 clics/s sous zen, pièces en continu, et toutes les 3 s un palier + une conquête + un achat + un refus ; le panneau affiche les images/s, les nœuds actifs et leurs maximums.

## Résultats de vérification (15 novembre 2026)

Mesurés dans le panneau navigateur de Claude (Chromium, ordinateur), page visible. Aucune erreur dans la console. `npm test` : 34 tests passent.

| # | Critère | Résultat |
|---|---|---|
| 01 | 15 clics/s pendant 2 s, puis 250 ms : plus aucune animation, taille 100 % | ✅ 0 animation, `transform: none` |
| 05 | 20 clics/s pendant 3 s : jamais plus de 6 nombres ; 1 s après, plus rien | ✅ max 4 (regroupement), 0 après |
| 05 | 40 clics dans la même image : un seul nombre au total cumulé | ✅ « +53.5 $ » pour 40 clics dans le jeu |
| 06 | À jeun : aucune note | ✅ 0 |
| 06 | Deux doses, 15 clics/s : ≤ 4 gerbes/s, ≤ 32 particules, nombre « gros » | ✅ 3,8 gerbes/s, max 8 particules, classe `is-big` |
| 11 | Période : 1,4 s normal, 2,1 s zen et fail out ; changement au bout du cycle | ✅ 1400 / 2100 / 2100 ms ; l'humeur change à la fin du cycle en cours |
| 22 | 20 envois d'un coup : jamais plus de 18 pièces ; plus rien ensuite | ✅ max 18, 0 après |
| 32 | Appui : enfoncé ; relâché : retour avec dépassement, puis propre | ✅ décalé de 3 px, classe retirée après 120 ms |
| 34 | 10 clics en 0,5 s : au plus 4 secousses ; bon montant manquant ; étiquette retirée | ✅ 2 secousses, « il manque 35.4 $ » dans le jeu, retirée |
| 41 | 10 achats rapides : ×13 affiché, rien d'actif 500 ms après ; tampon d'une déco | ✅ ×13, 0 animation, 0 fantôme, tampon visible |
| 45 | 5 paliers en 1 s : une seule bannière, avec le dernier palier ; rien ne reste | ✅ 1 bannière « Star nationale », 0 nœud après |
| 55 | Deux conquêtes de suite : jouées l'une après l'autre, sans chevauchement | ✅ 2 séquences, jamais 2 drapeaux à la fois |
| 55 | Conquête hors de la carte : signal sur l'onglet, séquence à l'ouverture | ✅ 1 en attente + onglet signalé, jouée au retour sur la carte |
| Réduit | Pas de déplacement, ni notes, ni confettis ; l'information reste | ✅ nombre fixe mais « gros », bannière en fondu (2,3 s), respiration figée |
| Stress | 10 s : fluidité et plafonds | ✅ 60 images/s, pire image 18 ms, max 32 nœuds sur 80, file ≤ 2, tout se vide à l'arrêt |

### Limites connues

- Mesures faites sur ordinateur seulement : **aucun téléphone testé**. Les budgets restent à confirmer sur l'appareil le plus faible visé.
- Quand l'onglet est caché, le navigateur met les animations en pause ; au retour, celles qui étaient en cours se terminent. Les pièces ne rattrapent pas le temps perdu (voulu).
- 45 et 55 n'ont pas pu être déclenchés par une vraie partie pendant la vérification (il faut atteindre un palier ou conquérir un territoire) : ils ont été vérifiés dans la démo, qui passe par le même code. Le branchement aux événements `tierUp` et `territoryConquered` est en place.
- La respiration de la sélection de personnage reste « normale » (pas d'humeur avant la partie).
- Les nouveaux moments n'ont pas encore de son (`data/sounds.json`, volet C).

## Informations manquantes

Ces points empêchent une production tout à fait fidèle. Le pilote a été produit avec la proposition par défaut de chacun (points 6, 7 et 9 appliqués tels quels).

1. **Nom du jeu.** Le brief dit « QJ Clicker » ; le dépôt s'appelle « Clicker du QG ». Je suppose que c'est le même jeu.
2. **Appareils ciblés.** La mise en page descend jusqu'au téléphone, mais aucun appareil n'est fixé. Il faut savoir quel est le téléphone le plus faible visé (et si le jeu sera joué surtout au doigt) pour confirmer les budgets. Par défaut : navigateurs récents sur ordinateur et un téléphone milieu de gamme de 2021.
3. **Qui valide le style, et qui touche à quoi.** Les animations vivent dans `src/ui/` et `style.css`, que le volet B (branche `visuel`) peut aussi modifier : risque de conflits. Proposition : les effets dans des fichiers séparés (`src/ui/fx/`, `src/ui/fx.css`) et une validation du lot pilote par la personne du volet B.
4. **Images du personnage.** Les feuilles n'ont que 2 images par vue. Clignement, saut, étourdissement et accessoires (12, 15, 16, 19) demandent de nouvelles images. Comme elles sont dessinées en code (`scripts/sprites/characters.js`), je peux les ajouter moi-même si le volet B est d'accord.
5. **Décor en une seule image.** `qg/fond.png` est plat : pour animer le ring light, la laveuse ou les vinyles du plafond (72), il faut les séparer en calques. Même question : je le fais dans `scripts/sprites/qg.js`, ou le volet B ?
6. **Seuils du gros beat (06).** Proposé : ×1,5 et ×2,2. À confirmer avec l'équilibrage du cannabis.
7. **Refus (34).** Il faut remplacer `disabled` par `aria-disabled` sur les boutons trop chers (changement du volet A, sans impact sur la logique). D'accord ?
8. **Sons.** Les nouveaux moments (refus, pièces, gros beat) n'ont pas de clé dans `data/sounds.json`. À annoncer au volet C.
9. **Option mouvements réduits.** Proposé : un lien dans le pied de page à côté de « Couper le son ». D'accord sur l'emplacement ?
10. **Prestige.** La « station lunaire » est sur la feuille de route mais pas codée : 77 et 78 portent pour l'instant sur l'ambiance du QG et la radio. À revoir si le prestige arrive avant le lot 7.
