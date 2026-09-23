import {
  Faction,
  SWARM_DECAY,
  scalePerMille,
  swarmHoardThreshold,
} from "../game/Factions";
import { Execution, Game, Player } from "../game/Game";

/**
 * Swarm breeding pressure: a hoarded Swarm army rots.
 *
 * Only troops ABOVE a share of the player's ceiling decay. A Swarm player who
 * keeps attacking stays under the threshold and never pays anything; one who
 * banks troops waiting for a perfect moment watches the bank shrink. That is
 * the faction's identity expressed as a rule rather than a stat: constant
 * pressure is not encouraged, it is the only way to play it well.
 *
 * Deliberately never lethal. The decay applies to the excess only, so it
 * asymptotes at the threshold and cannot drive anyone to zero troops — losing
 * a game to arithmetic you cannot fight back against is not a mechanic.
 *
 * Deterministic: troop counts are integers, the threshold is one floored ratio
 * and the decay is scalePerMille of an integer. No PRNG, no floats. Runs once
 * per second (every 10 ticks), like the other periodic drains.
 */
export class SwarmDecayExecution implements Execution {
  private mg: Game | null = null;

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (ticks % 10 !== 0) return; // once per second
    if (this.mg === null) throw new Error("Not initialized");
    const mg = this.mg;

    for (const player of mg.players()) {
      if (player.faction() !== Faction.Swarm) continue;
      this.decay(mg, player);
    }
  }

  private decay(mg: Game, player: Player): void {
    const threshold = swarmHoardThreshold(mg.config().maxTroops(player));
    const troops = Math.floor(player.troops());
    const excess = troops - threshold;
    if (excess <= 0) return;

    const lost = scalePerMille(excess, SWARM_DECAY.decayPerMille);
    // scalePerMille rounds, so a tiny excess can round to zero — that is fine,
    // it means the player is close enough to the threshold to be left alone.
    if (lost <= 0) return;
    player.removeTroops(lost);
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    // Nothing to rot before anyone has territory, and the spawn phase is not
    // where pressure should be applied.
    return false;
  }
}
