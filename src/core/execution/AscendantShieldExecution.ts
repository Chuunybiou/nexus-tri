import { ASCENDANT_GRID, Faction, scalePerMille } from "../game/Factions";
import { Execution, Game, Unit } from "../game/Game";
import { ascendantGridPowered } from "./AscendantGridExecution";

/**
 * Ascendant regenerative shields.
 *
 * A unit that has gone ASCENDANT_GRID.shieldDelayTicks without losing health
 * starts recovering, and keeps recovering until it is whole again. Taking any
 * damage resets the timer, so shields reward disengaging and punish the
 * defender who lets a damaged Ascendant unit walk away — they never help a unit
 * that is currently being shot.
 *
 * Only while the grid is up (see AscendantGridExecution): this is the half of
 * the faction that makes its expensive units worth fielding, and cutting the
 * power is how an opponent takes it away.
 *
 * "Damage" is detected by watching health between ticks rather than hooking
 * modifyHealth, so nothing else in the sim has to know shields exist. The
 * bookkeeping is derived purely from sim state the same way on every client, so
 * it stays replay-safe.
 *
 * Deterministic: health values are integers and regeneration is scalePerMille
 * of maxHealth. No PRNG, no floats.
 */
export class AscendantShieldExecution implements Execution {
  private mg: Game | null = null;
  /** unit id -> {health last seen, tick it last dropped}. Sim-derived. */
  private seen = new Map<number, { health: number; damagedAt: number }>();

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.mg === null) throw new Error("Not initialized");
    const mg = this.mg;

    const live = new Set<number>();
    for (const player of mg.players()) {
      if (player.faction() !== Faction.Ascendant) continue;
      const powered = ascendantGridPowered(player);
      for (const unit of player.units()) {
        if (!unit.hasHealth()) continue;
        live.add(unit.id());
        this.step(unit, ticks, powered);
      }
    }
    // Drop bookkeeping for units that died or changed hands, so the map cannot
    // grow without bound over a long game.
    for (const id of this.seen.keys()) {
      if (!live.has(id)) this.seen.delete(id);
    }
  }

  private step(unit: Unit, ticks: number, powered: boolean): void {
    const health = Math.floor(unit.health());
    const max = Math.floor(unit.maxHealth());
    const previous = this.seen.get(unit.id());

    if (previous === undefined) {
      // First sight: treat it as just-damaged so a unit cannot be healed by the
      // very tick it appears in.
      this.seen.set(unit.id(), { health, damagedAt: ticks });
      return;
    }

    if (health < previous.health) {
      this.seen.set(unit.id(), { health, damagedAt: ticks });
      return;
    }

    if (!powered || health >= max) {
      this.seen.set(unit.id(), { health, damagedAt: previous.damagedAt });
      return;
    }

    if (ticks - previous.damagedAt < ASCENDANT_GRID.shieldDelayTicks) {
      this.seen.set(unit.id(), { health, damagedAt: previous.damagedAt });
      return;
    }

    // Per second once the delay has elapsed, so the regen rate reads the same
    // way as every other per-second drain in the sim.
    if (ticks % 10 === 0) {
      const regen = scalePerMille(max, ASCENDANT_GRID.shieldRegenPerMille);
      if (regen > 0) unit.modifyHealth(Math.min(regen, max - health));
    }
    this.seen.set(unit.id(), {
      health: Math.floor(unit.health()),
      damagedAt: previous.damagedAt,
    });
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
