import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { SERVICES_DE_COMPTE } from "../NexusTri";
import { translateText } from "../Utils";
import "./CommandHeader";
import "./CosmeticBackground";
import "./DeploymentPanel";
import "./FactionLoreModal";
import "./FactionSelector";
import "./LanguageToggle";
import "./MapCatalog";
import "./NavAccountMenu";
import "./NavUtilityIcons";
import "./NewsBox";
import "./SteamWishlist";
import "./StreamingNow";

@customElement("play-page")
export class PlayPage extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div
        id="page-play"
        class="flex flex-col gap-2 w-full px-0 lg:px-4 min-h-0"
      >
        <token-login class="absolute"></token-login>
        <rewards-modal class="absolute"></rewards-modal>

        <!-- Mobile: Fixed top bar -->
        <div
          class="lg:hidden fixed left-0 right-0 top-[var(--top-ad-height,0px)] z-40 pt-[env(safe-area-inset-top)] bg-surface border-b border-white/10"
        >
          <div
            class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center h-14 px-2 gap-2"
          >
            <button
              id="hamburger-btn"
              class="col-start-1 justify-self-start h-10 shrink-0 aspect-[4/3] flex text-white/90 rounded-md items-center justify-center transition-colors"
              data-i18n-aria-label="main.menu"
              aria-expanded="false"
              aria-controls="sidebar-menu"
              aria-haspopup="dialog"
              data-i18n-title="main.menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-8"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>

            <div
              class="col-start-2 flex items-center justify-center text-malibu-blue min-w-0"
            >
              <span
                class="block whitespace-nowrap text-lg font-bold tracking-[0.16em] text-white"
                translate="no"
                >STARFALL<span style="color: var(--color-vanguard)"
                  >.IO</span
                ></span
              >
            </div>

            <!-- Right slot: bell, help, settings and the profile control. The menu is
                 the account affordance on every platform now — on CrazyGames
                 its "Sign in" item hands off to their SDK prompt. -->
            <div
              class="col-start-3 justify-self-end shrink-0 flex items-center gap-0.5"
            >
              <language-toggle></language-toggle>
              <nav-utility-icons size="mobile"></nav-utility-icons>
              ${
                SERVICES_DE_COMPTE
                  ? html`<nav-account-menu variant="mobile"></nav-account-menu>`
                  : ""
              }
            </div>
          </div>
        </div>

        <!-- Quick language switch. The full 40-language list stays in the
             footer's <lang-selector>; this is the two-language shortcut.
             Desktop only: this row sits in the normal flow, which on mobile
             is UNDERNEATH the fixed bar above, so the mobile instance lives
             in that bar instead. -->
        <div class="hidden lg:flex items-center gap-2 w-full pt-2">
          <command-header class="min-w-0 flex-1"></command-header>
        </div>

        <!-- Top strip: news + identity on the left, Streaming Now on the right. The 2fr/1fr
             split only exists while the panel is live (.streaming-live via has-[]) —
             otherwise the left column takes the full row. -->
        <div
          class="w-full pb-4 lg:pb-0 flex flex-col gap-4 sm:-mx-4 sm:w-[calc(100%+2rem)] lg:mx-0 lg:w-full lg:grid lg:grid-cols-1 lg:has-[.streaming-live]:grid-cols-[2fr_1fr] lg:gap-4 lg:items-stretch"
        >
          <!-- Mobile: spacer for fixed top bar -->
          <div
            class="lg:hidden h-[calc(env(safe-area-inset-top)+56px)] -mb-4"
          ></div>

          <!-- Left column: news banner + identity row, stacked tight. -->
          <div class="flex flex-col gap-2 min-w-0">
            <!-- Actualites : servies par le service ferme (voir NexusTri.ts) -->
            ${SERVICES_DE_COMPTE ? html`<news-box></news-box>` : ""}

          </div>

          <!-- Right column: Streaming Now (desktop only), stretched to the left column's
               full height so the top strip has no dead space. -->
          <streaming-now
            class="hidden lg:flex lg:h-full lg:flex-col w-full min-w-0"
          ></streaming-now>
        </div>

        <!-- Bandeau de protocole : ce que le joueur regarde, et de quel genre
             de jeu il s'agit. Repris de la maquette. -->
        <div class="flex items-center justify-between gap-3 px-2 pt-1 lg:px-0">
          <div class="flex min-w-0 items-center gap-2">
            <span
              class="h-4 w-1.5 shrink-0 rounded-full"
              style="background: var(--color-vanguard)"
              aria-hidden="true"
            ></span>
            <span
              class="truncate text-[11px] font-bold uppercase tracking-[0.22em]"
              style="color: var(--color-vanguard)"
            >
              ${translateText("lobby_deck.protocol_title")}
            </span>
          </div>
          <span
            class="hidden shrink-0 text-[11px] uppercase tracking-[0.14em] text-white/40 sm:inline"
          >
            ${translateText("lobby_deck.class_subtitle")}
          </span>
        </div>

        <!-- La grille de la maquette : le jeu a gauche, la file a droite. -->
        <div
          id="starfall-grid"
          class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start"
        >
          <div class="flex min-w-0 flex-col gap-4 lg:col-span-8">
            <!-- Identite : le tag et l'indicatif, dans leur cadre. -->
            <div class="hud-glass rounded-2xl p-4">
              <div
                class="mb-3 text-[11px] uppercase tracking-[0.18em] text-white/40"
              >
                ${translateText("lobby_deck.identity")}
              </div>
              <!-- Les deux intitules, cales sur la largeur des champs qu'ils
                   annoncent (le tag a gauche, l'indicatif a droite). -->
              <div
                class="mb-1 flex items-end gap-2 px-1 text-[10px] uppercase tracking-[0.14em] text-white/45"
              >
                <span class="flex w-[7.25rem] shrink-0 items-baseline justify-between gap-1">
                  <span>${translateText("lobby_deck.tag_label")}</span>
                  <span
                    class="text-[9px]"
                    style="color: var(--color-vanguard)"
                    >${translateText("lobby_deck.tag_hint")}</span
                  >
                </span>
                <span class="min-w-0 truncate"
                  >${translateText("lobby_deck.callsign_label")}</span
                >
              </div>
              <div
                class="relative flex items-center rounded-xl border border-white/10 bg-black/25 p-1"
              >
                <cosmetic-background
                  class="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-xl opacity-60"
                ></cosmetic-background>
                <username-input
                  class="relative z-10 h-11 w-full min-w-0"
                ></username-input>
              </div>
            </div>

            <div class="hud-glass rounded-2xl p-3 sm:p-4">
              <faction-selector></faction-selector>
            </div>

            <div class="hud-glass rounded-2xl p-3 sm:p-4">
              <game-mode-selector></game-mode-selector>
            </div>

            <div class="hud-glass rounded-2xl p-3 sm:p-4">
              <map-catalog></map-catalog>
            </div>
          </div>

          <div class="min-w-0 lg:col-span-4">
            <deployment-panel></deployment-panel>
          </div>
        </div>
        </div>

        <!-- Desktop gets the compact footer button instead. -->
        ${
          SERVICES_DE_COMPTE
            ? html`<steam-wishlist
                campaign="home_mobile"
                class="block px-2 pb-4 lg:hidden"
              ></steam-wishlist>`
            : ""
        }
      </div>
    `;
  }
}
