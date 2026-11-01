#!/usr/bin/env python3
# Prépare le vent enregistré : pour chaque couche, choisit le passage le plus propre d'un enregistrement,
# le referme en boucle, et l'écrit en mp3 dans src/sons/vent.js. Sources : voir le README (toutes en CC0).
# python3 outils/vent.py <dossier des sources> [--analyse]
import base64, json, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfiltfilt

SR = 44100
ANNEAU = 3.0      # le raccord, en secondes
MARGE = 0.4       # ce que le mp3 peut décaler : la boucle se joue à l'intérieur de ces marges
# nom : source, durée, stéréo, passe-haut, niveau visé (dB RMS), réduction de la bande (Hz), début imposé (ou None)
COUCHES = {
    'leger': ('711105.mp3', 34, True, 90, -25, None),
    'plaine': ('167684.mp3', 38, True, 70, -21, None),
    'dunes': ('393567.mp3', 31, True, 70, -22, None),
    'tempete': ('146914.mp3', 40, True, 60, -19, None),
    'chant': ('349186.mp3', 29, False, 120, -23, None),
    'fil': ('147777.mp3', 23, False, 120, -24, None),
    'abri': ('557380.mp3', 26, True, 60, -24, None),
}

def lire(chemin):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(chemin), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).reshape(-1, 2).astype(np.float64)

def bande(x, a, b):
    return sosfiltfilt(butter(4, [a, b], 'bandpass', fs=SR, output='sos'), x)

def trames(x, n):
    k = len(x) // n
    return np.sqrt(np.mean(x[:k * n].reshape(k, n) ** 2, axis=1) + 1e-12)

def noter(x):
    # Le souffle sur le micro : des coups de grave brefs. Le choc : une crête isolée. Le passage doit aussi vivre un peu.
    m = x.mean(axis=1)
    bas = trames(bande(m, 25, 110), SR // 10)
    tout = trames(m, SR // 10)
    coups = float(np.percentile(bas, 99) / (np.median(bas) + 1e-9))
    crete = float(np.abs(m).max() / (np.sqrt(np.mean(m ** 2)) + 1e-9))
    vie = float(np.std(20 * np.log10(tout)))
    return coups, crete, vie

def meilleur(x, duree):
    n = int(duree * SR)
    if len(x) <= n + SR: return 0
    res = []
    for d in range(0, len(x) - n, SR * 2):
        coups, crete, vie = noter(x[d:d + n])
        res.append((coups * 0.5 + crete * 0.4 + max(0, 2.2 - vie) * 2 + max(0, vie - 7) * 1.5, d))
    return min(res)[1]

def refermer(x, duree):
    n, a = int(duree * SR), int(ANNEAU * SR)
    t = np.linspace(0, np.pi / 2, a)[:, None]
    y = x[:n].copy()
    y[:a] = x[:a] * np.sin(t) + x[n:n + a] * np.cos(t)
    return y

def traiter(nom, dossier, analyse):
    src, duree, stereo, hp, niveau, debut = COUCHES[nom]
    x = lire(Path(dossier) / src)
    sos = butter(3, hp, 'highpass', fs=SR, output='sos')
    x = sosfiltfilt(sos, x, axis=0)
    d = meilleur(x, duree + ANNEAU) if debut is None else int(debut * SR)
    y = x[d:d + int((duree + ANNEAU) * SR)]
    print(f'{nom:8s} {src} début {d / SR:6.1f}s  coups/crête/vie', *(f'{v:.2f}' for v in noter(y)))
    if analyse: return None
    y = refermer(y, duree)
    if not stereo: y = np.repeat(y.mean(axis=1, keepdims=True), 2, axis=1)
    y *= 10 ** (niveau / 20) / np.sqrt(np.mean(y ** 2))
    y = np.tanh(y * 1.0)
    m = int(MARGE * SR)
    z = np.concatenate([y[-m:], y, y[:m]])
    with tempfile.TemporaryDirectory() as t:
        w = Path(t) / 'a.raw'; w.write_bytes(z.astype(np.float32).tobytes())
        s = Path(t) / 'a.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', str(w), '-ac', '2' if stereo else '1', '-c:a', 'libmp3lame', '-b:a', '88k' if stereo else '56k', '-reservoir', '0', str(s)], check=True)
        b = s.read_bytes()
    return {'m': MARGE, 'l': len(y) / SR, 'b': base64.b64encode(b).decode()}

if __name__ == '__main__':
    dossier, analyse = sys.argv[1], '--analyse' in sys.argv
    sortie = {n: traiter(n, dossier, analyse) for n in COUCHES}
    if not analyse:
        p = Path(__file__).parent.parent / 'src/sons/vent.js'
        p.write_text('// Le vent enregistré, préparé par outils/vent.py : marge, longueur de la boucle, mp3 en base64.\nexport const SONS = ' + json.dumps(sortie) + ';\n', encoding='utf8')
        print('écrit', p, p.stat().st_size // 1024, 'Ko')
