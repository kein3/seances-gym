#!/usr/bin/env python3
"""Dessine un schéma de mouvement pour chaque exercice — src/figures.json.

Pourquoi un moteur plutôt que 28 dessins : dessinés un par un, les schémas
n'auraient ni les mêmes proportions ni le même trait, et le premier exercice
ajouté n'aurait pas de figure. Ici le corps est un squelette de longueurs
FIXES ; une figure ne décrit que des ANGLES D'ARTICULATION et deux poses — le
départ et la fin. La cohérence est structurelle, pas une question de soin.

Chaque angle est RELATIF au segment dont il dépend : plier le buste emmène donc
la tête et les bras avec lui, comme dans un vrai corps. Seul le tronc est donné
en absolu (90° = debout, 0° = allongé la tête à droite).

    profil, corps tourné vers la droite
      tronc      90 debout · 45 penché en avant · 0 allongé
      cou         0 dans l'axe du buste
      bras      180 le long du corps · -90 tendu devant · 0 au-dessus de la tête
      avantbras   0 coude tendu · positif = flexion, main vers l'avant
      cuisse    180 dans l'axe du buste · -90 hanche pliée à angle droit (assis)
      tibia       0 genou tendu · négatif = flexion, talon vers l'arrière
      pied       90 perpendiculaire au tibia

Les segments « 2 » (cuisse2, bras2…) sont la jambe et le bras du fond : ils ne
sont dessinés que si la pose leur donne un angle.

    python3 src/figures.py            écrit src/figures.json
    python3 src/figures.py --planche  écrit en plus une planche de contact
    python3 src/figures.py --seul id  planche limitée à quelques figures
"""
import json
import math
import pathlib
import sys

SRC = pathlib.Path(__file__).resolve().parent

W, H = 200, 180
SOL = 162
TETE_R = 8.5

# ─── Squelette : segment -> (départ, arrivée, longueur, segment de référence) ───
PROFIL = {
    'tronc':      ('hanche', 'epaule', 38, None),
    'cou':        ('epaule', 'tete', 16, 'tronc'),
    'bras':       ('epaule', 'coude', 23, 'tronc'),
    'avantbras':  ('coude', 'poignet', 21, 'bras'),
    'cuisse':     ('hanche', 'genou', 29, 'tronc'),
    'tibia':      ('genou', 'cheville', 29, 'cuisse'),
    'pied':       ('cheville', 'orteil', 13, 'tibia'),
    'bras2':      ('epaule', 'coude2', 23, 'tronc'),
    'avantbras2': ('coude2', 'poignet2', 21, 'bras2'),
    'cuisse2':    ('hanche', 'genou2', 29, 'tronc'),
    'tibia2':     ('genou2', 'cheville2', 29, 'cuisse2'),
    'pied2':      ('cheville2', 'orteil2', 13, 'tibia2'),
}
DEBOUT = {'tronc': 90, 'cou': 0, 'bras': 180, 'avantbras': 0,
          'cuisse': 180, 'tibia': 0, 'pied': 90,
          'bras2': 180, 'avantbras2': 0, 'cuisse2': 180, 'tibia2': 0, 'pied2': 90}

FACE = {
    'tronc':       ('bassin', 'cou_bas', 38, None),
    'cou':         ('cou_bas', 'tete', 16, 'tronc'),
    'clav_g':      ('cou_bas', 'epauleG', 15, 'tronc'),
    'clav_d':      ('cou_bas', 'epauleD', 15, 'tronc'),
    'brasG':       ('epauleG', 'coudeG', 23, 'tronc'),
    'avantbrasG':  ('coudeG', 'poignetG', 21, 'brasG'),
    'brasD':       ('epauleD', 'coudeD', 23, 'tronc'),
    'avantbrasD':  ('coudeD', 'poignetD', 21, 'brasD'),
    'cuisseG':     ('bassin', 'genouG', 29, 'tronc'),
    'tibiaG':      ('genouG', 'chevilleG', 29, 'cuisseG'),
    'cuisseD':     ('bassin', 'genouD', 29, 'tronc'),
    'tibiaD':      ('genouD', 'chevilleD', 29, 'cuisseD'),
}
DEBOUT_FACE = {'tronc': 90, 'cou': 0, 'clav_g': 90, 'clav_d': -90,
               'brasG': 172, 'avantbrasG': 0, 'brasD': -172, 'avantbrasD': 0,
               'cuisseG': 187, 'tibiaG': 0, 'cuisseD': 173, 'tibiaD': 0}

# Le tracé du corps, segment par segment. Les traits « 2 » passent derrière.
TRACES_PROFIL_FOND = [['hanche', 'genou2', 'cheville2', 'orteil2'], ['epaule', 'coude2', 'poignet2']]
TRACES_PROFIL = [['orteil', 'cheville', 'genou', 'hanche', 'epaule'],
                 ['epaule', 'coude', 'poignet'], ['epaule', 'tete']]
TRACES_FACE = [['chevilleG', 'genouG', 'bassin', 'genouD', 'chevilleD'],
               ['bassin', 'cou_bas'], ['epauleG', 'cou_bas', 'epauleD'],
               ['epauleG', 'coudeG', 'poignetG'], ['epauleD', 'coudeD', 'poignetD'],
               ['cou_bas', 'tete']]


def deplace(p, angle, longueur):
    a = math.radians(angle)
    return (p[0] + longueur * math.cos(a), p[1] - longueur * math.sin(a))


def absolus(squelette, defauts, angles):
    """Convertit les angles d'articulation en angles écran."""
    a = dict(defauts)
    a.update({k: v for k, v in angles.items() if not k.startswith('_')})
    out, reste = {}, list(squelette)
    while reste:
        avance = False
        for seg in list(reste):
            ref = squelette[seg][3]
            if ref is None:
                out[seg] = a[seg]
                reste.remove(seg)
                avance = True
            elif ref in out:
                out[seg] = out[ref] + a[seg]
                reste.remove(seg)
                avance = True
        if not avance:
            raise SystemExit('référence circulaire dans le squelette')
    return out


def resous(squelette, defauts, angles, ancre):
    """Place tous les points à partir du seul point connu.

    On propage dans les deux sens : un segment remonté à l'envers vaut son
    angle plus 180°. Sans cela, une figure suspendue à une barre — où le point
    connu est la main — serait impossible à poser.
    """
    ang = absolus(squelette, defauts, angles)
    nom, x, y = ancre
    pts = {nom: (x, y)}
    encore = True
    while encore:
        encore = False
        for seg, (p, e, ln, _r) in squelette.items():
            if p in pts and e not in pts:
                pts[e] = deplace(pts[p], ang[seg], ln)
                encore = True
            elif e in pts and p not in pts:
                pts[p] = deplace(pts[e], ang[seg] + 180, ln)
                encore = True
    pts['_ang'] = ang
    return pts


def n(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


def poly(pts, noms, cls):
    if any(k not in pts for k in noms):
        return ''
    d = ' '.join('%s,%s' % (n(pts[k][0]), n(pts[k][1])) for k in noms)
    return '<polyline class="%s" points="%s"/>' % (cls, d)


def silhouette(pts, cls, vue, poser2):
    o = []
    if vue == 'profil':
        if poser2:
            for t in TRACES_PROFIL_FOND:
                o.append(poly(pts, t, cls + ' fig-fond'))
        for t in TRACES_PROFIL:
            o.append(poly(pts, t, cls))
    else:
        for t in TRACES_FACE:
            o.append(poly(pts, t, cls))
    c = pts['tete']
    o.append('<circle class="%s" cx="%s" cy="%s" r="%s"/>' % (cls, n(c[0]), n(c[1]), TETE_R))
    return ''.join(o)


# ─────────────────── Le matériel ───────────────────

def ligne(a, b, cls='fig-mat'):
    return '<line class="%s" x1="%s" y1="%s" x2="%s" y2="%s"/>' % (
        cls, n(a[0]), n(a[1]), n(b[0]), n(b[1]))


def rect(x, y, w, h, cls='fig-mat', r=2):
    return '<rect class="%s" x="%s" y="%s" width="%s" height="%s" rx="%s"/>' % (
        cls, n(x), n(y), n(w), n(h), r)


def cercle(p, r, cls='fig-mat'):
    return '<circle class="%s" cx="%s" cy="%s" r="%s"/>' % (cls, n(p[0]), n(p[1]), n(r))


def barre_h(p, demi=30, cls='fig-mat'):
    return ligne((p[0] - demi, p[1]), (p[0] + demi, p[1]), cls)


def disques(p, demi=15, r=8):
    """Une barre chargée, vue de profil : le fût de bout et son disque.

    Deux disques écartés — dessinés comme vus de face — mangeaient la
    silhouette : de profil, on ne voit qu'un disque, dans l'axe du corps.
    """
    return barre_h(p, demi) + cercle(p, r)


def halteres(p):
    return (ligne((p[0] - 6, p[1] - 6.5), (p[0] - 6, p[1] + 6.5)) +
            ligne((p[0] + 6, p[1] - 6.5), (p[0] + 6, p[1] + 6.5)) +
            ligne((p[0] - 6, p[1]), (p[0] + 6, p[1])))


def colonne(x, haut=26, bas=SOL):
    """Montant de poulie et sa pile de poids."""
    o = [ligne((x, haut), (x, bas)), rect(x - 9, bas - 44, 18, 44)]
    for i in range(4):
        o.append(ligne((x - 9, bas - 35 + i * 9), (x + 9, bas - 35 + i * 9)))
    return ''.join(o)


def cable(a, b):
    return ligne(a, b, 'fig-cable')


def sol_():
    return '<line class="fig-sol" x1="6" y1="%s" x2="%s" y2="%s"/>' % (SOL, W - 6, SOL)


def banc(x, y, larg, pente=0):
    """Assise plate, deux pieds, et un dossier quand la pente n'est pas nulle."""
    o = [rect(x, y, larg, 7), ligne((x + 11, y + 7), (x + 11, SOL)),
         ligne((x + larg - 11, y + 7), (x + larg - 11, SOL))]
    if pente:
        o.append(ligne((x + larg - 4, y + 3), deplace((x + larg - 4, y + 3), 180 - pente, 60)))
    return ''.join(o)


def fleche(a, b, courbe=0.26):
    dx, dy = b[0] - a[0], b[1] - a[1]
    if math.hypot(dx, dy) < 10:
        return ''
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    cx, cy = mx - dy * courbe, my + dx * courbe
    tx, ty = b[0] - cx, b[1] - cy
    ta = math.degrees(math.atan2(-ty, tx))
    p1, p2 = deplace(b, ta + 150, 8), deplace(b, ta - 150, 8)
    return ('<path class="fig-fleche" d="M%s,%s Q%s,%s %s,%s"/>'
            '<polyline class="fig-fleche" points="%s,%s %s,%s %s,%s"/>') % (
        n(a[0]), n(a[1]), n(cx), n(cy), n(b[0]), n(b[1]),
        n(p1[0]), n(p1[1]), n(b[0]), n(b[1]), n(p2[0]), n(p2[1]))


def M(vue, ancre, a, b, suivi, materiel=None, devant=None, sol=True, ancre_b=None):
    return {'vue': vue, 'ancre': ancre, 'ancre_b': ancre_b or ancre, 'a': a, 'b': b,
            'suivi': suivi, 'materiel': materiel, 'devant': devant, 'sol': sol}


rien = None
FIGS = {}

# ══════════ Cardio — le vélo, deux jambes sur le pédalier ══════════
PEDALIER, PEDR = (108, 140), 12


def _velo(pa, pb):
    """Un vélo d'appartement : selle, colonne, guidon, volant, pédalier.
    Le cadre triangulé d'un vrai vélo brouillait la silhouette — ici on ne
    garde que ce qui situe le corps."""
    return (rect(66, 122, 28, 7) + ligne((80, 129), (80, 150)) +      # selle et sa tige
            ligne((80, 150), (138, 150)) +                             # base
            ligne((138, 150), (138, 84)) + ligne((138, 84), (154, 84)) +  # colonne, guidon
            cercle((138, 120), 15) + cercle((138, 120), 4) +           # volant
            cercle(PEDALIER, PEDR) + ligne((70, SOL - 2), (168, SOL - 2)))


_veloA = {'tronc': 74, 'bras': -83, 'avantbras': 0,
          'cuisse': -42.8, 'tibia': -118.9, 'pied': 108,
          'cuisse2': -92, 'tibia2': -75.1, 'pied2': 72}
_veloB = {'tronc': 74, 'bras': -83, 'avantbras': 0,
          'cuisse': -92, 'tibia': -75.1, 'pied': 72,
          'cuisse2': -42.8, 'tibia2': -118.9, 'pied2': 108}
for _i in ('a-cardio', 'b-cardio', 'c-cardio'):
    FIGS[_i] = M('profil', ('hanche', 84, 114), _veloA, _veloB, 'cheville', materiel=_velo)

# ══════════ Band pull-apart — de face ══════════
FIGS['a-bandpull'] = M(
    'face', ('bassin', 100, 104),
    {'brasG': 92, 'avantbrasG': 0, 'brasD': -92, 'avantbrasD': 0},
    {'brasG': 76, 'avantbrasG': 20, 'brasD': -76, 'avantbrasD': -20},
    'poignetD',
    devant=lambda pa, pb: (
        '<path class="fig-mat" d="M%s,%s Q100,%s %s,%s"/><path class="fig-mat" d="M%s,%s Q100,%s %s,%s"/>' % (
            n(pa['poignetG'][0]), n(pa['poignetG'][1]), n(pa['poignetG'][1] + 8),
            n(pa['poignetD'][0]), n(pa['poignetD'][1]),
            n(pb['poignetG'][0]), n(pb['poignetG'][1]), n(pb['poignetG'][1] + 2),
            n(pb['poignetD'][0]), n(pb['poignetD'][1]))))

# ══════════ Squat barre ══════════
# Le cou part vers l'avant : sinon la barre, posée sur les trapèzes, traverse
# la tête et la figure devient illisible au moment même où elle compte.
FIGS['a-squat'] = M(
    'profil', ('cheville', 96, SOL),
    {'cou': -26, 'bras': 155, 'avantbras': -140},
    {'tronc': 65, 'cou': -26, 'cuisse': -70, 'tibia': -103, 'pied': 108,
     'bras': 155, 'avantbras': -140},
    'hanche',
    materiel=lambda pa, pb: (rect(158, 32, 8, 130) + ligne((158, 56), (146, 56)) +
                             ligne((158, 104), (146, 104))),
    devant=lambda pa, pb: (disques((pa['epaule'][0] - 8, pa['epaule'][1] - 2), 13, 6) +
                           disques((pb['epaule'][0] - 8, pb['epaule'][1] - 2), 13, 6)))

# ══════════ Développé couché haltères ══════════
_couche = {'tronc': 0, 'cou': 0, 'cuisse': 215, 'tibia': -295, 'pied': -100}
FIGS['a-couche-hal'] = M(
    'profil', ('hanche', 98, 104),
    dict(_couche, bras=-62, avantbras=178),
    dict(_couche, bras=88, avantbras=0),
    'poignet',
    materiel=lambda pa, pb: banc(56, 110, 106),
    devant=lambda pa, pb: halteres(pa['poignet']) + halteres(pb['poignet']))

# ══════════ Rowing haltère un bras ══════════
# Le trépied du rowing appuyé : main et genou sur le banc, l'autre pied au sol,
# corps tourné vers la gauche. Le banc est posé à sa hauteur réelle (45 cm à
# l'échelle du corps) : plus haut, la jambe au sol n'atteignait pas le sol et
# la figure devenait géométriquement impossible.
_row = {'tronc': 172, 'cou': 0,
        'bras2': 38, 'avantbras2': 0,               # bras d'appui, tendu en avant
        'cuisse2': 44, 'tibia2': 144, 'pied2': 0,   # genou et tibia sur le banc
        'cuisse': 141.6, 'tibia': 0, 'pied': -133.6}   # jambe au sol, tendue
FIGS['a-rowing-hal'] = M(
    'profil', ('hanche', 110, 120),
    dict(_row, bras=113, avantbras=0),
    dict(_row, bras=-157.6, avantbras=-103.6),
    'poignet',
    materiel=lambda pa, pb: banc(24, 137, 92),
    devant=lambda pa, pb: halteres(pa['poignet']) + halteres(pb['poignet']))

# ══════════ Roue abdominale ══════════
_roue = {'cuisse': -84, 'tibia': -96, 'pied': 150}
FIGS['a-roue'] = M(
    'profil', ('genou', 74, SOL - 2),
    dict(_roue, tronc=52, bras=-118, avantbras=0),
    dict(_roue, tronc=18, bras=-100, avantbras=0),
    'poignet',
    devant=lambda pa, pb: (cercle(pa['poignet'], 9) + cercle(pb['poignet'], 9) +
                           barre_h(pa['poignet'], 12) + barre_h(pb['poignet'], 12)))

# ══════════ Extension triceps au-dessus de la tête ══════════
FIGS['b-triceps-oh'] = M(
    'profil', ('cheville', 132, SOL),
    {'tronc': 84, 'bras': -14, 'avantbras': 128, 'cuisse2': 168, 'tibia2': -14, 'pied2': 78},
    {'tronc': 84, 'bras': -14, 'avantbras': 6, 'cuisse2': 168, 'tibia2': -14, 'pied2': 78},
    'poignet',
    materiel=lambda pa, pb: colonne(26, haut=118),
    devant=lambda pa, pb: (cable(pa['poignet'], (26, 122)) + cable(pb['poignet'], (26, 122))))

# ══════════ Face pull ══════════
FIGS['a-facepull'] = M(
    'face', ('bassin', 112, 104),
    {'brasG': 104, 'avantbrasG': -14, 'brasD': -104, 'avantbrasD': 14},
    {'brasG': 66, 'avantbrasG': 62, 'brasD': -66, 'avantbrasD': -62},
    'poignetD',
    materiel=lambda pa, pb: colonne(22, haut=46) + ligne((22, 46), (34, 46)),
    devant=lambda pa, pb: (cable(pa['poignetG'], (32, 48)) + cable(pa['poignetD'], (32, 48)) +
                           cable(pb['poignetG'], (32, 48)) + cable(pb['poignetD'], (32, 48))))

# ══════════ Élévations latérales à la poulie ══════════
FIGS['a-elev-lat'] = M(
    'face', ('bassin', 116, 104),
    {'brasG': 176, 'avantbrasG': 0, 'brasD': -168, 'avantbrasD': 0},
    {'brasG': 176, 'avantbrasG': 0, 'brasD': -88, 'avantbrasD': 0},
    'poignetD',
    materiel=lambda pa, pb: colonne(24, haut=118),
    devant=lambda pa, pb: (cable(pa['poignetD'], (24, 122)) + cable(pb['poignetD'], (24, 122))))

# ══════════ Charnière de hanche à vide ══════════
def _baton(p):
    """Le bâton court le long du dos : décalé derrière, sinon il disparaît
    dans le trait du buste."""
    t = p['_ang']['tronc']
    a = deplace(deplace(p['epaule'], t, 15), t + 90, 4)
    b = deplace(deplace(p['hanche'], t + 180, 9), t + 90, 4)
    return ligne(a, b)


FIGS['b-hinge'] = M(
    'profil', ('cheville', 104, SOL),
    {'bras': 150, 'avantbras': -128, 'cuisse2': 172, 'tibia2': -10, 'pied2': 82},
    {'tronc': 26, 'cuisse': -84, 'tibia': -10, 'pied': 94, 'bras': 150, 'avantbras': -128,
     'cuisse2': -80, 'tibia2': -16, 'pied2': 88},
    'hanche',
    devant=lambda pa, pb: _baton(pa) + _baton(pb))

# ══════════ Soulevé de terre roumain ══════════
FIGS['b-rdl'] = M(
    'profil', ('cheville', 104, SOL),
    {'bras': 180, 'avantbras': 0},
    {'tronc': 26, 'cuisse': -90, 'tibia': -10, 'pied': 100, 'bras': 244, 'avantbras': 0},
    'poignet',
    devant=lambda pa, pb: disques(pa['poignet']) + disques(pb['poignet']))

# ══════════ Développé incliné haltères ══════════
_inc = {'tronc': 30, 'cou': 0, 'cuisse': 200, 'tibia': -50, 'pied': 60}
FIGS['b-incline'] = M(
    'profil', ('hanche', 78, 122),
    dict(_inc, bras=-90, avantbras=176),
    dict(_inc, bras=58, avantbras=0),
    'poignet',
    materiel=lambda pa, pb: banc(44, 124, 78, 30),
    devant=lambda pa, pb: halteres(pa['poignet']) + halteres(pb['poignet']))

# ══════════ Curl incliné haltères ══════════
_cur = {'tronc': 54, 'cou': 0, 'cuisse': 218, 'tibia': -46, 'pied': 50}
FIGS['b-curl-incline'] = M(
    'profil', ('hanche', 74, 132),
    dict(_cur, bras=190, avantbras=0),
    dict(_cur, bras=190, avantbras=126),
    'poignet',
    materiel=lambda pa, pb: banc(44, 134, 66, 54),
    devant=lambda pa, pb: halteres(pa['poignet']) + halteres(pb['poignet']))

# ══════════ Développé épaules machine — de face ══════════
_ass = {'cuisseG': 273, 'tibiaG': -84, 'cuisseD': 267, 'tibiaD': -84}
FIGS['b-epaules-machine'] = M(
    'face', ('bassin', 100, 118),
    dict(_ass, brasG=118, avantbrasG=-96, brasD=-118, avantbrasD=96),
    dict(_ass, brasG=84, avantbrasG=-24, brasD=-84, avantbrasD=24),
    'poignetD',
    materiel=lambda pa, pb: (rect(66, 118, 68, 7) + ligne((74, 125), (74, SOL)) +
                             ligne((126, 125), (126, SOL)) +
                             ligne((58, 40), (58, 118)) + ligne((142, 40), (142, 118))),
    devant=lambda pa, pb: (barre_h(pa['poignetG'], 9) + barre_h(pa['poignetD'], 9) +
                           barre_h(pb['poignetG'], 9) + barre_h(pb['poignetD'], 9)))

# ══════════ Rowing machine poitrine appuyée ══════════
_rm = {'tronc': 104, 'cou': 0, 'cuisse': 152, 'tibia': -88, 'pied': 74}
FIGS['c-rowing-machine'] = M(
    'profil', ('hanche', 118, 120),
    dict(_rm, bras=86, avantbras=0),
    dict(_rm, bras=111, avantbras=135),
    'poignet',
    materiel=lambda pa, pb: (rect(96, 120, 50, 7) + ligne((104, 127), (104, SOL)) +
                             ligne((138, 127), (138, SOL)) +
                             rect(94, 56, 8, 52) + ligne((98, 108), (98, SOL)) +
                             ligne((60, 74), (60, SOL))),
    devant=lambda pa, pb: barre_h(pa['poignet'], 8) + barre_h(pb['poignet'], 8))

# ══════════ Mollets debout — l'orteil reste sur la plateforme ══════════
_mol = {'bras': 180, 'avantbras': 0}
_mol_mat = lambda pa, pb: (rect(78, 138, 52, 8) + ligne((86, 146), (86, SOL)) +
                           ligne((122, 146), (122, SOL)))
for _i in ('b-mollets', 'c-mollets'):
    FIGS[_i] = M('profil', ('orteil', 112, 138),
                 dict(_mol, pied=118), dict(_mol, pied=62), 'cheville',
                 materiel=_mol_mat)

# ══════════ Élévations latérales légères (échauffement) ══════════
FIGS['c-elev-warm'] = M(
    'face', ('bassin', 100, 104),
    {'brasG': 174, 'avantbrasG': 0, 'brasD': -174, 'avantbrasD': 0},
    {'brasG': 94, 'avantbrasG': 0, 'brasD': -94, 'avantbrasD': 0},
    'poignetD',
    devant=lambda pa, pb: (halteres(pa['poignetG']) + halteres(pa['poignetD']) +
                           halteres(pb['poignetG']) + halteres(pb['poignetD'])))

# ══════════ Fentes bulgares ══════════
_bul2 = {'cuisse2': 214, 'tibia2': -74, 'pied2': 36}
FIGS['c-bulgares'] = M(
    'profil', ('cheville', 122, SOL),
    dict(_bul2, bras=180, avantbras=0),
    dict(_bul2, tronc=74, cuisse=-74, tibia=-96, pied=110,
         cuisse2=228, tibia2=-104, pied2=60, bras=180, avantbras=0),
    'hanche',
    materiel=lambda pa, pb: banc(24, 124, 56),
    devant=lambda pa, pb: halteres(pa['poignet']) + halteres(pb['poignet']))

# ══════════ Élévations latérales haltères ══════════
FIGS['c-elev-lat'] = M(
    'face', ('bassin', 100, 104),
    {'brasG': 172, 'avantbrasG': 0, 'brasD': -172, 'avantbrasD': 0},
    {'brasG': 92, 'avantbrasG': 0, 'brasD': -92, 'avantbrasD': 0},
    'poignetD',
    devant=lambda pa, pb: (halteres(pa['poignetG']) + halteres(pa['poignetD']) +
                           halteres(pb['poignetG']) + halteres(pb['poignetD'])))

# ══════════ Tractions — les mains sont fixes, le corps monte ══════════
def _traction(ecart):
    # Jambes à peine fléchies vers l'arrière : pliées vers l'avant, elles
    # donnaient un corps cassé en deux qui ne ressemblait à rien.
    jam = {'cuisseG': 192, 'tibiaG': -26, 'cuisseD': 188, 'tibiaD': -26}
    return M(
        'face', ('poignetD', 100 + ecart, 34),
        dict(jam, brasG=180 - ecart * 1.1, avantbrasG=0, brasD=-180 + ecart * 1.1, avantbrasD=0),
        dict(jam, brasG=180 - ecart * 1.1, avantbrasG=-95, brasD=-180 + ecart * 1.1, avantbrasD=95),
        'bassin',
        materiel=lambda pa, pb: (barre_h((100, 30), 68) + ligne((32, 30), (32, 10)) +
                                 ligne((168, 30), (168, 10))),
        sol=False, ancre_b=('poignetD', 100 + ecart, 34))


FIGS['a-tractions'] = _traction(30)
FIGS['c-tractions-sup'] = _traction(19)

# ══════════ Écartés câbles croisés ══════════
FIGS['c-ecartes'] = M(
    'face', ('bassin', 100, 108),
    {'brasG': 118, 'avantbrasG': -16, 'brasD': -118, 'avantbrasD': 16},
    {'brasG': 48, 'avantbrasG': -30, 'brasD': -48, 'avantbrasD': 30},
    'poignetD',
    materiel=lambda pa, pb: (ligne((26, 44), (26, SOL)) + ligne((174, 44), (174, SOL)) +
                             ligne((26, 44), (40, 44)) + ligne((174, 44), (160, 44))),
    devant=lambda pa, pb: (cable(pa['poignetG'], (28, 46)) + cable(pa['poignetD'], (172, 46)) +
                           cable(pb['poignetG'], (28, 46)) + cable(pb['poignetD'], (172, 46))))

# ══════════ Curl à la poulie basse ══════════
FIGS['c-curl-poulie'] = M(
    'profil', ('cheville', 128, SOL),
    {'bras': 176, 'avantbras': 8, 'cuisse2': 168, 'tibia2': -14, 'pied2': 78},
    {'bras': 176, 'avantbras': 118, 'cuisse2': 168, 'tibia2': -14, 'pied2': 78},
    'poignet',
    materiel=lambda pa, pb: colonne(26, haut=118),
    devant=lambda pa, pb: (cable(pa['poignet'], (26, 122)) + cable(pb['poignet'], (26, 122)) +
                           barre_h(pa['poignet'], 11) + barre_h(pb['poignet'], 11)))

# ══════════ Leg curl assis ══════════
_lc = {'tronc': 96, 'cou': 0, 'cuisse': -84, 'bras': 168, 'avantbras': 74}
FIGS['a-legcurl'] = M(
    'profil', ('hanche', 80, 116),
    dict(_lc, tibia=-6, pied=84),
    dict(_lc, tibia=-76, pied=84),
    'cheville',
    materiel=lambda pa, pb: (rect(56, 116, 46, 7) + ligne((64, 123), (64, SOL)) +
                             rect(46, 60, 8, 48) + ligne((50, 108), (50, SOL)) +
                             rect(104, 98, 34, 6)),
    devant=lambda pa, pb: cercle(pa['cheville'], 7) + cercle(pb['cheville'], 7))

# ══════════ Relevés de jambes suspendus ══════════
FIGS['c-releves'] = M(
    'profil', ('poignet', 104, 34),
    {'tronc': 90, 'bras': 0, 'avantbras': 0, 'cuisse': 180, 'tibia': 0, 'pied': 74},
    {'tronc': 90, 'bras': 0, 'avantbras': 0, 'cuisse': 94, 'tibia': 6, 'pied': 100},
    'cheville',
    materiel=lambda pa, pb: (barre_h((104, 30), 62) + ligne((42, 30), (42, 10)) +
                             ligne((166, 30), (166, 10))),
    sol=False)


# ─────────────────── Assemblage ───────────────────

def dessine(fig):
    sq, defauts = (PROFIL, DEBOUT) if fig['vue'] == 'profil' else (FACE, DEBOUT_FACE)
    pa = resous(sq, defauts, fig['a'], fig['ancre'])
    pb = resous(sq, defauts, fig['b'], fig['ancre_b'])
    poser2 = any(k.endswith('2') for k in list(fig['a']) + list(fig['b']))

    o = ['<svg class="fig" viewBox="0 0 %d %d" role="img" aria-hidden="true">' % (W, H)]
    if fig['sol']:
        o.append(sol_())
    if fig['materiel']:
        o.append(fig['materiel'](pa, pb))
    o.append(silhouette(pa, 'fig-a', fig['vue'], poser2))
    o.append(silhouette(pb, 'fig-b', fig['vue'], poser2))
    if fig['devant']:
        o.append(fig['devant'](pa, pb))
    o.append(fleche(pa[fig['suivi']], pb[fig['suivi']]))
    o.append('</svg>')
    return ''.join(x for x in o if x)


def exercices(payload):
    out = []
    for k in payload['order']:
        for b in payload['sessions'][k]['blocs']:
            for it in b['items']:
                exos = it['exercises'] if it.get('type') == 'superset' else [it]
                out += [(e['id'], e['name']) for e in exos]
    return out


def main():
    payload = json.loads((SRC / 'payload.json').read_text(encoding='utf-8'))
    liste = exercices(payload)
    ids = [i for i, _ in liste]

    manquants = [i for i in ids if i not in FIGS]
    if manquants:
        raise SystemExit('exercices sans schéma : ' + ', '.join(manquants))
    orphelins = [i for i in FIGS if i not in ids]
    if orphelins:
        raise SystemExit('schémas orphelins (exercice supprimé ?) : ' + ', '.join(orphelins))

    out = {i: dessine(FIGS[i]) for i in ids}
    (SRC / 'figures.json').write_text(
        json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('%d schémas écrits — %.1f Ko' % (len(out), sum(len(v) for v in out.values()) / 1024))

    if '--planche' in sys.argv or '--seul' in sys.argv:
        garde = ids
        if '--seul' in sys.argv:
            garde = sys.argv[sys.argv.index('--seul') + 1].split(',')
        noms = dict(liste)
        cases = ''.join(
            '<figure><div>%s</div><figcaption>%s<br><small>%s</small></figcaption></figure>' % (
                out[i], noms[i], i) for i in garde)
        html = ('<!doctype html><meta charset="utf-8"><title>Planche des schémas</title>'
                '<style>body{background:#fdfcfa;color:#1f1d1b;font:14px system-ui;margin:18px}'
                'main{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}'
                'figure{margin:0;background:#fff;border:1px solid #e7e2d9;border-radius:12px;padding:8px}'
                'figcaption{font-size:12px;margin-top:4px}small{color:#6e675d}'
                '.fig{width:100%;height:auto;display:block}'
                '.fig-a,.fig-b,.fig-mat,.fig-sol,.fig-cable,.fig-fleche{fill:none;'
                'stroke-linecap:round;stroke-linejoin:round}'
                '.fig-a{stroke:#1f1d1b;stroke-width:2;opacity:.25}'
                '.fig-b{stroke:#1f1d1b;stroke-width:2.6}'
                '.fig-b.fig-fond{opacity:.55;stroke-width:2}'
                '.fig-a.fig-fond{opacity:.5}'
                '.fig-mat{stroke:#6e675d;stroke-width:1.9}'
                '.fig-sol{stroke:#6e675d;stroke-width:1.4;opacity:.45}'
                '.fig-cable{stroke:#6e675d;stroke-width:1.2;opacity:.8}'
                '.fig-fleche{stroke:#9d5820;stroke-width:2.2}'
                '</style><main>' + cases + '</main>')
        p = SRC.parent / 'planche-figures.html'
        p.write_text(html, encoding='utf-8')
        print('planche : ' + str(p))


if __name__ == '__main__':
    main()
