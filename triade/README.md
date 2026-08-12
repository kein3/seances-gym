# TRIADE

Programme de musculation **full body, trois séances par semaine**, en salle complète,
dans une page web qui fonctionne hors ligne et s'installe sur l'écran d'accueil du téléphone.

| Séance | Nom | Mouvements centraux | Durée |
|---|---|---|---|
| A | **Socle** | Rack → un banc + haltères → les câbles | ~57 min |
| B | **Charnière** | Rack → un banc inclinable → les machines | ~55 min |
| C | **Amplitude** | Un banc → barre de traction → les câbles → les machines | ~58 min |

Ordre A → B → C, avec au moins un jour de repos entre chaque (lundi / mercredi / vendredi
fonctionne bien).

Chaque séance est organisée **par poste de salle**, pas par muscle : trois postes, on
s'installe, on fait tout ce qu'il y a à y faire, on ne revient pas. Le rack pour le **seul**
mouvement lourd, un banc gardé pour deux ou trois exercices d'affilée, puis une zone
(câbles ou machines) où tout s'enchaîne. Aucun superset ne mélange deux postes éloignés —
c'est ce qui fait perdre son banc. Ce regroupement coûte deux à trois minutes par séance
par rapport à un enchaînement libre : c'est le prix pour ne rien rendre.

Le programme est nettement orienté haut du corps, et **pectoraux et biceps sont traités en
priorité** : 15,5 séries de biceps et 12 de pectoraux par semaine, contre 7 pour les
quadriceps.
Les jambes tiennent sur trois mouvements (squat, soulevé roumain, fentes bulgares) et rien
de redondant. Si tu veux plus de jambes, ajoute une presse à cuisses 3 × 12 en fin de
séance B — les quadriceps sont à 7 séries par semaine, le poste le plus bas assumé.

## Sur quoi il repose

Le choix des exercices n'est pas au jugé : chacun vient d'une comparaison publiée entre
deux exercices ou deux façons de faire — extension triceps au-dessus de la tête plutôt que
devant soi, leg curl assis plutôt que couché, mollets debout plutôt qu'assis, leg extension
sur la moitié basse plutôt que la moitié haute. Les réglages de séance (proximité de
l'échec, repos, volume hebdomadaire) suivent la même règle.

Tout est détaillé dans **[SOURCES.md](SOURCES.md)**, avec les limites de ces études dites
franchement. L'application en donne la version courte dans « Méthode → Pourquoi ces
exercices ».

Le volume hebdomadaire par muscle est mesuré, pas supposé :

```bash
python3 src/volume.py
```

Il compte les séries directes pour 1 et les séries indirectes pour 0,5, signale tout
exercice qu'il ne sait pas classer, et sort en erreur si un muscle passe sous 6 séries
par semaine.

Les durées affichées ne sont pas tapées à la main non plus — elles sont déduites du contenu
(répétitions, tempo, repos, mise en place, montée en charge) :

```bash
python3 src/duree.py            # recalcule et met à jour le programme
python3 src/duree.py --verifie  # échoue si une durée ne correspond plus au contenu
```

## Ce que fait l'application

- **Chaque exercice détaillé** : séries, répétitions, tempo, repos, charge repère,
  consignes d'exécution, erreur à éviter, et une alternative si la machine est prise.
- **Cases à cocher par série**, et par tour pour les supersets.
- **Minuteur de repos qui n'occupe pas l'écran** : il apparaît en pastille en bas, avec le
  nom de l'exercice et une barre d'avancement, et passe au vert à la fin. Il se lance tout
  seul quand tu coches une série et garde l'écran allumé. Un appui dessus affiche le grand
  décompte si tu le veux.
- **Aucun son.** La fin de repos se signale par la vibration (quand l'appareil la gère —
  Safari sur iPhone ne la gère pas) et par la pastille qui passe au vert en pulsant
  trois fois. Rien ne sonne jamais.
- **Le repos se lance depuis l'exercice, avec sa durée** : la case « Repos » de chaque
  exercice est un bouton. Un + 30 s pendant le décompte règle le repos **de cet
  exercice-là**, pour toutes les fois suivantes.
- **Suivi des charges** : la dernière charge utilisée, l'historique, et une proposition
  d'augmentation dès que tu as tenu deux séances à la même charge.
- **Notes personnelles** par exercice (réglage de machine, ressenti).
- **Tabata** réglable (effort, repos, tours) pour les finitions.
- **Thème clair / sombre**, automatique selon le téléphone.
- **Charge réglable au pouce** : deux boutons − / + au pas de l'exercice, pour ne pas
  sortir le clavier au milieu d'une série.
- **Avancement de la séance** dans l'en-tête (séries faites sur séries prévues).
- **Export / import** de tes données dans un fichier, et remise à zéro.

Tout est enregistré **sur l'appareil uniquement** (mémoire locale du navigateur) — aucun
compte, aucun serveur, rien qui sorte du téléphone. L'export sert à passer d'un appareil
à l'autre.

## Ouvrir l'application

- **Sur ordinateur** : ouvrir `index.html`.
- **Sur téléphone** : publier le dossier sur un hébergement statique (GitHub Pages
  convient), ouvrir l'adresse, puis « Ajouter à l'écran d'accueil ». Elle fonctionne
  ensuite sans réseau, ce qui est le cas courant au sous-sol d'une salle.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | **L'application entière** : programme, styles et code dans un seul fichier |
| `manifest.webmanifest`, `sw.js`, `icon-*.png`, `favicon.svg` | installation sur l'écran d'accueil et fonctionnement hors ligne |
| `src/payload.json` | le programme (c'est ici qu'on modifie un exercice, une charge repère, un texte) |
| `src/style.css`, `src/app.js`, `src/shell.html` | les morceaux assemblés dans `index.html` |
| `src/build.py` | assemble les morceaux : `python3 src/build.py` |
| `src/gen_icons.py` | régénère les icônes |
| `src/drive.mjs` | vérifie l'application dans un vrai Chrome (voir plus bas) |
| `src/volume.py` | compte le volume hebdomadaire par muscle |
| `src/duree.py` | calcule les durées et les écrit dans le programme |
| `SOURCES.md` | les études derrière chaque choix, et leurs limites |

`index.html` est **généré**. Pour changer quelque chose, modifier le fichier
correspondant dans `src/`, puis relancer `python3 src/build.py`.

## Vérifier après une modification

```bash
python3 -m http.server 8931 --bind 127.0.0.1 --directory .   # dans un terminal
node src/drive.mjs /tmp/captures                             # dans un autre
```

Le pilote ouvre l'application dans Chrome, **émule un téléphone de 390 px**, joue les
24 contrôles du scénario (cocher une série, lancer un repos depuis l'exercice, l'ajuster,
régler une charge, ouvrir chaque écran) et vérifie :
débordements horizontaux, cibles tactiles trop petites, contrastes de texte insuffisants,
titres masqués par les barres collantes, erreurs JavaScript. Il écrit aussi une capture
par écran.

Deux précautions qui expliquent la forme du fichier :

- **Chrome refuse une fenêtre de moins de 500 px de large.** Une capture demandée à
  390 px est simplement *rognée* : elle donne l'illusion d'un débordement qui n'existe
  pas. Le pilote passe donc par le protocole DevTools, qui émule vraiment cette largeur.
- **La sonde se calibre avant de mesurer** sur quatre cas dont le résultat est connu
  (dont un fond semi-transparent et un `color-mix`). Si l'un tombe à côté, le pilote
  s'arrête au lieu de produire un rapport faux.
- **Le pilote refuse de tester une version périmée.** Chaque build tamponne une empreinte
  dans la page ; le pilote la compare à celle que sert le réseau, vide le service worker et
  les caches, et s'arrête si les deux diffèrent. Sans ce contrôle, un serveur éteint ne
  provoque aucune erreur visible : le service worker sert sa copie en cache et le rapport
  porte sur du code qui n'existe plus.
- **Un scénario interrompu échoue bruyamment.** S'il s'arrête à mi-parcours, le rapport dit
  lequel des 24 contrôles a planté et combien n'ont pas été joués — un plantage ne peut plus
  ressembler à un succès.

Un rapport à `0 point à corriger` et `0 erreur JavaScript` est la condition pour publier.
