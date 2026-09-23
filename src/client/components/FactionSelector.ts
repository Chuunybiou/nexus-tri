import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ALL_FACTIONS, FACTIONS, Faction } from "../../core/game/Factions";
import { UserSettings } from "../../core/game/UserSettings";
import { translateText } from "../Utils";
import { factionAccent, factionEmblem } from "./FactionEmblem";

/** Fired when the player picks a faction, so the lobby can pick up the change. */
export const FACTION_CHANGED_EVENT = "faction-changed";

/**
 * The lobby's faction picker.
 *
 * The choice is only a request: the server stamps the authoritative faction
 * into GameStartInfo, so nothing here decides what a player actually fields.
 * It persists through UserSettings, which means a reload keeps the pick.
 */
@customElement("faction-selector")
export class FactionSelector extends LitElement {
  private readonly userSettings = new UserSettings();

  @state() private selected: Faction = this.userSettings.selectedFaction();

  createRenderRoot() {
    return this;
  }

  private select(faction: Faction) {
    if (faction === this.selected) return;
    this.selected = faction;
    this.userSettings.setSelectedFaction(faction);
    this.dispatchEvent(
      new CustomEvent(FACTION_CHANGED_EVENT, {
        detail: faction,
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <div class="w-full px-2 lg:px-0">
        <div
          class="mb-3 flex items-baseline gap-3"
          role="heading"
          aria-level="2"
        >
          <span
            class="text-xs font-bold uppercase tracking-[0.22em] text-white/50"
          >
            ${translateText("faction.title")}
          </span>
          <!-- Hairline rule instead of a filled header bar: the panel should
               read as an edge on the map, not a box sitting on top of it. -->
          <span class="h-px flex-1 bg-white/10"></span>
        </div>
        <div
          class="grid grid-cols-1 gap-3 sm:grid-cols-3"
          role="radiogroup"
          aria-label=${translateText("faction.title")}
        >
          ${ALL_FACTIONS.map((faction) => this.renderOption(faction))}
        </div>
      </div>
    `;
  }

  private renderOption(faction: Faction) {
    const traits = FACTIONS[faction];
    const isSelected = faction === this.selected;
    const accent = factionAccent(faction);

    return html`
      <button
        type="button"
        role="radio"
        aria-checked=${isSelected ? "true" : "false"}
        class="group relative flex min-w-0 flex-col items-start gap-1.5
               overflow-hidden rounded-lg border p-4 pl-5 text-left
               transition-[border-color,background-color,transform] duration-150
               ${isSelected
          ? "bg-white/[0.06] -translate-y-px"
          : "bg-white/[0.02] hover:bg-white/[0.04]"}"
        style=${`border-color: ${
          isSelected ? accent : "var(--color-hairline)"
        }; box-shadow: ${isSelected ? `0 0 24px -8px ${accent}` : "none"};`}
        @click=${() => this.select(faction)}
      >
        <!-- Accent edge: present on every card, lit only on the selected one,
             so the row reads as three choices rather than three buttons. -->
        <span
          class="absolute inset-y-0 left-0 w-[3px] transition-opacity duration-150
                 ${isSelected
            ? "opacity-100"
            : "opacity-25 group-hover:opacity-60"}"
          style=${`background: ${accent};`}
          aria-hidden="true"
        ></span>
        <span class="mb-1 flex items-center gap-2.5">
          <svg
            viewBox="0 0 24 24"
            class="h-7 w-7 shrink-0 transition-opacity duration-150
                   ${isSelected
              ? "opacity-100"
              : "opacity-55 group-hover:opacity-85"}"
            style=${`color: ${accent};`}
            aria-hidden="true"
          >
            ${factionEmblem(faction)}
          </svg>
          <span
            class="min-w-0 truncate text-lg font-bold tracking-tight text-white"
          >
            ${translateText(traits.nameKey)}
          </span>
        </span>
        <span class="text-xs leading-relaxed text-white/55">
          ${translateText(traits.descriptionKey)}
        </span>
      </button>
    `;
  }
}
