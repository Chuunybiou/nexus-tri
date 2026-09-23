/**
 * Comptes Nexus Tri : pseudonyme + mot de passe, chez nous.
 *
 * Regle du projet : un compte AJOUTE (pseudonyme reserve, historique,
 * classement) et ne retire jamais rien. Tout reste jouable sans compte.
 *
 * Choix de conception :
 * - Le mot de passe n'est jamais stocke : seulement un condensat scrypt avec
 *   son sel. La comparaison est a temps constant.
 * - Le jeton de session est signe (HMAC SHA-256) avec un secret genere au
 *   premier demarrage et garde dans le dossier de donnees. Pas de base de
 *   sessions a purger : le jeton porte sa propre date d'expiration.
 * - Le lien avec une partie passe par le « persistentId » que le navigateur
 *   possede deja. Le joueur connecte declare son appareil, et le serveur
 *   retrouve ainsi le compte a la fin d'une partie — sans toucher au
 *   protocole binaire du jeu, ou l'ajout d'un champ casserait les parties en
 *   cours (voir docs/FORK.md, zbin).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Table, dossierDonnees } from "./Stockage";

export interface Compte {
  id: string;
  pseudo: string;
  pseudoNormalise: string;
  sel: string;
  condensat: string;
  email: string | null;
  cree_le: string;
  derniere_connexion: string | null;
  /** Identifiants d'appareil (persistentId) relies a ce compte. */
  appareils: string[];
  parties: number;
  victoires: number;
  points: number;
}

interface Base {
  comptes: Compte[];
}

const table = new Table<Base>("comptes", () => ({ comptes: [] }));

const PSEUDO_MIN = 3;
const PSEUDO_MAX = 24;
const MOT_DE_PASSE_MIN = 8;
const DUREE_JETON_MS = 90 * 24 * 3600 * 1000;

function normaliser(pseudo: string): string {
  return pseudo.trim().toLowerCase();
}

export function verifierPseudo(pseudo: string): string | null {
  const p = pseudo.trim();
  if (p.length < PSEUDO_MIN || p.length > PSEUDO_MAX) {
    return `Le pseudonyme doit faire entre ${PSEUDO_MIN} et ${PSEUDO_MAX} caractères.`;
  }
  if (!/^[\p{L}\p{N} _.-]+$/u.test(p)) {
    return "Le pseudonyme accepte lettres, chiffres, espace, point, tiret et tiret bas.";
  }
  return null;
}

function condenser(motDePasse: string, sel: string): string {
  return crypto.scryptSync(motDePasse, sel, 64).toString("hex");
}

function egalConstant(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Secret de signature : genere une fois, garde avec les donnees. */
function secret(): Buffer {
  const chemin = path.join(dossierDonnees(), "secret-jetons.txt");
  try {
    return Buffer.from(fs.readFileSync(chemin, "utf8").trim(), "hex");
  } catch {
    const neuf = crypto.randomBytes(32);
    fs.mkdirSync(path.dirname(chemin), { recursive: true });
    fs.writeFileSync(chemin, neuf.toString("hex"), { mode: 0o600 });
    return neuf;
  }
}

export function creerJeton(compteId: string): string {
  const charge = Buffer.from(
    JSON.stringify({ id: compteId, exp: Date.now() + DUREE_JETON_MS }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret())
    .update(charge)
    .digest("base64url");
  return `${charge}.${signature}`;
}

export function lireJeton(jeton: string | undefined): string | null {
  if (!jeton) return null;
  const [charge, signature] = jeton.split(".");
  if (!charge || !signature) return null;
  const attendue = crypto
    .createHmac("sha256", secret())
    .update(charge)
    .digest("base64url");
  if (!egalConstant(signature, attendue)) return null;
  try {
    const { id, exp } = JSON.parse(Buffer.from(charge, "base64url").toString());
    if (typeof id !== "string" || typeof exp !== "number" || exp < Date.now()) {
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

export function parId(id: string): Compte | undefined {
  return table.lire().comptes.find((c) => c.id === id);
}

export function parPseudo(pseudo: string): Compte | undefined {
  const n = normaliser(pseudo);
  return table.lire().comptes.find((c) => c.pseudoNormalise === n);
}

export function parAppareil(persistentId: string): Compte | undefined {
  return table.lire().comptes.find((c) => c.appareils.includes(persistentId));
}

export async function creer(
  pseudo: string,
  motDePasse: string,
  email: string | null,
): Promise<Compte> {
  const sel = crypto.randomBytes(16).toString("hex");
  const compte: Compte = {
    id: crypto.randomUUID(),
    pseudo: pseudo.trim(),
    pseudoNormalise: normaliser(pseudo),
    sel,
    condensat: condenser(motDePasse, sel),
    // Chaine vide = pas d'e-mail (le champ est facultatif).
    email: email !== null && email.trim() !== "" ? email.trim() : null,
    cree_le: new Date().toISOString(),
    derniere_connexion: null,
    appareils: [],
    parties: 0,
    victoires: 0,
    points: 0,
  };
  await table.modifier((b) => {
    b.comptes.push(compte);
  });
  return compte;
}

export async function verifierMotDePasse(
  compte: Compte,
  motDePasse: string,
): Promise<boolean> {
  const ok = egalConstant(condenser(motDePasse, compte.sel), compte.condensat);
  if (ok) {
    await table.modifier((b) => {
      const c = b.comptes.find((x) => x.id === compte.id);
      if (c) c.derniere_connexion = new Date().toISOString();
    });
  }
  return ok;
}

/** Relie un appareil (persistentId) au compte, sans doublon. */
export async function lierAppareil(
  compteId: string,
  persistentId: string,
): Promise<void> {
  await table.modifier((b) => {
    for (const c of b.comptes) {
      if (c.id !== compteId) {
        // Un appareil n'appartient qu'a un compte : le dernier connecte gagne.
        c.appareils = c.appareils.filter((a) => a !== persistentId);
      }
    }
    const c = b.comptes.find((x) => x.id === compteId);
    if (c && !c.appareils.includes(persistentId))
      c.appareils.push(persistentId);
  });
}

/** Resultat d'une partie entre humains : +3 pour une victoire, +1 pour avoir joue. */
export async function enregistrerResultat(
  compteId: string,
  gagnant: boolean,
): Promise<void> {
  await table.modifier((b) => {
    const c = b.comptes.find((x) => x.id === compteId);
    if (!c) return;
    c.parties += 1;
    if (gagnant) c.victoires += 1;
    c.points += gagnant ? 3 : 1;
  });
}

/** Vue publique : jamais de sel, de condensat, d'email ni d'appareils. */
export function vuePublique(c: Compte) {
  return {
    pseudo: c.pseudo,
    parties: c.parties,
    victoires: c.victoires,
    points: c.points,
    cree_le: c.cree_le,
  };
}

export function classement(limite = 20) {
  return table
    .lire()
    .comptes.filter((c) => c.parties > 0)
    .sort((a, b) => b.points - a.points || b.victoires - a.victoires)
    .slice(0, limite)
    .map((c, i) => ({ rang: i + 1, ...vuePublique(c) }));
}

export const LIMITES = { PSEUDO_MIN, PSEUDO_MAX, MOT_DE_PASSE_MIN };
