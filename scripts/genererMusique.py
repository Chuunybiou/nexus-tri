# -*- coding: utf-8 -*-
"""Musiques de Nexus Tri, composees par synthese (aucune licence tierce a respecter).

Trois pistes : menu (ambiance sombre), partie (rythme de guerre), alerte de debut.
Tout est genere ici : ondes, enveloppes, filtres, echo. Les boucles sont raccordees
en repliant la traine sur le debut, pour qu'aucun silence ne coupe la boucle.
"""
import io, os, sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, "pylibs"))
import lameenc  # noqa: E402
import numpy as np  # noqa: E402

SR = 44100
os.chdir(r"D:\laragon\www\Projet-WEB\OpenFrontIO-main")
rng = np.random.default_rng(7)


def t(n):
    return np.arange(n) / SR


def env(n, attaque, chute, tenue=1.0, relache=0.3):
    """Enveloppe attaque / chute / tenue / relache, en secondes."""
    a, d, r = int(attaque * SR), int(chute * SR), int(relache * SR)
    a, d, r = min(a, n), min(d, n), min(r, n)
    e = np.full(n, tenue, dtype=np.float64)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if d:
        fin = min(a + d, n)
        e[a:fin] = np.linspace(1, tenue, fin - a)
    if r:
        e[n - r:] *= np.linspace(1, 0, r)
    return e


def saw(freq, n, detune=0.0):
    """Dent de scie additive (10 harmoniques) : chaude, sans repliement brutal."""
    x = np.zeros(n)
    for k in range(1, 11):
        f = freq * k * (1 + detune)
        if f > SR / 2.2:
            break
        x += np.sin(2 * np.pi * f * t(n)) / k
    return x


def sine(freq, n, phase=0.0):
    return np.sin(2 * np.pi * freq * t(n) + phase)


def passe_bas(x, coupure):
    """Un pole, simple et suffisant pour arrondir les dents de scie."""
    a = np.exp(-2 * np.pi * coupure / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(x.size):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def bruit(n):
    return rng.normal(0, 1, n)


def echo(x, retard, retour=0.35, melange=0.3):
    d = int(retard * SR)
    y = x.copy()
    for i in range(d, x.size):
        y[i] += retour * y[i - d]
    return (1 - melange) * x + melange * y


def boucle(x, traine):
    """Replie les dernieres secondes sur le debut : la boucle ne claque pas."""
    d = int(traine * SR)
    y = x[:-d].copy()
    fondu = np.linspace(1, 0, d)
    y[:d] += x[-d:] * fondu
    return y


def place(piste, x, depart, gain=1.0):
    i = int(depart * SR)
    fin = min(i + x.size, piste.size)
    if fin > i:
        piste[i:fin] += gain * x[:fin - i]


def stereo(gauche, droite):
    m = max(np.abs(gauche).max(), np.abs(droite).max(), 1e-9)
    g, d = gauche / m * 0.89, droite / m * 0.89
    inter = np.empty(g.size * 2)
    inter[0::2], inter[1::2] = g, d
    return inter


def mp3(inter, fichier, debit=112):
    enc = lameenc.Encoder()
    enc.set_bit_rate(debit); enc.set_in_sample_rate(SR); enc.set_channels(2); enc.set_quality(2)
    pcm = np.clip(inter, -1, 1)
    data = enc.encode((pcm * 32767).astype("<i2").tobytes()) + enc.flush()
    io.open(fichier, "wb").write(data)
    print("  %-44s %5.1f s  %5.0f Ko" % (fichier, inter.size / 2 / SR, len(data) / 1024))


NOTE = {"D1": 36.71, "D2": 73.42, "A1": 55.0, "F2": 87.31, "Bb1": 58.27, "C2": 65.41,
        "D3": 146.83, "F3": 174.61, "A3": 220.0, "Bb2": 116.54, "C3": 130.81, "G2": 98.0}


# ── 1. Menu : sombre, lent, sans rythme ─────────────────────────────────────
def menu(duree=76.0, traine=4.0):
    n = int((duree + traine) * SR)
    g, d = np.zeros(n), np.zeros(n)

    # bourdon grave continu, deux oscillateurs desaccordes = battement lent
    bourdon = 0.5 * (sine(NOTE["D1"], n) + sine(NOTE["D1"] * 1.004, n))
    bourdon *= 0.6 + 0.4 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * t(n)))
    g += 0.33 * bourdon; d += 0.33 * bourdon

    # quatre nappes de 19 s : Dm, Bb, F, Cm — la marche harmonique du morceau
    accords = [("D2", "F2", "A3"), ("Bb1", "D3", "F3"), ("F2", "A3", "C3"), ("C2", "G2", "Bb2")]
    for i, accord in enumerate(accords):
        m = int(20.0 * SR)
        nappe = np.zeros(m)
        for j, nom in enumerate(accord):
            f = NOTE[nom]
            nappe += saw(f, m, detune=0.0015 * (j - 1)) * (0.9 if j == 0 else 0.55)
        nappe = passe_bas(nappe, 700) * env(m, 3.5, 2.0, 0.85, 4.0)
        cote = 0.5 + 0.18 * (1 if i % 2 else -1)   # alternance gauche/droite
        place(g, nappe, i * 19.0, 0.30 * (1 - cote + 0.5))
        place(d, nappe, i * 19.0, 0.30 * (cote + 0.5) * 0.9)

    # souffle : bruit filtre qui enfle et retombe, comme un vent de poussiere
    for depart in (2.0, 24.0, 46.0, 63.0):
        m = int(11.0 * SR)
        souffle = passe_bas(bruit(m), 420) * env(m, 5.0, 0.1, 1.0, 5.5)
        place(g, souffle, depart, 0.5); place(d, souffle, depart + 0.35, 0.5)

    # cloches lointaines (synthese FM) : quelques points de lumiere
    for depart, f in ((7.0, 587.33), (21.5, 440.0), (33.0, 349.23), (52.0, 587.33), (68.0, 293.66)):
        m = int(4.5 * SR)
        mod = sine(f * 1.41, m) * 2.2 * env(m, 0.001, 1.2, 0.0, 0.2)
        cloche = np.sin(2 * np.pi * f * t(m) + mod) * env(m, 0.005, 3.5, 0.0, 0.5)
        cloche = echo(cloche, 0.42, 0.42, 0.45)
        cote = rng.uniform(0.25, 0.75)
        place(g, cloche, depart, 0.20 * (1 - cote)); place(d, cloche, depart, 0.20 * cote)

    return stereo(boucle(g, traine), boucle(d, traine))


# ── 2. En partie : rythme de guerre, tendu mais repetitif ───────────────────
def partie(bpm=100.0, mesures=48, traine=3.0):
    noire = 60.0 / bpm
    duree = mesures * 4 * noire
    n = int((duree + traine) * SR)
    g, d = np.zeros(n), np.zeros(n)

    def grosse_caisse(m):
        f = 120 * np.exp(-np.linspace(0, 6, m))      # chute de hauteur : le « boum »
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(m, 0.002, 0.35, 0.0, 0.05)
        return x + 0.25 * bruit(m) * env(m, 0.001, 0.03, 0.0, 0.01)

    def caisse(m):
        return (passe_bas(bruit(m), 3500) * env(m, 0.002, 0.22, 0.0, 0.05)
                + 0.4 * sine(190, m) * env(m, 0.002, 0.12, 0.0, 0.03))

    def charley(m):
        return (bruit(m) - passe_bas(bruit(m), 5000)) * env(m, 0.001, 0.05, 0.0, 0.02)

    court = int(0.42 * SR)
    for mesure in range(mesures):
        base = mesure * 4 * noire
        for temps in range(4):
            place(g, grosse_caisse(court), base + temps * noire, 0.85)
            place(d, grosse_caisse(court), base + temps * noire, 0.85)
            if temps in (1, 3):
                cs = caisse(int(0.3 * SR))
                place(g, cs, base + temps * noire, 0.42); place(d, cs, base + temps * noire, 0.40)
            for demi in (0, 0.5):
                ch = charley(int(0.09 * SR))
                gain = 0.16 if demi else 0.22
                place(g, ch, base + (temps + demi) * noire, gain * 0.8)
                place(d, ch, base + (temps + demi) * noire, gain)

        # basse en croches, la note change toutes les 4 mesures
        racine = [NOTE["D1"], NOTE["D1"], NOTE["Bb1"], NOTE["C2"] / 2][(mesure // 4) % 4]
        for croche in range(8):
            m = int(noire * 0.48 * SR)
            b = passe_bas(saw(racine, m), 260) * env(m, 0.004, 0.18, 0.55, 0.06)
            place(g, b, base + croche * noire / 2, 0.5); place(d, b, base + croche * noire / 2, 0.5)

        # nappe tendue toutes les 4 mesures, en quinte
        if mesure % 4 == 0:
            m = int(4 * 4 * noire * SR)
            f = [NOTE["D2"], NOTE["D2"], NOTE["Bb1"], NOTE["C2"]][(mesure // 4) % 4]
            nappe = passe_bas(saw(f, m, 0.002) + saw(f * 1.5, m, -0.002) * 0.6, 900)
            nappe *= env(m, 1.2, 1.0, 0.8, 1.5)
            place(g, nappe, base, 0.16); place(d, nappe, base, 0.15)

        # coup de cuivre sur la derniere mesure de chaque groupe de 8
        if mesure % 8 == 7:
            m = int(noire * 1.6 * SR)
            f = NOTE["D3"]
            stab = passe_bas(saw(f, m, 0.004) + saw(f * 0.5, m, -0.004), 1600)
            stab *= env(m, 0.02, 0.5, 0.35, 0.4)
            stab = echo(stab, noire / 2, 0.3, 0.25)
            place(g, stab, base + 2 * noire, 0.22); place(d, stab, base + 2 * noire, 0.22)

    return stereo(boucle(g, traine), boucle(d, traine))


# ── 3. Alerte de debut de partie ────────────────────────────────────────────
def alerte(duree=1.7):
    n = int(duree * SR)
    g = np.zeros(n)
    for i, (depart, f) in enumerate(((0.0, 880.0), (0.42, 660.0), (0.84, 880.0))):
        m = int(0.38 * SR)
        x = (sine(f, m) + 0.4 * sine(f * 2, m)) * env(m, 0.01, 0.15, 0.6, 0.12)
        place(g, x, depart, 0.6 if i < 2 else 0.75)
    montee = sine(300, n) * 0  # place pour une montee de bruit
    m = int(0.9 * SR)
    montee = passe_bas(bruit(m), 900) * env(m, 0.6, 0.1, 1.0, 0.3)
    place(g, montee, 0.8, 0.25)
    g = echo(g, 0.14, 0.25, 0.2)
    return stereo(g, np.roll(g, 120))


print("  synthese en cours (quelques minutes)")
mp3(alerte(), "resources/sounds/effects/game-start-alert.mp3", 96)
mp3(menu(), "resources/sounds/music/menu-theme.mp3", 112)
mp3(partie(), "resources/sounds/music/gameplay.mp3", 112)
