import { LitElement, html } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import { Controller } from "../../Controller";
import { SendChatEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView } from "../../view";

/** Au-dela, le schema du fil binaire refuse le message (Schemas.ts). */
const MAX_LENGTH = 200;

/**
 * La barre pour ecrire aux autres joueurs pendant la partie.
 *
 * Le chat d'origine ne propose que des phrases toutes faites, adressees a un
 * joueur : impossible de negocier quoi que ce soit. Ici on ecrit ce qu'on veut,
 * a tout le monde.
 *
 * Deux details qui comptent plus qu'ils n'en ont l'air :
 *
 * - Entree ouvre la barre, Entree envoie, Echap ferme. On ne tape pas dans une
 *   zone de texte toujours ouverte, sinon la moitie des raccourcis du jeu
 *   (une lettre = une action) deviennent inutilisables.
 * - Tant que la barre a le curseur, les touches ne redescendent PAS vers le
 *   jeu : sans ca, ecrire « attaque » declencherait une demi-douzaine
 *   d'actions au passage.
 *
 * Les messages s'affichent dans la liste d'evenements existante, ou ils sont
 * deja nettoyes par DOMPurify.
 */
@customElement("chat-bar")
export class ChatBar extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private open = false;
  @query("#chat-bar-input") private input?: HTMLInputElement;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (this.open) return;
    // Ni dans un autre champ de saisie (pseudo, recherche de joueur...), ni
    // en pleine combinaison de touches.
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key !== "Enter") return;
    e.preventDefault();
    this.openBar();
  };

  createRenderRoot() {
    this.style.position = "fixed";
    this.style.left = "0.5rem";
    this.style.bottom = "5.5rem";
    this.style.zIndex = "900";
    return this;
  }

  init() {
    document.addEventListener("keydown", this.onKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.onKeyDown);
  }

  tick() {}

  private openBar() {
    this.open = true;
    // Le champ n'existe qu'une fois le rendu fait.
    this.updateComplete.then(() => this.input?.focus());
  }

  private closeBar() {
    this.open = false;
  }

  private send() {
    const text = this.input?.value ?? "";
    if (text.trim().length > 0) {
      this.eventBus.emit(new SendChatEvent(text));
    }
    if (this.input) this.input.value = "";
    this.closeBar();
  }

  private onInputKeyDown(e: KeyboardEvent) {
    // Le jeu ecoute les touches au niveau du document : tant qu'on ecrit, il
    // ne doit rien recevoir.
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      this.send();
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.closeBar();
    }
  }

  render() {
    if (!this.game?.myPlayer()) return html``;
    if (!this.open) {
      return html`
        <button
          class="rounded bg-black/50 px-2 py-1 text-[10px] text-white/80 hover:bg-black/70"
          title=${translateText("chat_bar.hint")}
          @click=${() => this.openBar()}
        >
          ${translateText("chat_bar.button")}
        </button>
      `;
    }
    return html`
      <div class="flex items-center gap-1 rounded bg-black/70 px-2 py-1">
        <input
          id="chat-bar-input"
          type="text"
          maxlength=${MAX_LENGTH}
          class="w-64 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
          placeholder=${translateText("chat_bar.placeholder")}
          autocomplete="off"
          @keydown=${(e: KeyboardEvent) => this.onInputKeyDown(e)}
          @keyup=${(e: KeyboardEvent) => e.stopPropagation()}
          @keypress=${(e: KeyboardEvent) => e.stopPropagation()}
        />
        <button
          class="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white hover:bg-white/20"
          @click=${() => this.send()}
        >
          ${translateText("chat_bar.send")}
        </button>
      </div>
    `;
  }
}
