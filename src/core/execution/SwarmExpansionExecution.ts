import { Faction } from "../game/Factions";
import { Execution, Game, Player } from "../game/Game";
import { TileRef } from "../game/GameMap";

/**
 * Le Swarm s'etend tout seul sur la terre libre.
 *
 * C'est la signature de la faction : on ne clique pas pour grignoter du
 * neutre, la nuee rampe. Lentement — quelques cases par seconde — mais sans
 * rien demander au joueur, qui garde ses clics et son or pour les vraies
 * attaques.
 *
 * Trois garde-fous, et chacun repare un probleme concret :
 *
 * 1. UNIQUEMENT la terre qui n'appartient a personne. La nuee ne mord jamais
 *    un voisin : un Swarm qui grignote son allie sans le vouloir casse
 *    l'alliance, et le joueur ne comprend meme pas ce qu'il a fait.
 * 2. Il faut des troupes. Sans ce seuil, un joueur reduit a une case
 *    continuerait de s'etendre sur une carte vide sans rien risquer.
 * 3. Un plafond par seconde. La nuee doit se voir avancer, pas engloutir la
 *    carte pendant qu'on regarde ailleurs.
 *
 * Deterministe : on parcourt les cases de bordure dans l'ordre du jeu et on
 * prend les premieres libres. Aucun hasard, donc le meme resultat sur chaque
 * navigateur.
 */

/** Cases prises par seconde, au maximum. */
const CASES_PAR_SECONDE = 3;

/** En dessous, la nuee n'a plus de quoi s'etendre. */
const TROUPES_MINIMUM = 10;

export class SwarmExpansionExecution implements Execution {
  private mg: Game | null = null;

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (ticks % 10 !== 0) return; // une fois par seconde
    const mg = this.mg;
    if (mg === null) return;

    for (const joueur of mg.players()) {
      if (joueur.faction() !== Faction.Swarm) continue;
      this.ramper(mg, joueur);
    }
  }

  private ramper(mg: Game, joueur: Player): void {
    if (joueur.troops() < TROUPES_MINIMUM) return;

    const libres: TileRef[] = [];
    joueur.borderTiles().forEach((tile) => {
      if (libres.length >= CASES_PAR_SECONDE) return;
      for (const voisin of mg.neighbors(tile)) {
        if (libres.length >= CASES_PAR_SECONDE) break;
        if (!mg.isLand(voisin)) continue;
        if (mg.isImpassable(voisin)) continue;
        // La seule condition qui compte : personne ne la tient. Une case
        // ennemie ou alliee se prend par une attaque, comme pour tout le
        // monde.
        if (mg.hasOwner(voisin)) continue;
        if (libres.includes(voisin)) continue;
        libres.push(voisin);
      }
    });

    for (const tile of libres) {
      joueur.conquer(tile);
    }
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    // Pas avant que chacun ait choisi son point de depart : la nuee prendrait
    // les places des autres.
    return false;
  }
}
