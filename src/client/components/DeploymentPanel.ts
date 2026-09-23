import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { assetUrl } from "../../core/AssetUrls";
import { FACTIONS } from "../../core/game/Factions";
import { UserSettings } from "../../core/game/UserSettings";
import { PublicGameInfo, PublicGames } from "../../core/Schemas";
import {
  getMapName,
  normaliseMapKey,
  renderDuration,
  translateText,
} from "../Utils";
import { factionHex } from "./FactionEmblem";

/** Evenement ecoute par game-mode-selector, qui garde ses verifications. */
export const DEPLOY_EVENT = "starfall-deploy";

/**
 * La file de deploiement : le bloc de droite de la maquette.
 *
 * Il ne joue pas au jeu a la place du jeu. Le bouton envoie un evenement que
 * game-mode-selector attrape, et c'est lui qui verifie le pseudo, le droit de
 * rejoindre, l'etat du serveur — comme pour ses propres boutons. Un second
 * chemin d'acces aurait fini par diverger du premier.
 *
 * Les chiffres viennent de la liste des salons publics que le client recoit
 * deja (evenement « public-lobbies-update ») : aucune requete de plus.
 */
@customElement("deployment-panel")
export class DeploymentPanel extends LitElement {
  @state() private lobbies: PublicGames | null = null;
  @state() private mode: "solo" | "public" = "public";
  @state() private maj = 0;

  private readonly onLobbies = (e: Event) => {
    const detail = (e as CustomEvent).detail as { payload?: PublicGames };
    this.lobbies = detail?.payload ?? null;
  };

  /** Le tag et la faction changent ailleurs : on se rafraichit regulierement. */
  private timer: ReturnType<typeof setInterval> | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("public-lobbies-update", this.onLobbies);
    this.timer = setInterval(() => this.maj++, 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("public-lobbies-update", this.onLobbies);
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private get prochain(): PublicGameInfo | undefined {
    return this.lobbies?.games?.["ffa"]?.[0];
  }

  private get aVenir(): PublicGameInfo[] {
    const t = this.lobbies?.games?.["team"]?.[0];
    const s = this.lobbies?.games?.["special"]?.[0];
    return [t, s].filter((l): l is PublicGameInfo => l !== undefined);
  }

  private secondes(lobby: PublicGameInfo | undefined): number | undefined {
    if (lobby?.startsAt === undefined) return undefined;
    const serveur = this.lobbies?.serverTime ?? Date.now();
    return Math.max(0, Math.round((lobby.startsAt - serveur) / 1000));
  }

  private tag(): string {
    try {
      return (localStorage.getItem("clanTag") ?? "").toUpperCase();
    } catch {
      return "";
    }
  }

  render() {
    const faction = new UserSettings().selectedFaction();
    const accent = factionHex(faction);
    const tag = this.tag();
    const prochain = this.prochain;
    const attente = this.secondes(prochain);
    const places = prochain?.gameConfig?.maxPlayers;
    const presents = prochain?.numClients ?? 0;

    return html`
      <div class="flex flex-col gap-4">
        <div class="hud-glass rounded-2xl p-4 sm:p-5">
          <div class="text-[11px] uppercase tracking-[0.18em] text-white/40">
            ${translateText("deployment.queue_title")}
          </div>
          <h2 class="mb-3 text-lg font-bold text-white">
            ${translateText("deployment.ops_header")}
          </h2>

          <div class="mb-4 grid grid-cols-2 gap-2">
            ${this.renderOnglet("solo", translateText("main.solo"), accent)}
            ${this.renderOnglet(
              "public",
              translateText("deployment.public"),
              accent,
            )}
          </div>

          <div
            class="mb-5 flex flex-col gap-2 rounded-xl border border-white/10 bg-black/25 p-3 text-[11px]"
          >
            ${this.ligne(
              translateText("deployment.squad_tag"),
              tag === "" ? translateText("deployment.no_tag") : `[${tag}]`,
            )}
            ${this.ligne(
              translateText("deployment.selected_faction"),
              translateText(FACTIONS[faction].nameKey).toUpperCase(),
              accent,
            )}
            ${this.ligne(
              translateText("deployment.next_drop"),
              attente === undefined
                ? translateText("deployment.waiting")
                : renderDuration(attente),
            )}
            ${this.ligne(
              translateText("deployment.players_ready"),
              places ? `${presents} / ${places}` : String(presents),
            )}
          </div>

          ${this.renderBouton(accent, prochain)}
        </div>

        ${this.renderTheatre(prochain)} ${this.renderRotation()}
      </div>
    `;
  }

  private ligne(label: string, valeur: string, couleur?: string) {
    return html`
      <div class="flex min-w-0 items-baseline justify-between gap-2">
        <span class="truncate uppercase tracking-[0.1em] text-white/40"
          >${label}</span
        >
        <span
          class="shrink-0 font-bold tabular-nums"
          style=${couleur
            ? `color: ${couleur}`
            : "color: rgba(255,255,255,0.85)"}
          >${valeur}</span
        >
      </div>
    `;
  }

  private renderOnglet(
    mode: "solo" | "public",
    libelle: string,
    accent: string,
  ) {
    const actif = this.mode === mode;
    return html`
      <button
        type="button"
        class="rounded-xl border px-3 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${actif
          ? "text-white"
          : "border-white/10 bg-black/25 text-white/45 hover:text-white/75"}"
        style=${actif
          ? `border-color: ${accent}99; background: ${accent}22;`
          : ""}
        aria-pressed=${actif ? "true" : "false"}
        @click=${() => {
          this.mode = mode;
        }}
      >
        ${libelle}
      </button>
    `;
  }

  private renderBouton(accent: string, prochain: PublicGameInfo | undefined) {
    const solo = this.mode === "solo";
    const indisponible = !solo && prochain === undefined;
    return html`
      <button
        type="button"
        class="w-full rounded-xl px-4 py-3.5 text-sm font-extrabold uppercase tracking-[0.16em] text-black transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        style=${`background: linear-gradient(90deg, ${accent}, ${accent}aa);`}
        ?disabled=${indisponible}
        @click=${() =>
          document.dispatchEvent(
            new CustomEvent(DEPLOY_EVENT, { detail: { mode: this.mode } }),
          )}
      >
        →
        ${solo
          ? translateText("main.solo")
          : indisponible
            ? translateText("deployment.waiting")
            : translateText("deployment.deploy")}
      </button>
    `;
  }

  /** La carte du prochain depart : la vraie image, pas un dessin generique. */
  private renderTheatre(lobby: PublicGameInfo | undefined) {
    const carte = lobby?.gameConfig?.gameMap;
    if (carte === undefined) return nothing;
    return html`
      <div class="hud-glass rounded-2xl p-4">
        <div class="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
          ${translateText("deployment.theater")}
        </div>
        <div
          class="relative h-28 overflow-hidden rounded-xl border border-white/10"
        >
          <img
            src=${assetUrl(
              `maps/${encodeURIComponent(normaliseMapKey(carte))}/thumbnail.webp`,
            )}
            alt=""
            loading="lazy"
            class="h-full w-full object-cover opacity-70"
          />
          <span
            class="absolute bottom-2 left-2 rounded border border-white/15 bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/85"
            >${getMapName(carte) ?? carte}</span
          >
        </div>
      </div>
    `;
  }

  private renderRotation() {
    const salons = this.aVenir;
    if (salons.length === 0) return nothing;
    return html`
      <div class="hud-glass rounded-2xl p-4">
        <div class="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
          ${translateText("deployment.upcoming")}
        </div>
        <div class="flex flex-col gap-2">
          ${salons.map((lobby) => {
            const s = this.secondes(lobby);
            const carte = lobby.gameConfig?.gameMap;
            return html`
              <div
                class="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
              >
                <span
                  class="min-w-0 truncate text-xs font-semibold text-white/80"
                  >${carte ? (getMapName(carte) ?? carte) : "—"}</span
                >
                <span
                  class="shrink-0 rounded border border-white/15 px-2 py-0.5 text-[10px] tabular-nums text-white/60"
                  >${s === undefined
                    ? translateText("deployment.waiting")
                    : renderDuration(s)}</span
                >
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}
