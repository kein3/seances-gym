# TRIADE

Programme de musculation **full body, trois séances par semaine**, en salle complète,
dans une page web qui fonctionne hors ligne et s'installe sur l'écran d'accueil du téléphone.

| Séance | Nom | Mouvements centraux | Durée |
|---|---|---|---|
| A | **Socle** | Rack → un banc + haltères → les câbles | ~65 min |
| B | **Charnière** | Rack → un banc inclinable → les machines | ~64 min |
| C | **Amplitude** | Un banc → barre de traction → les câbles → les machines | ~67 min |

Ordre A → B → C, avec au moins un jour de repos entre chaque (lundi / mercredi / vendredi
fonctionne bien).

Chaque séance est organisée **par poste de salle**, pas par muscle : trois postes, on
s'installe, on fait tout ce qu'il y a à y faire, on ne revient pas. Le rack pour le **seul**
mouvement lourd, un banc gardé pour deux ou trois exercices d'affilée, puis une zone
(câbles ou machines) pour les derniers. Les exercices d'un même poste se font **l'un après
l'autre, en entier** : les quatre séries de développé, puis les quatre de rowing, sans
rendre le banc. Ce regroupement coûte deux à trois minutes par séance par rapport à un
ordre libre : c'est le prix pour ne rien rendre.

**Aucun enchaînement de deux mouvements** (« superset »). Le programme en comptait sept
jusqu'au 01/09/2026 : ils tenaient sur le papier, mais demandaient d'occuper deux postes en
même temps dans une salle fréquentée, ce qui a été jugé impraticable à l'usage. Les dix
minutes qu'ils faisaient gagner sont récupérées sur le repos des exercices d'accessoire,
ramené à une minute — le mouvement lourd garde ses 2'30.

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

### Les schémas de mouvement

Chaque exercice a un schéma dans son volet « Comment le faire » : la pose de départ en
fil de fer, la pose d'arrivée en silhouette pleine, une flèche cuivre pour le sens — et
**le muscle travaillé qui s'allume en cuivre** sur la silhouette, franc pour le travail
direct, pâle pour le soutien.

Ils ne sont pas dessinés un par un mais **calculés** : le corps est un squelette de
longueurs fixes, et une figure ne décrit que des angles d'articulation et deux poses.
C'est ce qui leur donne les mêmes proportions et le même trait — et ce qui fait qu'un
exercice ajouté sans figure **arrête le build** au lieu d'ouvrir un volet sans dessin.

La liste des muscles n'est pas réécrite pour les schémas : elle est lue dans
`src/volume.py`, qui s'en sert déjà pour compter le volume hebdomadaire. Une seule
source — reclasser un exercice corrige le compte et le dessin d'un coup. Un muscle
sans zone dessinée arrête aussi la génération.

Deux pièges de géométrie, réglés une fois :

- **le côté avant d'un segment** ne peut pas se déduire d'une direction globale : assis,
  la cuisse pointe vers l'avant et sa perpendiculaire devient indécidable. Chaque segment
  porte donc un signe mesuré en position debout, qui tourne ensuite avec lui — sans quoi
  l'ischio-jambier s'allumait sur le *dessus* de la cuisse au leg curl ;
- **le corps retourné** (couché sur le dos, dos en l'air) inverse ce côté : les cinq
  figures concernées portent `ventre=-1`.

```bash
python3 src/figures.py            # écrit src/figures.json
python3 src/figures.py --planche  # planche de contact, pour juger les 28 d'un coup
python3 src/figures.py --seul a-squat,b-rdl   # planche limitée, pour retoucher
```

⚠ Les angles se règlent **en regardant la planche**, jamais en aveugle : la moitié des
figures étaient anatomiquement fausses au premier jet, et rien dans le code ne le disait.

## Le registre visuel

Direction retenue après une planche de quatre propositions : **le registre d'un beau carnet**.
Beaucoup de blanc chaud, aucune bordure inutile, un seul accent cuivre, des titres larges et
légers. La hiérarchie vient de l'échelle et du blanc — pas du cadre. La série faite se marque
en encre pleine ; chaque séance n'a qu'une teinte sourde (cuivre, ocre, sauge) pour sa lettre
et sa barre d'avancement. Le thème sombre reprend la même logique en encre claire sur noir
chaud, pas en inversion.

Un ajout depuis : **chaque poste est un creux teinté, chaque exercice une carte posée
dedans.** Tout au blanc, un titre de poste et un exercice se ressemblaient trop pour qu'on
sache d'un coup d'œil où on en est. Le creux et la carte suivent la même logique dans les
deux thèmes : le creux s'éloigne du fond de page, la carte s'en rapproche.

Sur l'écran de séance : **aucune surface pleine en couleur, aucune cible sous 44 px.**

## Ce que fait l'application

- **Chaque exercice détaillé** : séries, répétitions, tempo, repos, charge repère, et un
  volet « Comment le faire » qui donne le schéma du mouvement avec le muscle travaillé,
  la mise en place (réglage de la machine, position de départ), l'exécution, le repère
  « c'est bien fait quand… », l'erreur à éviter, et une alternative si la machine est
  prise.
- **Cases à cocher par série**, propres à chaque exercice.
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
| `src/figures.py` | calcule les 28 schémas de mouvement → `src/figures.json` |
| `SOURCES.md` | les études derrière chaque choix, et leurs limites |

`index.html` est **généré**. Pour changer quelque chose, modifier le fichier
correspondant dans `src/`, puis relancer `python3 src/build.py`.

## Vérifier après une modification

```bash
python3 -m http.server 8931 --bind 127.0.0.1 --directory .   # dans un terminal
node src/drive.mjs /tmp/captures                             # dans un autre
```

Le pilote ouvre l'application dans Chrome, **émule un téléphone de 390 px**, joue les
27 contrôles du scénario (cocher une série, lancer un repos depuis l'exercice, l'ajuster,
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
  lequel des 27 contrôles a planté et combien n'ont pas été joués — un plantage ne peut plus
  ressembler à un succès.

Un rapport à `0 point à corriger` et `0 erreur JavaScript` est la condition pour publier.
