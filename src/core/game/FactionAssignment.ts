import { simpleHash } from "../Util";
import { Faction } from "./Factions";

/**
 * Quelle faction porte un robot ou une nation.
 *
 * Jusqu'ici, aucun des deux n'en avait : PlayerInfo retombe sur Vanguard quand
 * on ne precise rien, parce que Vanguard est neutre pour l'equilibrage et que
 * les generateurs de robots sont anterieurs aux factions. Consequence a
 * l'ecran : sur une carte ou 95 % des joueurs sont des nations, TOUT le monde
 * peignait le motif de Vanguard. Les trois races existaient dans le code et se
 * voyaient nulle part.
 *
 * Le tirage vient du hachage de l'identifiant, et de rien d'autre :
 *
 * - c'est reproductible, donc le serveur et chaque client attribuent la meme
 *   faction au meme joueur sans avoir a se le dire ;
 * - cela ne consomme aucun tirage du generateur aleatoire partage, donc les
 *   positions de depart et les noms restent exactement ce qu'ils etaient.
 */
const TOUTES_LES_FACTIONS = [
  Faction.Vanguard,
  Faction.Swarm,
  Faction.Ascendant,
] as const;

export function factionDeRobot(id: string): Faction {
  return TOUTES_LES_FACTIONS[simpleHash(id) % TOUTES_LES_FACTIONS.length];
}
