import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ALL_FACTIONS, FACTIONS, Faction } from "../../core/game/Factions";
import { UserSettings } from "../../core/game/UserSettings";
import { translateText } from "../Utils";
import { factionAccent, factionEmblem } from "./FactionEmblem";

/** Fired when the player picks a faction, so the lobby can pick up the change. */
export const FACTION_CHANGED_EVENT = "faction-changed";

/** Les libelles propres a chaque faction, ajoutes avec l'habillage tactique. */
const FACTION_KEYS: Record<Faction, { tag: string; unit: string }> = {
  [Faction.Vanguard]: {
    tag: "faction.vanguard_tag",
    unit: "faction.vanguard_unit",
  },
  [Faction.Swarm]: { tag: "faction.swarm_tag", unit: "faction.swarm_unit" },
  [Faction.Ascendant]: {
    tag: "faction.ascendant_tag",
    unit: "faction.ascendant_unit",
  },
};

/**
 * The lobby's faction picker.
 *
 * The choice is only a request: the server stamps the authoritative faction
 * into GameStartInfo, so nothing here decides what a player actually fields.
 * It persists through UserSettings, which means a reload keeps the pick.
 *
 * Habillage « poste de commandement » : chaque carte porte sa vignette, son
 * etiquette de matiere et le nom de son unite type. Les couleurs viennent des
 * variables de faction deja definies dans styles.css, donc changer une couleur
 * de faction change la carte, l'embleme et le jeu d'un seul coup.
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

  /**
   * Ouvre les archives.
   *
   * Meme chemin que le bouton d'aide : on revele la page en ligne, puis on
   * ouvre la fenetre. Le routeur, lui, ne sert qu'aux adresses (#modal=lore).
   */
  private openLore() {
    window.showPage?.("page-lore");
    const el = document.querySelector("faction-lore-modal") as
      | (HTMLElement & { open?: () => void })
      | null;
    el?.open?.();
  }

  render() {
    const accent = factionAccent(this.selected);
    const doctrine = translateText("faction.doctrine", {
      faction: translateText(FACTIONS[this.selected].nameKey).toUpperCase(),
    });

    return html`
      <div class="w-full px-2 lg:px-0">
        <div class="mb-3 flex items-center gap-3" role="heading" aria-level="2">
          <!-- Marqueur carre : le meme repere ouvre chaque section de l'accueil. -->
          <span
            class="h-2.5 w-2.5 shrink-0"
            style="background: var(--color-hex-cyan)"
            aria-hidden="true"
          ></span>
          <span
            class="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60"
          >
            ${translateText("faction.select_title")}
          </span>
          <span class="h-px flex-1 bg-white/10"></span>
          <!-- Les archives : d'ou viennent les trois factions. Le choix a
               l'ecran d'accueil se fait sinon sur trois chiffres. -->
          <button
            type="button"
            class="shrink-0 rounded border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/55 transition-colors hover:border-white/35 hover:text-white/85"
            @click=${() => this.openLore()}
          >
            ${translateText("lore.open")}
          </button>
          <!-- La doctrine retenue, a droite : on lit son choix sans revenir
               aux cartes. -->
          <span
            class="hidden shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] sm:inline"
            style=${`color: ${accent}`}
          >
            ${doctrine}
          </span>
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
    const keys = FACTION_KEYS[faction];

    return html`
      <button
        type="button"
        role="radio"
        aria-checked=${isSelected ? "true" : "false"}
        class="group relative flex min-w-0 flex-col items-stretch gap-2.5
               overflow-hidden rounded-lg border p-3 text-left
               transition-[border-color,background-color,transform] duration-150
               ${isSelected
          ? "bg-white/[0.06] -translate-y-px"
          : "bg-white/[0.02] hover:bg-white/[0.04]"}"
        style=${`border-color: ${
          isSelected ? accent : "var(--color-hairline)"
        }; box-shadow: ${isSelected ? `0 0 24px -8px ${accent}` : "none"};`}
        @click=${() => this.select(faction)}
      >
        <!-- Ligne de titre : embleme, nom, et l'etiquette de matiere a droite. -->
        <span class="flex min-w-0 items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5 shrink-0 transition-opacity duration-150
                   ${isSelected
              ? "opacity-100"
              : "opacity-55 group-hover:opacity-85"}"
            style=${`color: ${accent};`}
            aria-hidden="true"
          >
            ${factionEmblem(faction)}
          </svg>
          <span
            class="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-[0.12em] text-white"
          >
            ${translateText(traits.nameKey)}
          </span>
          <span
            class="shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
            style=${`color: ${accent}; border-color: ${accent}55; background: ${accent}12;`}
          >
            ${translateText(keys.tag)}
          </span>
        </span>

        <!-- Vignette : l'embleme en grand sur une trame, comme une fiche
             d'unite. Purement decoratif, donc masque aux lecteurs d'ecran. -->
        <span
          class="relative flex h-24 items-center justify-center overflow-hidden rounded border"
          style=${`border-color: ${isSelected ? `${accent}55` : "var(--color-hairline)"};
                   background:
                     linear-gradient(0deg, ${accent}10, transparent 70%),
                     repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 12px),
                     repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 12px);`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-12 w-12 transition-opacity duration-150
                   ${isSelected
              ? "opacity-95"
              : "opacity-45 group-hover:opacity-75"}"
            style=${`color: ${accent}; filter: drop-shadow(0 0 12px ${accent}66);`}
          >
            ${factionEmblem(faction)}
          </svg>
          <!-- Nom de l'unite type, pose en bas de la vignette. -->
          <span
            class="absolute bottom-1.5 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/80"
            style=${`border-color: ${accent}44; background: rgba(0,0,0,0.55);`}
          >
            ${translateText(keys.unit)}
          </span>
        </span>

        <span class="text-xs leading-relaxed text-white/55">
          ${translateText(traits.descriptionKey)}
        </span>
      </button>
    `;
  }
}
