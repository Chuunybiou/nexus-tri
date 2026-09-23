import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { ALL_FACTIONS, FACTIONS, Faction } from "../../core/game/Factions";
import { translateText } from "../Utils";
import { BaseModal } from "./BaseModal";
import { factionEmblem, factionHex } from "./FactionEmblem";

/** Les cles de recit, par faction. */
const LORE_KEYS: Record<
  Faction,
  { subtitle: string; text: string; status: string }
> = {
  [Faction.Vanguard]: {
    subtitle: "lore.vanguard_subtitle",
    text: "lore.vanguard_text",
    status: "lore.vanguard_status",
  },
  [Faction.Swarm]: {
    subtitle: "lore.swarm_subtitle",
    text: "lore.swarm_text",
    status: "lore.swarm_status",
  },
  [Faction.Ascendant]: {
    subtitle: "lore.ascendant_subtitle",
    text: "lore.ascendant_text",
    status: "lore.ascendant_status",
  },
};

const ORIGIN_KEYS: Record<Faction, string> = {
  [Faction.Vanguard]: "lore.vanguard_origin",
  [Faction.Swarm]: "lore.swarm_origin",
  [Faction.Ascendant]: "lore.ascendant_origin",
};

/**
 * Les archives : d'ou viennent les trois factions.
 *
 * Purement narratif, et c'est le but — le joueur choisit une faction au
 * premier ecran sans rien savoir d'elle a part trois chiffres. Une page qui
 * raconte donne un sens a ce choix.
 *
 * Aucune donnee de partie n'est lue ici : tout vient des traductions, donc la
 * page se traduit comme le reste du jeu et ne peut rien casser.
 */
@customElement("faction-lore-modal")
export class FactionLoreModal extends BaseModal {
  protected routerName = "lore";

  protected modalConfig() {
    return { title: translateText("lore.title"), maxWidth: "1100px" };
  }

  protected renderContent() {
    return html`
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        ${ALL_FACTIONS.map((faction) => this.renderCard(faction))}
      </div>
    `;
  }

  private renderCard(faction: Faction) {
    const accent = factionHex(faction);
    const keys = LORE_KEYS[faction];

    return html`
      <div
        class="hud-glass flex flex-col justify-between rounded-2xl p-5"
        style=${`border-color: ${accent}66;`}
      >
        <div>
          <div class="mb-4 flex items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style=${`color: ${accent}; border-color: ${accent}80; background: ${accent}20;`}
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true">
                ${factionEmblem(faction)}
              </svg>
            </span>
            <span class="min-w-0">
              <span
                class="block truncate text-base font-bold uppercase tracking-[0.12em]"
                style=${`color: ${accent};`}
              >
                ${translateText(FACTIONS[faction].nameKey)}
              </span>
              <span
                class="block truncate text-[10px] uppercase tracking-[0.16em] text-white/45"
              >
                ${translateText(keys.subtitle)}
              </span>
            </span>
          </div>
          <p class="mb-4 text-xs font-light leading-relaxed text-white/70">
            ${translateText(keys.text)}
          </p>
        </div>
        <div
          class="flex justify-between border-t pt-3 text-[10px] uppercase tracking-[0.12em] text-white/40"
          style=${`border-color: ${accent}33;`}
        >
          <span>${translateText(ORIGIN_KEYS[faction])}</span>
          <span style=${`color: ${accent};`}
            >${translateText(keys.status)}</span
          >
        </div>
      </div>
    `;
  }
}
