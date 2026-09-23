/**
 * Resultats de partie -> comptes Starfall.
 *
 * Regle voulue : le classement ne compte QUE les parties entre humains. Les
 * parties contre des robots ne rapportent rien, sinon il suffirait de gagner
 * contre des robots toute la journee pour monter.
 *
 * Comment on sait qui est humain : `info.players` ne contient que les clients
 * connectes (les robots ne sont pas des clients). Deux entrees ou plus = au
 * moins deux humains.
 *
 * Chemin des donnees : la partie tourne dans un processus « worker », mais les
 * fichiers de comptes n'appartiennent qu'au processus principal (un seul
 * ecrivain, sinon deux processus ecrasent le fichier l'un de l'autre). Le
 * worker envoie donc un petit message par le canal deja existant entre les
 * processus (IPC), et le principal applique. Rien ne passe par le protocole
 * binaire du jeu, qu'on ne touche pas (voir docs/FORK.md).
 */
import type { Worker } from "cluster";
import type { PartialGameRecord } from "../../core/Schemas";
import {
  WorkerMessageSchema,
  type WorkerPartieTerminee,
} from "../IPCBridgeSchema";
import { logger } from "../Logger";
import { enregistrerResultat, parAppareil } from "./Comptes";

const log = logger.child({ comp: "resultats" });

/**
 * Traduit une partie terminee en message pour le processus principal.
 * Renvoie null si la partie ne compte pas pour le classement.
 */
export function messageDePartie(
  record: PartialGameRecord,
): WorkerPartieTerminee | null {
  const joueurs = record.info.players;
  // Moins de deux humains : partie solo ou contre des robots, on n'enregistre
  // rien.
  if (joueurs.length < 2) return null;

  const winner = record.info.winner;
  let gagnants: string[] = [];
  if (winner !== undefined) {
    // ["player", idClient] | ["team", nomEquipe, ...idsClients]
    // ["nation", nom, ...] = une nation non humaine l'emporte : personne ne
    // gagne, mais tout le monde a joue.
    if (winner[0] === "player") gagnants = winner.slice(1) as string[];
    else if (winner[0] === "team") gagnants = winner.slice(2) as string[];
  }

  // On raisonne en « identifiant d'appareil » (persistentID) : c'est lui que le
  // compte declare lors de la connexion. L'identifiant de client, lui, change a
  // chaque partie.
  const appareil = new Map<string, string>();
  for (const j of joueurs) {
    if (j.persistentID) appareil.set(j.clientID, j.persistentID);
  }

  return {
    type: "partieTerminee",
    joueurs: [...appareil.values()],
    gagnants: gagnants
      .map((id) => appareil.get(id))
      .filter((a): a is string => a !== undefined),
  };
}

/** Cote worker : fait remonter le resultat, sans jamais faire echouer la partie. */
export function remonterResultat(record: PartialGameRecord): void {
  try {
    const msg = messageDePartie(record);
    if (msg !== null) process.send?.(msg);
  } catch (error) {
    log.error(`remontee du resultat impossible: ${error}`);
  }
}

/** Cote principal : applique le resultat aux comptes concernes. */
export async function appliquerResultat(
  msg: WorkerPartieTerminee,
): Promise<void> {
  const gagnants = new Set(msg.gagnants);
  const deja = new Set<string>();
  for (const appareil of msg.joueurs) {
    const compte = parAppareil(appareil);
    // Joueur sans compte : il a joue normalement, il n'apparait simplement pas
    // au classement.
    if (compte === undefined || deja.has(compte.id)) continue;
    deja.add(compte.id);
    await enregistrerResultat(compte.id, gagnants.has(appareil));
  }
}

/** Branche l'ecoute des resultats sur un worker (processus principal). */
export function ecouterResultats(worker: Worker): void {
  worker.on("message", (brut: unknown) => {
    const lu = WorkerMessageSchema.safeParse(brut);
    if (!lu.success || lu.data.type !== "partieTerminee") return;
    appliquerResultat(lu.data).catch((error) =>
      log.error(`enregistrement du resultat impossible: ${error}`),
    );
  });
}
