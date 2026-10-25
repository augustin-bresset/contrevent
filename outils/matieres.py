#!/usr/bin/env python3
# Prépare les matières du sol à partir de scans Poly Haven (CC0) : python3 outils/matieres.py <dossier des scans>
# Chaque scan est aplani (plus de grandes taches qui trahiraient la répétition), puis empaqueté en deux images :
#   <nom>-c.webp : la couleur ;  <nom>-n.webp : pente en x, pente en y, hauteur.
import sys, os
import numpy as np
from PIL import Image

SCANS = sys.argv[1]
SORTIE = os.path.join(os.path.dirname(__file__), '..', 'src', 'rendu', 'matieres')
TAILLE = 1024
# nom : (scan, force de la pente)
COUCHES = {
    'sable': ('aerial_beach_01', 1.0), 'strate': ('cliff_side', 1.0), 'falaise': ('marble_cliff_01', 1.0), 'gravier': ('dry_ground_rocks', 1.0),
    'neige': ('snow_02', 1.0), 'prairie': ('grass_path_2', 1.0), 'craquele': ('mud_cracked_dry_03', 1.0), 'cendre': ('moon_dusted_01', 1.0),
}

def lire(nom, suffixe):
    for ext in ('jpg', 'png'):
        p = os.path.join(SCANS, f'{nom}_{suffixe}.{ext}')
        if os.path.exists(p):
            return np.asarray(Image.open(p).convert('RGB').resize((TAILLE, TAILLE), Image.LANCZOS), dtype=np.float32) / 255
    raise FileNotFoundError(nom)

def flou(a, sigma):   # gaussien périodique : ce qui sort de la texture rentre de l'autre côté
    n = a.shape[0]
    f = np.fft.fftfreq(n)
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (f[None, :] ** 2 + f[:, None] ** 2))
    if a.ndim == 2:
        return np.fft.ifft2(np.fft.fft2(a) * g).real
    return np.stack([np.fft.ifft2(np.fft.fft2(a[..., i]) * g).real for i in range(a.shape[2])], -1)

# Un scan n'est pas toujours raccord d'un bord à l'autre : on fond chaque bord dans la texture décalée d'une demi-tuile.
def raccord(a, m=48):
    n = a.shape[0]
    w = np.minimum(np.minimum(np.arange(n), n - 1 - np.arange(n)) / m, 1).astype(np.float32)
    w = w * w * (3 - 2 * w)
    wx, wy = w[None, :], w[:, None]
    if a.ndim == 3: wx, wy = wx[..., None], wy[..., None]
    b = np.roll(a, n // 2, 1)
    a = a * wx + b * (1 - wx)
    c = np.roll(a, n // 2, 0)
    return a * wy + c * (1 - wy)

lin = lambda c: np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
srgb = lambda c: np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.maximum(c, 1e-6), 1 / 2.4) - 0.055)

# Les matériaux du bâti, plus petits : on ne les voit que sur les monuments.
BATI = {'bati-pierre': ('medieval_blocks_05', 1.0), 'bati-mur': ('plastered_stone_wall', 1.0), 'bati-bois': ('weathered_planks', 1.0), 'bati-toile': ('hessian_230', 1.0)}

os.makedirs(SORTIE, exist_ok=True)
total = 0
for nom, (scan, force) in {**COUCHES, **BATI}.items():
    TAILLE = 512 if nom.startswith('bati') else 1024
    c = raccord(lin(lire(scan, 'diff')))
    fond = flou(c, TAILLE / 9)
    moyenne = c.reshape(-1, 3).mean(0)
    c = np.clip(c / np.maximum(fond, 1e-3) * moyenne, 0, 1)
    n = raccord(lire(scan, 'nor')[..., :2] * 2 - 1)
    n = n - flou(n, TAILLE / 9)
    n = np.clip(n * force * 0.5 + 0.5, 0, 1)
    h = raccord(lire(scan, 'disp')[..., 0])
    h = h - flou(h, TAILLE / 5)
    a, b = np.percentile(h, 1), np.percentile(h, 99)
    h = np.clip((h - a) / max(b - a, 1e-4), 0, 1)
    p1 = os.path.join(SORTIE, f'{nom}-c.webp'); p2 = os.path.join(SORTIE, f'{nom}-n.webp')
    Image.fromarray((srgb(c) * 255 + 0.5).astype(np.uint8)).save(p1, quality=72, method=6)
    Image.fromarray((np.dstack([n, h]) * 255 + 0.5).astype(np.uint8)).save(p2, quality=80, method=6)
    t = os.path.getsize(p1) + os.path.getsize(p2); total += t
    print(f'{nom:10s} {scan:24s} moyenne {moyenne.round(3)}  {t // 1024} Ko')
print('total', total // 1024, 'Ko')
