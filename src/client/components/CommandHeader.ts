import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ClientEnv } from "../ClientEnv";
import { translateText } from "../Utils";
import "./LanguageToggle";

/** Intervalle entre deux mesures de latence. */
const PING_INTERVAL_MS = 30_000;

/**
 * L'en-tete du poste de commandement, d'apres la maquette.
 *
 * Cinq panneaux de verre alignes : la marque et sa version, les onglets, les
 * langues, la latence, et le joueur. C'est la premiere chose qu'on voit, donc
 * la seule partie de l'ecran ou la ressemblance compte vraiment.
 *
 * La latence est MESUREE, pas decorative : un aller-retour sur /api/health
 * toutes les trente secondes. Afficher un chiffre invente serait pire que de
 * ne rien afficher — c'est justement ce qu'un joueur regarde quand il se
 * demande si la lenteur vient de lui ou du serveur.
 */
@customElement("command-header")
export class CommandHeader extends LitElement {
  @state() private pingMs: number | null = null;
  @state() private joueur = "";
  @state() private ongletLore = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private observateur: MutationObserver | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.lireJoueur();
    void this.mesurer();
    this.timer = setInterval(() => void this.mesurer(), PING_INTERVAL_MS);
    this.suivrePageLore();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.observateur?.disconnect();
    this.observateur = null;
  }

  /**
   * L'onglet actif suit la page, pas le dernier clic : fermer les archives par
   * leur croix ne passe pas par nos boutons, et l'onglet serait reste allume
   * sur une page fermee.
   */
  private suivrePageLore() {
    const page = document.getElementById("page-lore");
    if (page === null) return;
    const relire = () => {
      this.ongletLore = !page.classList.contains("hidden");
    };
    relire();
    this.observateur = new MutationObserver(relire);
    this.observateur.observe(page, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  private lireJoueur() {
    try {
      const tag = (localStorage.getItem("clanTag") ?? "").toUpperCase();
      const nom = localStorage.getItem("username") ?? "";
      this.joueur = tag !== "" && nom !== "" ? `[${tag}] ${nom}` : nom;
    } catch {
      // Navigation privee, stockage bloque : on n'affiche rien.
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
      // Serveur injoignable : on efface la valeur plutot que d'afficher une
      // mesure perimee, qui ferait croire que tout va bien.
      this.pingMs = null;
    }
    this.lireJoueur();
  }

  private ouvrir(lore: boolean) {
    if (lore) {
      window.showPage?.("page-lore");
      const el = document.querySelector("faction-lore-modal") as
        | (HTMLElement & { open?: () => void })
        | null;
      el?.open?.();
    } else {
      window.showPage?.("page-play");
    }
  }

  render() {
    const version = ClientEnv.gitCommit();
    return html`
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <!-- Marque et version -->
        <div class="hud-glass flex items-center gap-3 rounded-xl px-3 py-2">
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
            style="color: var(--color-vanguard); border-color: color-mix(in srgb, var(--color-vanguard) 40%, transparent); background: color-mix(in srgb, var(--color-vanguard) 20%, transparent)"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor">
              <path
                d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
                fill-opacity="0.85"
              />
            </svg>
          </span>
          <span class="flex items-center gap-2">
            <span
              class="text-sm font-bold tracking-[0.18em] text-white"
              translate="no"
              >STARFALL.IO</span
            >
            ${version
              ? html`<span
                  class="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em]"
                  style="color: var(--color-vanguard); border-color: color-mix(in srgb, var(--color-vanguard) 30%, transparent); background: color-mix(in srgb, var(--color-vanguard) 15%, transparent)"
                  >${version.slice(0, 12)}</span
                >`
              : nothing}
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Onglets -->
          <div class="hud-glass flex items-center gap-1 rounded-xl px-2 py-1.5">
            ${this.renderOnglet(false, translateText("status_bar.tab_lobby"))}
            ${this.renderOnglet(true, translateText("status_bar.tab_lore"))}
          </div>

          <!-- Langues -->
          <div class="hud-glass flex items-center rounded-xl px-2 py-1.5">
            <language-toggle></language-toggle>
          </div>

          <!-- Latence -->
          <div
            class="hud-glass hidden items-center gap-2 rounded-xl px-3 py-2 text-[11px] md:flex"
          >
            <span
              class="h-2 w-2 rounded-full"
              style=${`background: ${this.pingMs === null ? "#ef4444" : "#34d399"}`}
              aria-hidden="true"
            ></span>
            <span class="tabular-nums tracking-[0.1em] text-white/60"
              >${this.pingMs === null
                ? translateText("status_bar.offline")
                : `${this.pingMs} ms`}</span
            >
          </div>

          <!-- Joueur -->
          ${this.joueur
            ? html`<div class="hud-glass rounded-xl px-3 py-1.5 text-right">
                <span class="block max-w-[12rem] truncate text-xs text-white/85"
                  >${this.joueur}</span
                >
                <span
                  class="block text-[10px] tracking-[0.12em]"
                  style="color: #34d399"
                  >${translateText("status_bar.ready")}</span
                >
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }

  private renderOnglet(lore: boolean, libelle: string) {
    const actif = this.ongletLore === lore;
    return html`
      <button
        type="button"
        class="rounded-lg border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${actif
          ? "text-white"
          : "border-transparent text-white/40 hover:text-white/75"}"
        style=${actif
          ? "border-color: color-mix(in srgb, var(--color-vanguard) 50%, transparent); background: color-mix(in srgb, var(--color-vanguard) 25%, transparent)"
          : ""}
        aria-pressed=${actif ? "true" : "false"}
        @click=${() => this.ouvrir(lore)}
      >
        ${libelle}
      </button>
    `;
  }
}
