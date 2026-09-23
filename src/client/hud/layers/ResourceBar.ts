import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  ALL_RESOURCES,
  RESOURCE_NAME_KEY,
  RESOURCE_RULES,
  Resource,
  resourceOf,
} from "../../../core/game/Resources";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import { GameView } from "../../view";

/** Une couleur par ressource, pour les reconnaitre d'un coup d'oeil. */
const RESOURCE_COLOR: Record<Resource, string> = {
  [Resource.Uranium]: "#7ee081", // vert radium, Vanguard
  [Resource.Biomass]: "#e0a33a", // ambre organique, Swarm
  [Resource.Crystal]: "#7cc4ff", // bleu cristal, Ascendant
};

/**
 * Les trois ressources du joueur, en permanence a l'ecran.
 *
 * Une regle qu'on ne voit pas est une regle qu'on ne joue pas : sans ce
 * bandeau, un joueur ne saurait ni ce qu'il produit, ni ce qui lui manque, ni
 * pourquoi il devrait aller parler aux deux autres factions.
 *
 * La barre de la ressource qu'on ne produit pas soi-meme reste visible a vide :
 * c'est justement le manque qu'il faut montrer.
 *
 * Tout est derive de l'etat que le client possede deja (PlayerView.resources),
 * donc rien a synchroniser de plus et rien qui puisse desynchroniser.
 */
@customElement("resource-bar")
export class ResourceBar extends LitElement implements Controller {
  public game: GameView;

  @state() private stocks: Record<string, number> | null = null;

  createRenderRoot() {
    this.style.position = "fixed";
    this.style.left = "0.5rem";
    this.style.bottom = "9rem";
    this.style.zIndex = "800";
    // Le bandeau flotte au-dessus de la carte : il ne doit jamais avaler un
    // clic destine au terrain.
    this.style.pointerEvents = "none";
    return this;
  }

  init() {}

  tick() {
    const player = this.game?.myPlayer();
    if (!player || !player.isAlive() || this.game.inSpawnPhase()) {
      if (this.stocks !== null) this.stocks = null;
      return;
    }
    const next = player.resources();
    // Ne re-rend que si un chiffre a bouge (la production tombe une fois par
    // seconde, le HUD tourne a 60 images par seconde).
    if (
      this.stocks === null ||
      ALL_RESOURCES.some((r) => this.stocks![r] !== next[r])
    ) {
      this.stocks = { ...next };
    }
  }

  render() {
    if (this.stocks === null) return html``;
    const mine = resourceOf(this.game?.myPlayer()?.faction());
    const ready = ALL_RESOURCES.filter(
      (r) => (this.stocks?.[r] ?? 0) >= RESOURCE_RULES.weaponThreshold,
    ).length;

    return html`
      <div
        class="flex flex-col gap-0.5 rounded bg-black/50 px-2 py-1 text-[10px] text-white"
        translate="no"
      >
        <div class="flex items-center gap-1 font-bold">
          <span>${translateText("resources.title")}</span>
          <span class="opacity-70">${ready}/3</span>
        </div>
        ${ALL_RESOURCES.map((r) => this.renderOne(r, r === mine))}
      </div>
    `;
  }

  private renderOne(type: Resource, isMine: boolean) {
    const value = this.stocks?.[type] ?? 0;
    const share = Math.min(
      100,
      Math.round((value * 100) / RESOURCE_RULES.weaponThreshold),
    );
    return html`
      <div class="flex items-center gap-1">
        <span
          class="inline-block h-2 w-2 rounded-full"
          style="background:${RESOURCE_COLOR[type]}"
        ></span>
        <span class="w-16 ${isMine ? "font-bold" : "opacity-80"}"
          >${translateText(RESOURCE_NAME_KEY[type])}</span
        >
        <span class="relative inline-block h-1.5 w-16 rounded bg-white/20">
          <span
            class="absolute left-0 top-0 h-1.5 rounded"
            style="width:${share}%;background:${RESOURCE_COLOR[type]}"
          ></span>
        </span>
        <span class="tabular-nums w-10 text-right"
          >${value}/${RESOURCE_RULES.weaponThreshold}</span
        >
      </div>
    `;
  }
}
