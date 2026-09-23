import { ASCENDANT_GRID, Faction, scaleGoldPerMille } from "../game/Factions";
import { Execution, Game, Player, UnitType } from "../game/Game";

/**
 * The Ascendant energy grid.
 *
 * Cities are the grid nodes. Hold at least one and the grid is up; lose them
 * all and Ascendant systems start failing — the treasury bleeds here, and
 * shields stop recovering (see AscendantShieldExecution, which reads the same
 * predicate).
 *
 * This is the faction's deliberate weakness. Ascendant units are expensive and
 * individually strong, which without a counter is just "better". The grid gives
 * opponents something to aim at: kill the cities and the elite army stops
 * healing and stops being paid for.
 *
 * Cities rather than a new unit type, so the mechanic costs no build-menu
 * entry, no wire field and no sprite.
 */
/** The structure that powers the grid. Named so the HUD can say it too. */
export const ASCENDANT_GRID_NODE = UnitType.City;

/**
 * Structural on purpose: the sim calls this with a Player and the HUD with a
 * PlayerView. One predicate means the warning on screen can never disagree with
 * the drain being applied.
 */
export function ascendantGridPowered(player: {
  units(type: UnitType): unknown[];
}): boolean {
  return player.units(ASCENDANT_GRID_NODE).length > 0;
}

export class AscendantGridExecution implements Execution {
  private mg: Game | null = null;

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (ticks % 10 !== 0) return; // once per second
    if (this.mg === null) throw new Error("Not initialized");

    for (const player of this.mg.players()) {
      if (player.faction() !== Faction.Ascendant) continue;
      if (ascendantGridPowered(player)) continue;
      this.drain(player);
    }
  }

  private drain(player: Player): void {
    const gold = player.gold();
    if (gold <= 0n) return;
    // Exact bigint arithmetic; truncation means a tiny treasury stops draining
    // rather than vanishing to rounding.
    const lost = scaleGoldPerMille(
      gold,
      ASCENDANT_GRID.unpoweredGoldDrainPerMille,
    );
    if (lost <= 0n) return;
    player.removeGold(lost);
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    // Nobody owns a city yet, so every Ascendant player would read as unpowered.
    return false;
  }
}
