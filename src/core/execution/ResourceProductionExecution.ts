import { Execution, Game, Player, UnitType } from "../game/Game";
import { RESOURCE_RULES, resourceOf } from "../game/Resources";

/**
 * Production des ressources de faction, une fois par seconde.
 *
 * Chaque joueur ne produit QUE la ressource de sa faction. Les deux autres, il
 * faut aller les chercher chez les autres factions, par le commerce — c'est
 * tout l'interet du systeme (voir Resources.ts).
 *
 * La production suit les villes, un batiment qui existe deja : pas de nouveau
 * batiment a construire, pas de gisement a placer sur la carte, et un joueur
 * qui s'etend produit naturellement plus. La part fixe garantit qu'un joueur
 * sans ville reste dans la partie diplomatique au lieu d'en etre exclu.
 *
 * Les robots (nations) produisent aussi : sinon un joueur voisin d'une nation
 * n'aurait personne a piller ou a convaincre, et la carte serait vide de
 * ressources la ou il n'y a pas d'humains.
 *
 * Deterministe : des entiers, aucun hasard. Comme SwarmDecayExecution, une
 * passe toutes les dix ticks.
 */
export class ResourceProductionExecution implements Execution {
  private mg: Game | null = null;

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (ticks % 10 !== 0) return; // une fois par seconde
    if (this.mg === null) throw new Error("Not initialized");

    for (const player of this.mg.players()) {
      this.produce(player);
    }
  }

  private produce(player: Player): void {
    // TerraNullius et les joueurs morts n'ont rien a produire ; players() est
    // deja filtre sur les vivants, mais un joueur sans terre n'a plus de ville
    // non plus, donc la part fixe seule serait un revenu fantome.
    if (player.numTilesOwned() === 0) return;

    const cities = player.units(UnitType.City).length;
    const amount =
      RESOURCE_RULES.basePerSecond + cities * RESOURCE_RULES.perCityPerSecond;
    player.addResource(resourceOf(player.faction()), amount);
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    // Rien a produire tant que personne n'a de territoire.
    return false;
  }
}
