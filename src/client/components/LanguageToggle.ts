import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

/** The two languages this toggle offers, in display order. */
const LANGUAGES = [
  { code: "en", label: "EN", native: "English" },
  { code: "fr", label: "FR", native: "Français" },
] as const;

/**
 * A two-language shortcut for the top of the page.
 *
 * Deliberately NOT a second <lang-selector>: `translateText()` resolves the
 * active language through `document.querySelector("lang-selector")`, so a
 * second instance would shadow the real one and translations would start
 * reading from whichever element happened to be first in the DOM. This dispatches
 * the same `language-selected` event that the footer's selector already listens
 * for, so the one real selector still owns loading, persistence and re-render.
 *
 * The full list of 40 languages stays in that footer selector; this is a
 * shortcut for the two that most players here want, not a replacement.
 */
@customElement("language-toggle")
export class LanguageToggle extends LitElement {
  @state() private current = "en";

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.syncFromSelector();
    window.addEventListener("language-selected", this.onLanguageSelected);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("language-selected", this.onLanguageSelected);
  }

  private onLanguageSelected = (e: Event) => {
    // Trust the event, not the selector. changeLanguage() awaits a fetch before
    // it updates currentLang, so re-reading the selector here reports the OLD
    // language and would undo the switch the player just made.
    const lang = (e as CustomEvent).detail?.lang;
    if (typeof lang === "string") {
      this.current = lang;
    } else {
      this.syncFromSelector();
    }
  };

  /**
   * Reads the language the app is actually using.
   *
   * The selector is the source of truth once it has booted; localStorage is the
   * fallback for the first paint, before it has. Neither is guaranteed to be one
   * of our two, so anything else leaves both buttons unselected rather than
   * mislabelling, say, German as English.
   */
  private syncFromSelector() {
    const selector = document.querySelector("lang-selector") as {
      currentLang?: string;
    } | null;
    let lang = selector?.currentLang;
    if (lang === undefined) {
      try {
        lang = localStorage.getItem("lang") ?? undefined;
      } catch {
        // Private browsing or blocked storage: fall through to the default.
      }
    }
    this.current = lang ?? "en";
  }

  private select(code: string) {
    if (code === this.current) return;
    // Let the one real selector do the work: it persists the choice, fetches
    // the language file and re-applies every translation on the page.
    window.dispatchEvent(
      new CustomEvent("language-selected", { detail: { lang: code } }),
    );
    this.current = code;
  }

  render() {
    return html`
      <div
        class="flex items-center gap-1 rounded-lg bg-surface/70 p-1"
        role="group"
        aria-label="Language"
      >
        ${LANGUAGES.map((lang) => this.renderOption(lang))}
      </div>
    `;
  }

  private renderOption(lang: (typeof LANGUAGES)[number]) {
    const isCurrent = lang.code === this.current;
    return html`
      <button
        type="button"
        lang=${lang.code}
        title=${lang.native}
        aria-label=${lang.native}
        aria-pressed=${isCurrent ? "true" : "false"}
        class="px-2 py-1 text-xs font-semibold rounded-md transition-colors
               ${isCurrent
          ? "bg-white/20 text-white"
          : "text-white/60 hover:text-white hover:bg-white/10"}"
        @click=${() => this.select(lang.code)}
      >
        ${lang.label}
      </button>
    `;
  }
}
