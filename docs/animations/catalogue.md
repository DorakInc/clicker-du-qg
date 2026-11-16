# Catalogue des 80 animations — Clicker du QG

Adapté aux mécaniques qui existent vraiment dans le jeu (branche `gameplay`, novembre 2026). Une proposition du brief qui ne correspondait à aucune mécanique est **remplacée** par un moment réel du jeu ; aucune mécanique n'a été inventée pour justifier une animation.

Légende des statuts :
- **Pilote** : dans le lot pilote ([lot-pilote.md](lot-pilote.md)) — **produit et branché, en attente de validation du style**.
- **À produire** : fiche à écrire dans un lot suivant.
- **Existe** : une version simple est déjà dans le jeu ; elle sera refaite selon la [charte](charte.md).
- **Adaptée** : l'intention du brief est gardée, la cible ou le déclencheur change.
- **Remplacée** : le brief visait une mécanique absente ; l'animation porte sur autre chose.
- **Dépend du visuel** : demande de nouvelles images (volet B ou `scripts/sprites/`).

Déclencheur = type d'événement du jeu (`src/game/`) ou état lu par l'affichage.

## A — Clics et réactions immédiates

| # | Identifiant | Ce que ça devient | Déclencheur réel | Statut |
|---|---|---|---|---|
| 01 | `click_squash` | Le vinyle s'enfonce dans la platine et rebondit | `click` | Pilote · Existe |
| 02 | `click_ripple` | Onde en anneaux nets qui suit les sillons du vinyle depuis le point touché | `click` | À produire |
| 03 | `click_burst` | Petits carrés de « poussière de vinyle » projetés | `click` | À produire |
| 04 | `click_spark` | Étincelle en croix d'un pixel sous le diamant du bras | `click` | À produire |
| 05 | `gain_float` | Nombre de gain qui monte par pas puis éclate | `click`, `harvest`, `show` | Pilote · Existe |
| 06 | `click_quality` | **Le gros beat** : clic amplifié quand le niveau de zen rend les beats meilleurs | `click` avec `quality` au-dessus du seuil | Pilote · Remplacée (pas de clic critique dans le jeu) |
| 07 | `harvest_click` | Clic dans la serre : la plante plie, des feuilles volent | `harvest` | Remplacée (pas de combo) |
| 08 | `click_directional` | Le vinyle penche du côté touché (bord gauche, droit, haut, bas) | `click` + position | À produire |
| 09 | `burst_hot` | « Le disque chauffe » : au-delà de 8 clics/s, le vinyle tourne plus vite et fume un peu | rythme de clic mesuré par l'affichage | Adaptée (seuil visuel seulement, sans effet de jeu) |
| 10 | `burst_end` | Fin de rafale : le disque refroidit et un total « rafale » s'affiche | 600 ms sans clic après une rafale | Adaptée |

## B — Vie et personnalité (le personnage au QG et à la serre)

La cible du clic est un objet (vinyle) ; la personnalité est portée par le personnage choisi (Xavier, Nathan ou Émile).

| # | Identifiant | Ce que ça devient | Déclencheur réel | Statut |
|---|---|---|---|---|
| 11 | `char_breathe` | Respiration calée sur le tempo, selon l'état (normal, zen, fail out) | repos permanent | Pilote · Existe |
| 12 | `char_blink` | Clignement des yeux, irrégulier | repos (toutes les 3 à 6 s) | À produire · Dépend du visuel (1 image) |
| 13 | `char_look` | Se tourne vers le pointeur (vues profil existantes) | position du pointeur | À produire |
| 14 | `char_ready` | Se penche vers la platine quand le pointeur survole le vinyle | survol du vinyle | À produire |
| 15 | `char_cheer` | Petit saut de joie | `buyUpgrade`, `tierUp`, `territoryConquered` | À produire · Dépend du visuel |
| 16 | `char_dizzy` | Étourdi quand il est « trop gelé » (spirales, roulis) | état `isOverdosed` / `overdose` | Adaptée (rafale → surconsommation, mécanique réelle) |
| 17 | `char_impatient` | Tape du pied, regarde son téléphone | 20 s sans aucune action | À produire |
| 18 | `char_zen` | Pose détendue, paupières mi-closes pendant le zen | `state.high > 0` | Adaptée (le bonus du jeu = le cannabis) |
| 19 | `char_tier_style` | Un accessoire de plus par palier (chaîne, lunettes, casquette...) | `tierIndex` | À produire · Dépend du visuel |
| 20 | `char_recover` | S'ébroue et se redresse | `cannabisEmpty`, `failEnd` | À produire |

## C — Ressources ($, grammes, fans, hype)

Le jeu n'a ni pièces ni gemmes comme objets : l'argent est un nombre. Les pièces sont donc une **représentation** de l'argent, pas une ressource nouvelle.

| # | Identifiant | Ce que ça devient | Déclencheur réel | Statut |
|---|---|---|---|---|
| 21 | `coin_pop` | Une pièce saute du vinyle (au plus 1 clic sur 4) | `click` | À produire |
| 22 | `coins_to_counter` | Groupe de pièces aspiré vers « le cash » | revenu automatique, regroupé toutes les 1,5 s | Pilote |
| 23 | `grams_leaf` | Feuille qui tourne et scintille vers le compteur de grammes | pousse automatique de la serre | Remplacée (pas de gemme → les grammes) |
| 24 | `counter_pulse` | « Le cash » grossit d'un cran à chaque arrivée | arrivée de 21, 22, 25 | À produire |
| 25 | `income_milestone` | Pluie de billets quand le revenu par seconde franchit une puissance de 10 | `incomePerSecond` passe 10, 100, 1 K... | Adaptée |
| 26 | `plant_cycle` | Un plant arrive à maturité et lâche quelques grammes | cycle des plants (déjà à 3 stades) | Adaptée |
| 27 | `joint_roll` | Les grammes se roulent en joint maison | `jointHomegrown` | Remplacée (pas de collecte accumulée) |
| 28 | `spend_fly` | L'argent part du compteur vers l'article acheté | `buyProducer`, `buyUpgrade`, `buyEquipment` | À produire |
| 29 | `stash_refill` | Le sachet tombe dans « le stash », la jauge de zen monte | `cannabisBuy` | Remplacée (pas de fusion de ressources) |
| 30 | `resource_reveal` | Une nouvelle pastille (« la récolte », « territoires ») apparaît dans la barre | `greenhouseUnlock`, `mapUnlock` | Adaptée |

## D — Boutons, menus et navigation

| # | Identifiant | Ce que ça devient | Déclencheur réel | Statut |
|---|---|---|---|---|
| 31 | `ui_hover` | Le papier se soulève (ombre plus longue, rotation légère) | survol / focus clavier | Existe (boutique) |
| 32 | `ui_press` | Le bouton glisse sur son ombre et revient | appui sur tout bouton papier | Pilote · Existe |
| 33 | `ui_confirm` | Petit tampon ✓ sur le bouton | `campaignStart`, `promo`, `samples` | À produire |
| 34 | `ui_refuse` | Le prix fait « non » et affiche ce qui manque | clic sur un achat trop cher | Pilote · Adaptée (demande un changement des boutons) |
| 35 | `ui_enable` | Un bouton devient cliquable : il se « décolle » de la page | « Se ravitailler », « Joint maison », « Promo », « Échantillons » qui deviennent abordables | À produire |
| 36 | `feed_in` | Un message glisse dans le téléphone QGram | `showMessage` | Existe · Adaptée (pas de panneaux qui s'ouvrent) |
| 37 | `feed_out` | Le plus vieux message sort du téléphone au lieu de disparaître d'un coup | 6ᵉ message | Adaptée |
| 38 | `tab_switch` | Onglets de la boutique : l'onglet actif s'enfonce, la liste glisse | clic sur un onglet | À produire |
| 39 | `tooltip_in` | Info-bulle papier (seuil de fail out, seuil « trop gelé », territoires) | survol / appui long | À produire |
| 40 | `new_badge` | Signal « nouveau » sur un onglet, plus doux que le clignotement actuel | onglet `is-new` | Existe · à refaire |

## E — Améliorations et progression

| # | Identifiant | Ce que ça devient | Déclencheur réel | Statut |
|---|---|---|---|---|
| 41 | `shop_buy` | Achat dans la boutique : tampon, compteur ×N qui saute, prix qui défile | `buyUpgrade`, `buyProducer`, `buyEquipment`, `buyStrain` | Pilote |
| 42 | `qg_install` | La déco achetée se pose dans le QG | `buyUpgrade` (vue du QG) | À produire · Dépend du visuel (images `qg/<id>.png`) |
| 43 | `spin_up` | Le vinyle passe à la vitesse supérieure | changement de palier de vitesse (`--spin`) | Adaptée |
| 44 | `production_pulse` | Le bras de lecture et un vumètre battent au rythme de la production | `beatsPerSecond > 0` | Adaptée · Dépend du visuel pour un producteur par image |
| 45 | `tier_up` | Passage de palier de carrière | `tierUp` | Pilote |
| 46 | `meter_full` | Une barre atteint son maximum (hype d'un territoire, fans avant palier) | jauge à 100 % | À produire |
| 47 | `shop_unlock` | Un article verrouillé (pointillés) devient disponible | changement de palier → `requiresTier` atteint | Adaptée |
| 48 | `strain_level` | Une variété monte de niveau | `buyStrain` | Remplacée (pas de palier d'équipement) |
| 49 | `shop_affordable` | Un article devient abordable : le prix passe du rouge à l'encre avec un reflet | argent ≥ coût | À produire |
| 50 | `campaign_start` | Lancement d'une campagne : le marqueur devient le QG de campagne | `campaignStart` | Remplacée (pas de synergie) |

## F — Récompenses et événements

Le jeu n'a ni coffres, ni succès, ni récompense quotidienne, ni événement temporaire. Ces emplacements portent les moments forts qui existent.

| # | Identifiant | Ce que ça devient | Déclencheur réel | Statut |
|---|---|---|---|---|
| 51 | `promo_blast` | Mégaphone de promo, la hype bondit | `promo` | Remplacée |
| 52 | `samples_drop` | Sachets d'échantillons lancés sur le territoire | `samples` | Remplacée |
| 53 | `fan_reaction` | Message de fan avec cœur dans QGram | réaction des fans (toutes les 25 s) | Remplacée |
| 54 | `fans_trend` | Flèche ▲▼ des abonnés qui change de sens | tendance des fans | Remplacée |
| 55 | `territory_conquered` | Conquête d'un territoire (le « succès » du jeu) | `territoryConquered` | Pilote · Remplacée |
| 56 | `character_select` | Sélection du personnage façon jeu de combat | choix au premier lancement | Remplacée |
| 57 | `fail_start` | Le QG se ternit, tampon FAIL OUT | `failStart` | Existe · Remplacée |
| 58 | `broke_alert` | Portefeuille vide, papillon qui s'envole | `broke` | Remplacée |
| 59 | `fail_end` | Les couleurs reviennent, le tampon se décolle | `failEnd` | Remplacée |
| 60 | `offline_return` | Bilan du retour : les gains de l'absence arrivent d'un bloc | retour hors ligne (`applyOffline`) | À produire |

## G — Bonus et moments forts

Le seul bonus temporaire du jeu est le zen (cannabis) : il multiplie la valeur des beats, s'estompe avec le temps et peut déborder en « trop gelé ».

| # | Identifiant | Ce que ça devient | Déclencheur réel | Statut |
|---|---|---|---|---|
| 61 | `zen_start` | Le multiplicateur « beats ×N » apparaît et la brume entre | `cannabisBuy`, `jointHomegrown` | Adaptée |
| 62 | `zen_aura` | Brume verte et fumée dans le QG | `state.high > 0` | Existe · à refaire |
| 63 | `hype_meter` | La barre de hype se remplit en continu | campagne en cours | Remplacée (pas de jauge de combo) |
| 64 | `overdose_cross` | La jauge franchit le seuil « trop gelé », le QG se met à tanguer | `overdose` | Remplacée |
| 65 | `rival_pushback` | Le rival repousse la hype, la barre recule | défense du rival > hype par seconde | Remplacée (pas de frénésie) |
| 66 | `production_slow` | « Tape stop » : le vinyle ralentit quand la production chute | `productionFactor < 1` (trop gelé, fail out) | Adaptée |
| 67 | `show_click` | Clic sur le micro : la foule saute, une note part vers le territoire | `show` | Remplacée (pas de clic au bon moment) |
| 68 | `zen_fading` | Avertissement discret : la jauge de zen passe sous 15 % | `state.high` bas | Adaptée |
| 69 | `zen_end` | La brume se dissipe, le multiplicateur retombe à ×1,00 | `cannabisEmpty` | Adaptée |
| 70 | `fans_record` | Nouveau record d'abonnés après une baisse | `peakFans` dépassé après un recul d'au moins 10 % | Adaptée |

## H — Monde et grandes transitions

| # | Identifiant | Ce que ça devient | Déclencheur réel | Statut |
|---|---|---|---|---|
| 71 | `ambient_particles` | Poussière dans la lumière du QG, lucioles dans la serre, étoiles sur la carte | repos | À produire |
| 72 | `decor_idle` | Le ring light grésille, la laveuse tourne, les vinyles du plafond bougent | repos | À produire · Dépend du visuel (le décor est une seule image) |
| 73 | `scene_switch` | Passage studio ↔ serre ↔ carte | onglets de scène | À produire |
| 74 | `zone_reveal` | Révélation de la serre puis de la carte | `greenhouseUnlock`, `mapUnlock` | À produire |
| 75 | `rival_enter` | Le rival entre sur la carte (nom, silhouette) | `campaignStart` avec rival | Remplacée (pas de visiteur spécial) |
| 76 | `rival_exit` | Le rival vaincu quitte la carte | `territoryConquered` d'un territoire à rival | Remplacée |
| 77 | `qg_mood` | Le QG s'anime quand les fans montent, se ternit quand ils baissent | tendance des fans | Remplacée · **réservée au prestige** (feuille de route, pas encore codé) |
| 78 | `radio_flash` | QG FM interrompt son bandeau pour un « flash spécial » | P0 (palier, conquête, déblocage) | Remplacée · **réservée au prestige** |
| 79 | `empire_milestone` | Grand jalon : conquête de la Lune ou dernier palier | dernier territoire / dernier palier | À produire |
| 80 | `signature_liftoff` | **Le sous-sol décolle** : le QG part en orbite, le vinyle devient une planète | atteindre « Légende intergalactique » | À produire · Dépend du visuel |

## Lots

| Lot | Animations | État |
|---|---|---|
| Pilote | 01, 05, 06, 11, 22, 32, 34, 41, 45, 55 | Produit, branché au jeu, vérifié ; en attente de validation du style |
| 1 | 02, 03, 04, 07, 08, 09, 10, 21, 24, 67 — les trois cibles de clic | — |
| 2 | 12 à 20, 56 — le personnage | — |
| 3 | 23, 25 à 30, 31, 33, 35 — ressources et premiers retours d'interface | — |
| 4 | 36 à 40, 42 à 44, 46, 47 — interface et progression | — |
| 5 | 48 à 54, 57 à 59 — progression, carte et événements | — |
| 6 | 60 à 66, 68 à 70 — zen, retour hors ligne, moments forts | — |
| 7 | 71 à 80 — monde et grandes transitions (77 et 78 à revoir si le prestige est codé d'ici là) | — |

La répartition pourra bouger après le pilote, en gardant 10 animations par lot.
