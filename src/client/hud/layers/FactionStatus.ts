import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ascendantGridPowered } from "../../../core/execution/AscendantGridExecution";
import { Faction, swarmHoardThreshold } from "../../../core/game/Factions";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import { GameView } from "../../view";

/** What the player needs to be told, or null when nothing is happening. */
interface FactionCue {
  /** Distinguishes cues so the element only re-renders when the state changes. */
  key: string;
  titleKey: string;
  detailKey: string;
  severity: "warning" | "info";
}

/**
 * Tells the player when a faction mechanic is acting on them.
 *
 * Without this the mechanics are invisible: a Swarm player watches troops fall
 * with no explanation, and an Ascendant player loses gold and shield recovery
 * with nothing on screen tying it to the cities they just lost. A rule the
 * player cannot see is one they cannot play around.
 *
 * Everything here is DERIVED from state the client already has — the same
 * threshold helper and the same grid predicate the executions use, so the
 * warning cannot light up at a different moment than the rule it describes.
 * That is also why it needs no new wire field: nothing to desync.
 *
 * Silent unless something is actually happening, including for Vanguard, which
 * has no mechanic of its own.
 */
@customElement("faction-status")
export class FactionStatus extends LitElement implements Controller {
  public game: GameView;

  @state() private cue: FactionCue | null = null;

  createRenderRoot() {
    this.style.position = "fixed";
    this.style.top = "4.5rem";
    this.style.left = "50%";
    this.style.transform = "translateX(-50%)";
    this.style.zIndex = "900";
    // The HUD sits over the map: this banner must never eat a click meant for
    // the terrain underneath it.
    this.style.pointerEvents = "none";
    return this;
  }

  init() {}

  tick() {
    const next = this.currentCue();
    if (next?.key !== this.cue?.key) {
      this.cue = next;
    }
  }

  private currentCue(): FactionCue | null {
    const player = this.game?.myPlayer();
    // No cues before anyone has territory, matching the executions, which all
    // sit out the spawn phase.
    if (!player || !player.isAlive() || this.game.inSpawnPhase()) return null;

    switch (player.faction()) {
      case Faction.Swarm:
        return this.swarmCue(player);
      case Faction.Ascendant:
        return this.ascendantCue(player);
      default:
        return null;
    }
  }

  private swarmCue(
    player: ReturnType<GameView["myPlayer"]>,
  ): FactionCue | null {
    if (player === null) return null;
    const threshold = swarmHoardThreshold(this.game.config().maxTroops(player));
    if (player.troops() <= threshold) return null;
    return {
      key: "swarm-hoarding",
      titleKey: "faction.swarm_rotting",
      detailKey: "faction.swarm_rotting_detail",
      severity: "warning",
    };
  }

  private ascendantCue(
    player: ReturnType<GameView["myPlayer"]>,
  ): FactionCue | null {
    if (player === null || ascendantGridPowered(player)) return null;
    return {
      key: "grid-offline",
      titleKey: "faction.grid_offline",
      detailKey: "faction.grid_offline_detail",
      severity: "warning",
    };
  }

  render() {
    const cue = this.cue;
    if (cue === null) return html``;

    const tone =
      cue.severity === "warning"
        ? "border-amber-400/60 bg-amber-950/80"
        : "border-white/20 bg-surface/80";

    return html`
      <div
        class="pointer-events-none max-w-[22rem] rounded-lg border px-3 py-2 ${tone}"
        role="status"
        aria-live="polite"
      >
        <div class="text-sm font-semibold text-white">
          ${translateText(cue.titleKey)}
        </div>
        <div class="text-xs text-white/70">${translateText(cue.detailKey)}</div>
      </div>
    `;
  }
}
