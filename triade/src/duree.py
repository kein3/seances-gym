#!/usr/bin/env python3
"""Calcule les durées de séance et les ÉCRIT dans le programme.

Une durée tapée à la main devient fausse au premier exercice ajouté. Ici elle est
déduite du contenu : temps de travail estimé (répétitions × tempo), repos réels,
mise en place, et montée en charge pour les mouvements lourds.

  python3 src/duree.py            → affiche le détail et met à jour payload.json
  python3 src/duree.py --verifie  → n'écrit rien, sort en erreur si un écart existe
"""
import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FICHIER = ROOT / "src/payload.json"

MISE_EN_PLACE = 45      # trouver la machine, régler, charger
MISE_EN_PLACE_SS = 60   # un superset occupe deux postes
MONTEE_EN_CHARGE = 240  # 3 séries progressives avant un mouvement lourd
SEUIL_LOURD = 150       # au-delà de ce repos, l'exercice est traité comme lourd
BATTEMENT = 180         # transitions, gourde, attente d'un banc


def secondes_par_rep(ex):
    """Durée d'une répétition, d'après le tempo s'il est chiffré."""
    t = str(ex.get("tempo", ""))
    chiffres = re.findall(r"\d+", t)
    if len(chiffres) >= 3:
        return max(2.0, sum(int(c) for c in chiffres[:3]) + 0.5)
    return 3.5


def travail(ex):
    """Temps d'une série, en secondes."""
    reps = str(ex.get("reps", "10"))

    m = re.match(r"^\s*(\d+)\s*min", reps)      # « 4 min » = cardio, la série EST la durée
    if m:
        return int(m.group(1)) * 60
    m = re.match(r"^\s*(\d+)\s*(?:s|sec)", reps)
    if m:
        return int(m.group(1))

    nombres = [int(n) for n in re.findall(r"\d+", reps)]
    if not nombres:
        return 40
    n = nombres[0]
    if len(nombres) > 1 and "+" in reps:        # « 10 squats + 6 fentes »
        n = sum(nombres)
    duree = n * secondes_par_rep(ex)
    unilateral = bool(re.search(r"/\s*(jambe|côté|bras)", reps))
    if unilateral:
        duree *= 2
    # Plafond : personne ne tient un tempo strict sur une longue série. Sans ce
    # plafond, le modèle annonce des séries de 100 s et gonfle toute la séance.
    return min(130 if unilateral else 70, max(25, duree))


def duree_item(item):
    if item.get("type") == "superset":
        tours = item["rounds"]
        boucle = sum(travail(e) for e in item["exercises"])
        return MISE_EN_PLACE_SS + tours * boucle + (tours - 1) * item["rest"]
    series = item.get("sets", 1)
    rest = item.get("rest", 0) or 0
    total = MISE_EN_PLACE + series * travail(item) + max(0, series - 1) * rest
    if rest >= SEUIL_LOURD:
        total += MONTEE_EN_CHARGE
    return total


def label_repos(sec):
    if not sec:
        return None
    if sec % 60 == 0:
        return f"{sec // 60} min"
    if sec < 60:
        return f"{sec} sec"
    return f"{sec // 60}'{sec % 60:02d}"


def main():
    verifie = "--verifie" in sys.argv
    d = json.loads(FICHIER.read_text(encoding="utf-8"), object_pairs_hook=collections.OrderedDict)
    ecarts = []

    for cle in d["order"]:
        sess = d["sessions"][cle]
        total = BATTEMENT
        print(f"\n{sess['code']} · {sess['title']}")
        for bloc in sess["blocs"]:
            sec = sum(duree_item(it) for it in bloc["items"])
            total += sec
            repos = {it.get("rest") or (it["rest"] if it.get("type") == "superset" else 0)
                     for it in bloc["items"]}
            repos = {r for r in repos if r}
            texte = f"~{round(sec / 60)} min"
            if len(repos) == 1:
                texte += f" · repos {label_repos(repos.pop())}"
            if bloc.get("duration") != texte:
                ecarts.append(f"{sess['title']} / bloc {bloc['n']} : « {bloc.get('duration')} » → « {texte} »")
            bloc["duration"] = texte
            series = sum(it["rounds"] * len(it["exercises"]) if it.get("type") == "superset"
                         else it.get("sets", 0) for it in bloc["items"])
            print(f"   {bloc['n']} {bloc['name']:<38}{round(sec/60):>4} min   {series:>2} séries")
        texte = f"~{round(total / 60)} min"
        if sess.get("duration") != texte:
            ecarts.append(f"{sess['title']} : « {sess.get('duration')} » → « {texte} »")
        sess["duration"] = texte
        print(f"   {'TOTAL, battement compris':<41}{round(total/60):>4} min")

    if verifie:
        for e in ecarts:
            print("✗ " + e)
        print(f"\n{len(ecarts)} durée(s) en désaccord avec le contenu")
        return 1 if ecarts else 0

    FICHIER.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{len(ecarts)} durée(s) corrigée(s) dans payload.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
