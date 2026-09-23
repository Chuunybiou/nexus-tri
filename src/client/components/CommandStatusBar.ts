import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ClientEnv } from "../ClientEnv";
import { translateText } from "../Utils";

/** Intervalle entre deux mesures de latence. */
const PING_INTERVAL_MS = 30_000;

/**
 * La bande d'etat du poste de commandement : version, latence, joueur.
 *
 * La latence est MESUREE, pas decorative : un aller-retour sur /api/health,
 * toutes les trente secondes. Afficher un chiffre invente serait pire que de
 * ne rien afficher — c'est justement ce qu'un joueur regarde quand il se
 * demande si la lenteur vient de lui ou du serveur.
 */
@customElement("command-status-bar")
export class CommandStatusBar extends LitElement {
  @state() private pingMs: number | null = null;
  @state() private joueur = "";
  private timer: ReturnType<typeof setInterval> | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.lireJoueur();
    void this.mesurer();
    this.timer = setInterval(() => void this.mesurer(), PING_INTERVAL_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private lireJoueur() {
    try {
      this.joueur = localStorage.getItem("username") ?? "";
    } catch {
      // Navigation privee, stockage bloque : on affiche simplement rien.
      this.joueur = "";
    }
  }

  private async mesurer() {
    const debut = performance.now();
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      this.pingMs = Math.round(performance.now() - debut);
    } catch {
      // Serveur injoignable : on efface la valeur au lieu d'afficher une
      // mesure perimee, qui ferait croire que tout va bien.
      this.pingMs = null;
    }
    this.lireJoueur();
  }

  render() {
    const version = ClientEnv.gitCommit();
    return html`
      <div
        class="hud-glass flex items-center justify-between gap-3 rounded-xl px-3 py-1.5"
      >
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            style="background: var(--color-vanguard)"
            aria-hidden="true"
          ></span>
          <span
            class="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-white/70"
            >Nexus Tri</span
          >
          ${version
            ? html`<span
                class="shrink-0 rounded border border-white/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white/45"
                >${version.slice(0, 12)}</span
              >`
            : nothing}
        </div>

        <div class="flex shrink-0 items-center gap-3 text-[10px]">
          <span class="flex items-center gap-1.5">
            <span
              class="h-1.5 w-1.5 rounded-full"
              style=${`background: ${
                this.pingMs === null ? "#ef4444" : "#34d399"
              }`}
              aria-hidden="true"
            ></span>
            <span class="tabular-nums uppercase tracking-[0.12em] text-white/50"
              >${this.pingMs === null
                ? translateText("status_bar.offline")
                : `${this.pingMs} ms`}</span
            >
          </span>
          ${this.joueur
            ? html`<span class="hidden text-right sm:block">
                <span class="block max-w-[10rem] truncate text-white/75"
                  >${this.joueur}</span
                >
                <span
                  class="block text-[9px] uppercase tracking-[0.14em]"
                  style="color: #34d399"
                  >${translateText("status_bar.ready")}</span
                >
              </span>`
            : nothing}
        </div>
      </div>
    `;
  }
}
