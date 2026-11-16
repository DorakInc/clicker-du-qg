# Plan de match - Clicker du QG

Document de référence pour les trois membres de l'équipe. Chacun peut le donner à son agent IA pour savoir quoi faire dans son volet. Le concept de golf est abandonné : ce plan repose entièrement sur le Clicker du QG.

## 1. Le concept

Un jeu clicker de gestion de carrière d'artiste. Le joueur est au QG (le studio) et fait des beats qui rapportent de l'argent. Pour faire de bons beats, qui rapportent une grosse somme, il faut consommer du cannabis, mais le cannabis coûte cher. Le joueur doit constamment équilibrer ses gains et ses dépenses pour ne pas « fail out ».

**Boucle principale.** Le joueur clique pour produire des beats. Les beats rapportent de l'argent. La qualité d'un beat, donc son gain, dépend du cannabis consommé. Le cannabis coûte cher : il faut miser une partie de ses gains pour en acheter. Le but est de bien gérer cet équilibre pour ne pas se retrouver à sec.

**Échec (« fail out »).** Quand l'équilibre n'est pas géré : gros ralentissement de la production et perte de fans sur les réseaux sociaux. Les fans sont la vraie barre de vie du jeu : si l'audience fond, la progression en souffre.

**Gestion de carrière.** Progression dans le temps, avec un QG qui évolue : le setup du studio s'améliore à coups d'upgrades. Il y a une tension constante entre pousser la création et rester stable.

**Inspiration.** Le jeu de PewDiePie (Tuber Simulator) : une petite chambre de YouTuber en pixel art que l'on améliore au fur et à mesure.

**Personnages.** Les personnages jouables sont les vrais membres du groupe : Xavier, Nathan et Émile. Le joueur choisit son personnage au début, comme dans un jeu de combat. Idée de départ : chacun a ses forces, par exemple Xavier meilleur en mélodies, Nathan en paroles, Émile en beats.

**Ton.** Humoristique et farfelu, dans l'esprit du groupe. Garder la satire et l'absurde comme voix du jeu.

**Direction visuelle retenue.** 2D minimaliste, en pixel art ou cartoon, où les trois membres sont reconnaissables (coupe de cheveux, lunettes, style de linge). Des photos de chacun en T-pose dans le garage existent, tournées à 90 degrés (face, côtés, dos), idéales pour faire des sprites qui se tournent. La version 3D avec scan du vrai QG a été jugée trop lourde pour une première version.

**Plateforme.** À confirmer (voir les questions ouvertes). Par défaut, jeu web en JavaScript qui roule dans le navigateur sur Mac comme sur Windows.

## 2. Volet A : Gameplay et code

Responsable de la logique du jeu, de l'économie, de la boucle de gestion et de l'architecture du code.

### Boucle de base : cliquer pour faire des beats

- Un clic produit un beat. Chaque beat a une qualité, et la qualité détermine l'argent gagné.
- Des producteurs automatiques (par exemple des instruments, des logiciels, des collaborateurs) génèrent des beats sans clic, pour la dimension clicker idle.
- Affichage clair de l'argent, des beats par seconde et du gain par beat.

### Système cannabis : qualité contre coût

- Le joueur peut acheter du cannabis pour augmenter la qualité des beats pendant une durée limitée.
- Le cannabis coûte cher : chaque achat réduit l'argent disponible, et son prix peut monter avec la consommation.
- Il faut trouver l'équilibre : trop peu et les beats rapportent peu, trop et l'argent fond.
- Prévoir un effet qui s'estompe dans le temps (durée, intensité) pour forcer des décisions répétées.
- À définir en équipe : si une consommation excessive a aussi un effet négatif de jeu (production qui baisse, par exemple), comme élément d'équilibrage.

### Fans et échec (« fail out »)

- Les fans sont la barre de vie du jeu : un nombre qui monte quand les beats sont bons et qui baisse quand la production s'effondre.
- Si le joueur est à sec ou produit des beats faibles trop longtemps : gros ralentissement de la production et perte de fans.
- Si les fans tombent trop bas, la progression en souffre. Les seuils exacts de ralentissement et de perte restent à définir par essais et équilibrage.
- Prévoir une possibilité de remonter la pente après un échec, pour que le jeu ne devienne pas frustrant.

### Upgrades du QG et progression de carrière

- Boutique d'upgrades du studio : équipement, décor, setup. Chaque upgrade augmente la production, la qualité ou la rétention de fans.
- Paliers de carrière qui débloquent de nouveaux niveaux de QG et de nouvelles options.
- Coût croissant pour chaque upgrade, avec équilibrage à tester souvent.
- Gestion des très grands nombres : format d'affichage (K, M, B) prévu dès le départ.
- Sauvegarde automatique dans le navigateur, avec progression hors ligne calculée au retour du joueur.

### Personnages et forces

- Écran de sélection de personnage au début, comme dans un jeu de combat : Xavier, Nathan ou Émile.
- Chaque personnage a une force différente. Idée de départ : Xavier meilleur en mélodies, Nathan en paroles, Émile en beats. Les bonus précis restent à déterminer.
- Prévoir les forces comme des données modifiables (multiplicateurs par personnage) pour ajuster facilement.

### Structure du code

- Séparer clairement : logique du jeu, affichage, audio, données de contenu. Ça évite les conflits entre les trois personnes.
- Fichiers de données (personnages, upgrades, paliers, textes) distincts du code pour que les autres puissent les modifier facilement.
- Définir tôt un format simple de données partagé entre les trois volets, par exemple un fichier par type de contenu.

### Questions ouvertes pour ce volet

- Le joueur se promène-t-il dans le QG, ou le voit-il d'un angle fixe ?
- Quel est le niveau exact du ralentissement et de la perte de fans en cas d'échec ?
- Quels upgrades du QG et quels paliers de progression ?
- Quelles forces précises pour chaque personnage ?
- Moteur ou techno à choisir (web, Godot, Unity...).

## 3. Volet B : Visuel et direction artistique

Responsable de tout ce qu'on voit à l'écran : les trois personnages, le QG et son évolution, l'interface et les effets.

### Personnages

- Créer Xavier, Nathan et Émile en 2D minimaliste, pixel art ou cartoon, mais reconnaissables : coupe de cheveux, lunettes, style de linge.
- Les photos de référence existent déjà : chacun en T-pose dans le garage, tourné à 90 degrés à chaque fois (face, côtés, dos). C'est idéal pour faire des sprites qui se tournent.
- La génération des personnages cartoon à partir des photos est à explorer avec le connecteur Higgsfield, dans le chat texte.
- Animations de base pour chacun : au repos, en train de faire un beat, réaction à un bon beat et à un mauvais, effet du cannabis, moment d'échec.
- Fournir les personnages en feuilles de sprites (spritesheets) ou en images séparées par animation, avec un nommage clair.

### Le QG et son évolution

- Le QG est la scène principale : une petite pièce de studio, dans l'esprit de la chambre de YouTuber du jeu Tuber Simulator, qui s'améliore au fil de la partie.
- Une version visuelle par palier d'upgrade : setup de départ modeste, puis équipement, décor et ambiance de plus en plus poussés.
- Chaque upgrade de la boutique doit avoir un visuel qui apparaît dans le QG quand on l'achète, pour que le joueur voie la progression.
- Décision à prendre avec l'équipe : angle fixe ou QG où le joueur se promène. L'angle fixe, façon diorama, est plus léger pour une première version.

### Interface (UI)

- Affichage de l'argent, des beats par seconde, du niveau de cannabis actif et de la barre de fans, qui est la barre de vie du jeu.
- Bouton ou zone de clic principale, satisfaisante à cliquer.
- Boutique d'upgrades : liste claire avec icône, nom, coût et effet.
- Écran de sélection de personnage au début, dans l'esprit d'un jeu de combat : les trois personnages côte à côte, avec leurs forces.
- Écran ou état visuel d'échec quand les fans s'effondrent.

### Effets visuels

- Particules et feedback : chiffres qui flottent, argent qui sort, flash sur un gros beat.
- Effet visuel pour le cannabis actif (fumée, ambiance qui change), qui s'estompe avec le temps.
- Variation visuelle du QG selon l'état : studio plein de vie quand les fans montent, plus terne quand ils baissent.

### Livrables et façon de travailler

- Style graphique à fixer tôt (palette, résolution des sprites, épaisseur des traits) pour que tout reste cohérent.
- Tous les fichiers d'images dans un dossier `assets/images` du dépôt, rangés par catégorie (personnages, QG, interface, effets).
- Se brancher aux données du volet A (personnages, upgrades, paliers) pour associer chaque élément à son image, sans modifier la logique du jeu.

## 4. Volet C : Son, musique et écriture

Responsable de l'ambiance sonore, de la musique et de toute l'écriture du jeu : noms d'upgrades, textes, dialogues et messages. Comme le groupe fait de la musique, ce volet est un terrain de jeu naturel.

### Musique

- Une trame musicale de fond pour le QG, qui peut tourner en boucle pendant des heures sans fatiguer.
- Des variantes selon l'état du jeu : production normale, cannabis actif, fans en baisse, échec. L'ambiance sonore doit raconter ce qui se passe.
- Évolution avec le QG : la musique peut s'enrichir à mesure que le studio s'améliore (plus de couches, plus d'instruments).
- Pour le côté clicker, les beats que le joueur « produit » peuvent être de vrais petits motifs musicaux qui s'accumulent.

### Effets sonores

- Son du clic principal, avec plusieurs variantes pour éviter la répétition.
- Sons de gain d'argent, d'achat d'upgrade, de montée de fans.
- Sons liés au cannabis : achat, consommation, effet qui s'estompe.
- Sons d'échec : fans qui baissent, production qui ralentit, alerte quand l'argent est à sec.
- Sons d'interface : ouverture de la boutique, sélection de personnage, changement de palier.

### Écriture et textes

- Les noms et descriptions des upgrades du QG, avec l'humour propre au groupe.
- Les textes de sélection de personnage : une courte description de chacun, avec ses forces.
- Messages de jeu : événements, alertes, réactions des fans sur les réseaux sociaux, notifications de progression ou d'échec.
- Les noms des paliers de carrière et des niveaux de QG.
- Écrire les textes dans des fichiers de données (JSON ou similaire) séparés du code, pour que le volet A puisse les lire directement.
- Les textes finaux sont écrits par les membres eux-mêmes : ce volet définit la structure et les besoins, pas le contenu créatif.

### Livrables et façon de travailler

- Fichiers audio dans un format compatible navigateur (mp3 ou ogg), rangés dans un dossier `assets/audio` du dépôt, par catégorie (musique, effets).
- Nommage clair, par exemple par type d'événement ou par palier.
- Prévoir des boucles propres pour la musique, sans clic ni coupure audible.
- Se brancher aux données du volet A pour associer chaque événement ou palier à son son et à ses textes.

## 5. Installation de Git et GitHub

Git garde l'historique du projet sur chaque ordinateur, et GitHub sert de dépôt partagé en ligne. Les trois personnes doivent avoir les deux. Un agent IA peut guider chaque étape ci-dessous.

### Étape 1 : créer un compte GitHub

1. Aller sur github.com et créer un compte gratuit.
2. Une seule personne crée le dépôt (repository) du jeu, en privé, puis invite les deux autres dans Settings, Collaborators, avec leur nom d'utilisateur GitHub.
3. Les deux autres acceptent l'invitation reçue par courriel.

### Étape 2 : installer Git sur Mac

1. Ouvrir l'application Terminal.
2. Taper `git --version` et appuyer sur Entrée.
3. Si Git n'est pas installé, le Mac propose d'installer les outils de développement (Xcode Command Line Tools). Accepter et attendre la fin.
4. Vérifier de nouveau avec `git --version`.

### Étape 3 : installer Git sur Windows

1. Télécharger Git for Windows sur git-scm.com.
2. Lancer l'installateur et garder les options par défaut.
3. Ouvrir ensuite Git Bash depuis le menu Démarrer.
4. Vérifier avec `git --version`.

### Étape 4 : configurer son identité (Mac et Windows)

Dans le terminal (Terminal sur Mac, Git Bash sur Windows), taper ces deux commandes en mettant son vrai nom et son courriel GitHub :

- `git config --global user.name "Ton Nom"`
- `git config --global user.email "ton@courriel.com"`

### Étape 5 : se connecter à GitHub

La façon la plus simple est GitHub CLI :

- Mac : installer Homebrew si besoin, puis `brew install gh`. Sinon, télécharger l'installateur sur cli.github.com.
- Windows : télécharger l'installateur sur cli.github.com.
- Ensuite, dans le terminal, taper `gh auth login` et suivre les questions : GitHub.com, HTTPS, connexion par le navigateur.

Alternative sans ligne de commande : installer GitHub Desktop (desktop.github.com), qui existe pour Mac et Windows et gère tout avec des boutons.

### Étape 6 : récupérer le projet

1. Choisir un dossier de travail sur l'ordinateur.
2. Dans le terminal, taper `git clone` suivi de l'adresse du dépôt, que GitHub affiche sur la page du projet.
3. Entrer dans le dossier créé : le projet est prêt.

### Façon de travailler à trois

- Chaque personne travaille sur sa propre branche : `git checkout -b gameplay`, `git checkout -b visuel` ou `git checkout -b son`.
- Sauvegarder son travail régulièrement : `git add .`, puis `git commit -m "description courte"`, puis `git push`.
- Avant de commencer une session, récupérer le travail des autres : `git pull`.
- Pour fusionner une branche dans la principale, ouvrir une Pull Request sur GitHub et la faire relire par un autre membre.
- Rester chacun dans son dossier autant que possible : le code pour le volet A, `assets/images` pour le volet B, `assets/audio` et les fichiers de textes pour le volet C. Ça évite presque tous les conflits.
- Ne jamais mettre de mots de passe ni de clés secrètes dans le dépôt. Ce jeu n'en a pas besoin, mais c'est une bonne habitude dès le départ.
- Les gros fichiers audio et d'images peuvent alourdir le dépôt : garder les fichiers de travail lourds (projets Photoshop, sessions audio) en dehors de Git et n'y mettre que les fichiers finaux.
