#!/usr/bin/env python3
"""Assemble les morceaux de src/ en un index.html autonome."""
import hashlib
import json
import pathlib
import sys

SRC = pathlib.Path(__file__).resolve().parent
ROOT = SRC.parent


def read(name):
    return (SRC / name).read_text(encoding="utf-8")


def main():
    shell = read("shell.html")
    css = read("style.css")
    js = read("app.js")
    payload_raw = read("payload.json")
    figures_raw = read("figures.json")

    # Contrôle : le programme doit être un JSON valide et cohérent.
    payload = json.loads(payload_raw)
    ids = []
    ids_exos = []
    for key in payload["order"]:
        sess = payload["sessions"][key]
        for bloc in sess["blocs"]:
            for item in bloc["items"]:
                exos = item["exercises"] if item.get("type") == "superset" else [item]
                if item.get("type") == "superset":
                    ids.append(item["id"])
                for ex in exos:
                    ids.append(ex["id"])
                    ids_exos.append(ex["id"])
                    for champ in ("name", "sub", "execution"):
                        if not ex.get(champ):
                            sys.exit(f"champ '{champ}' manquant sur {ex.get('id')}")
    doublons = {i for i in ids if ids.count(i) > 1}
    if doublons:
        sys.exit(f"identifiants en doublon : {sorted(doublons)}")

    # Un exercice sans schéma passerait inaperçu à l'écran : le volet s'ouvrirait
    # simplement sans dessin. On le refuse ici plutôt que de le découvrir en salle.
    figures = json.loads(figures_raw)
    sans = [i for i in ids_exos if i not in figures]
    if sans:
        sys.exit(f"exercices sans schéma : {sans} — lancer python3 src/figures.py")

    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    figs = json.dumps(figures, ensure_ascii=False, separators=(",", ":"))
    if "</script" in (compact + figs).lower():
        sys.exit("le programme contient une balise de fermeture de script")

    out = shell
    for marqueur, contenu in (("/*__CSS__*/", css), ("/*__PAYLOAD__*/", compact),
                              ("/*__FIGURES__*/", figs), ("/*__JS__*/", js)):
        if marqueur not in out:
            sys.exit(f"marqueur {marqueur} absent de shell.html")
        out = out.replace(marqueur, contenu)

    # Empreinte : le pilote de vérification s'en sert pour refuser de tester une
    # version périmée servie par un cache.
    empreinte = hashlib.sha256((css + js + compact + figs).encode("utf-8")).hexdigest()[:12]
    out = out.replace("__BUILD__", empreinte)

    cible = ROOT / "index.html"
    cible.write_text(out, encoding="utf-8")
    print(f"index.html écrit — build {empreinte} — {len(out) / 1024:.0f} Ko · {len(ids)} identifiants · {len(payload['order'])} séances")


if __name__ == "__main__":
    main()
