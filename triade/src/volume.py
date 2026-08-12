#!/usr/bin/env python3
"""Compte le volume hebdomadaire par muscle produit par le programme.

Méthode des « séries fractionnées » : une série compte 1 pour le muscle visé,
0,5 pour un muscle secondaire. C'est la convention employée par la méta-analyse
de Pelland et coll. (Sports Med, 2026) sur la relation dose-réponse.

Les blocs d'échauffement ne sont pas comptés — ils ne sont pas là pour ça.
Tout exercice absent de la table ci-dessous est SIGNALÉ : sans ça, ajouter un
exercice sans le classer ferait silencieusement baisser le total.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# exercice -> {muscle: 1 direct | 0.5 indirect}
MUSCLES = {
    "a-bandpull": {"deltoïdes postérieurs": 1},
    "a-squat": {"quadriceps": 1, "fessiers": 1, "ischio-jambiers": .5, "adducteurs": .5},
    "a-couche": {"pectoraux": 1, "triceps": .5, "deltoïdes antérieurs": .5},
    "a-tractions": {"dorsaux": 1, "biceps": .5, "dos, épaisseur": .5},
    "a-militaire-hal": {"deltoïdes antérieurs": 1, "deltoïdes latéraux": .5, "triceps": .5},
    "a-legcurl": {"ischio-jambiers": 1},
    "a-facepull": {"deltoïdes postérieurs": 1, "dos, épaisseur": .5},
    "a-elev-lat": {"deltoïdes latéraux": 1},
    "a-roue": {"abdominaux": 1},
    "a-couche-hal": {"pectoraux": 1, "triceps": .5, "deltoïdes antérieurs": .5},
    "a-rowing-hal": {"dos, épaisseur": 1, "dorsaux": .5, "biceps": .5, "deltoïdes postérieurs": .5},
    "b-epaules-machine": {"deltoïdes antérieurs": 1, "deltoïdes latéraux": .5, "triceps": .5},
    "b-rdl": {"ischio-jambiers": 1, "fessiers": 1, "lombaires": .5},
    "b-militaire": {"deltoïdes antérieurs": 1, "deltoïdes latéraux": .5, "triceps": .5},
    "b-rowing": {"dos, épaisseur": 1, "dorsaux": 1, "biceps": .5, "deltoïdes postérieurs": .5},
    "b-incline": {"pectoraux": 1, "deltoïdes antérieurs": .5, "triceps": .5},
    "b-presse": {"quadriceps": 1, "fessiers": .5},
    "b-curl-incline": {"biceps": 1},
    "b-triceps-oh": {"triceps": 1},
    "b-mollets": {"mollets": 1},
    "c-bulgares": {"quadriceps": 1, "fessiers": 1},
    "c-tractions-sup": {"dorsaux": 1, "biceps": .5},
    "c-dips": {"pectoraux": 1, "triceps": .5},
    "c-hipthrust": {"fessiers": 1, "ischio-jambiers": .5},
    "c-ecartes": {"pectoraux": 1},
    "c-elev-lat": {"deltoïdes latéraux": 1},
    "c-legext": {"quadriceps": 1},
    "c-mollets": {"mollets": 1},
    "c-curl-poulie": {"biceps": 1},
    "c-releves": {"abdominaux": 1},
    "c-rowing-machine": {"dos, épaisseur": 1, "dorsaux": .5, "biceps": .5, "deltoïdes postérieurs": .5},
}

ECHAUFFEMENT = {"a-cardio", "a-mobilite", "b-cardio", "b-hinge", "b-deadbug",
                "c-cardio", "c-elev-warm", "c-fentes-warm"}


def main():
    d = json.loads((ROOT / "src/payload.json").read_text(encoding="utf-8"))
    total, orphelins = {}, []

    for cle in d["order"]:
        for bloc in d["sessions"][cle]["blocs"]:
            for item in bloc["items"]:
                if item.get("type") == "superset":
                    paires = [(e, item["rounds"]) for e in item["exercises"]]
                else:
                    paires = [(item, item.get("sets", 0))]
                for ex, series in paires:
                    if ex["id"] in ECHAUFFEMENT:
                        continue
                    if ex["id"] not in MUSCLES:
                        orphelins.append(ex["id"])
                        continue
                    for muscle, poids in MUSCLES[ex["id"]].items():
                        total[muscle] = total.get(muscle, 0) + series * poids

    if orphelins:
        print("⚠ exercices non classés — le total les ignore : " + ", ".join(sorted(set(orphelins))))

    print(f"{'muscle':<24}{'séries/sem':>11}   repère")
    for muscle, v in sorted(total.items(), key=lambda x: -x[1]):
        repere = "élevé" if v >= 18 else "bon" if v >= 10 else "juste" if v >= 6 else "faible"
        print(f"{muscle:<24}{v:>11.1f}   {repere}")

    faibles = [m for m, v in total.items() if v < 6 and m not in ("adducteurs", "lombaires")]
    if faibles:
        print("\n⚠ sous 6 séries par semaine hors travail indirect assumé : " + ", ".join(faibles))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
