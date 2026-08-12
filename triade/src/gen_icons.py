#!/usr/bin/env python3
"""Génère les icônes de l'application : trois barres, une par séance."""
import pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
N = 1024
FOND = (14, 17, 23, 255)
BARRES = [
    ((59, 91, 219), (95, 61, 196), 0.52),    # A · Socle
    ((232, 89, 12), (240, 140, 0), 0.78),    # B · Charnière
    ((12, 166, 120), (16, 152, 173), 0.96),  # C · Amplitude
]


def degrade(taille, c1, c2):
    """Bande verticale en dégradé de c1 (haut) vers c2 (bas)."""
    w, h = taille
    img = Image.new("RGB", (1, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))
    return img.resize((w, h), Image.NEAREST)


def dessine(masque_ronde=True):
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if masque_ronde:
        d.rounded_rectangle([0, 0, N - 1, N - 1], radius=int(N * 0.22), fill=FOND)
    else:
        d.rectangle([0, 0, N - 1, N - 1], fill=FOND)

    marge = N * 0.22          # zone sûre pour le masque des icônes maskable
    largeur = N * 0.115
    ecart = N * 0.075
    total = 3 * largeur + 2 * ecart
    x = (N - total) / 2
    bas = N - marge

    for (c1, c2, part) in BARRES:
        haut = bas - (N - 2 * marge) * part
        boite = (round(x), round(haut), round(x + largeur), round(bas))
        bande = degrade((boite[2] - boite[0], boite[3] - boite[1]), c1, c2)
        forme = Image.new("L", bande.size, 0)
        ImageDraw.Draw(forme).rounded_rectangle(
            [0, 0, bande.size[0] - 1, bande.size[1] - 1], radius=int(largeur / 2), fill=255
        )
        img.paste(bande, (boite[0], boite[1]), forme)
        x += largeur + ecart
    return img


def main():
    ronde = dessine(True)
    carree = dessine(False)
    for taille in (192, 512):
        ronde.resize((taille, taille), Image.LANCZOS).save(ROOT / f"icon-{taille}.png")
    # iOS applique son propre masque : on lui donne un carré plein.
    carree.resize((180, 180), Image.LANCZOS).convert("RGB").save(ROOT / "icon-180.png")

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0e1117"/>
  <defs>
    <linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b5bdb"/><stop offset="1" stop-color="#5f3dc4"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8590c"/><stop offset="1" stop-color="#f08c00"/></linearGradient>
    <linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0ca678"/><stop offset="1" stop-color="#1098ad"/></linearGradient>
  </defs>
  <rect x="15" y="31.7" width="7.4" height="18.3" rx="3.7" fill="url(#a)"/>
  <rect x="27.3" y="22.6" width="7.4" height="27.4" rx="3.7" fill="url(#b)"/>
  <rect x="39.6" y="16.3" width="7.4" height="33.7" rx="3.7" fill="url(#c)"/>
</svg>
"""
    (ROOT / "favicon.svg").write_text(svg, encoding="utf-8")
    print("icônes écrites : icon-192.png, icon-512.png, icon-180.png, favicon.svg")


if __name__ == "__main__":
    main()
