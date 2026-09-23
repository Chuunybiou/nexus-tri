// @vitest-environment jsdom
import "../../src/client/components/LanguageToggle";
import { LanguageToggle } from "../../src/client/components/LanguageToggle";

async function mount(): Promise<LanguageToggle> {
  const el = document.createElement("language-toggle") as LanguageToggle;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function buttons(el: LanguageToggle): HTMLButtonElement[] {
  return Array.from(el.querySelectorAll("button"));
}

function pressed(el: LanguageToggle): string[] {
  return buttons(el)
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.textContent!.trim());
}

/** Stands in for the real <lang-selector> the toggle reads on first paint. */
function fakeSelector(currentLang: string | undefined) {
  const el = document.createElement("lang-selector");
  if (currentLang !== undefined) {
    (el as unknown as { currentLang: string }).currentLang = currentLang;
  }
  document.body.appendChild(el);
  return el;
}

describe("LanguageToggle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("offers exactly English and French", async () => {
    const el = await mount();
    expect(buttons(el).map((b) => b.textContent!.trim())).toEqual(["EN", "FR"]);
  });

  it("does not add a second lang-selector", async () => {
    // translateText() resolves the active language through the FIRST
    // <lang-selector> in the DOM, so a toggle that rendered its own would
    // shadow the real one and quietly break every translation on the page.
    await mount();
    expect(document.querySelectorAll("lang-selector")).toHaveLength(0);
  });

  it("opens on the language the selector reports", async () => {
    fakeSelector("fr");
    const el = await mount();
    expect(pressed(el)).toEqual(["FR"]);
  });

  it("falls back to stored language before the selector has booted", async () => {
    localStorage.setItem("lang", "fr");
    const el = await mount();
    expect(pressed(el)).toEqual(["FR"]);
  });

  it("leaves both unpressed on a language it does not offer", async () => {
    // Better to show neither than to label German as English.
    fakeSelector("de");
    const el = await mount();
    expect(pressed(el)).toEqual([]);
  });

  it("asks the real selector to switch rather than switching itself", async () => {
    const el = await mount();
    const asked: string[] = [];
    window.addEventListener("language-selected", (e) =>
      asked.push((e as CustomEvent).detail.lang),
    );

    buttons(el)[1].click();
    await el.updateComplete;

    expect(asked).toEqual(["fr"]);
    expect(pressed(el)).toEqual(["FR"]);
  });

  it("does not re-announce the language already active", async () => {
    const el = await mount();
    const asked: string[] = [];
    window.addEventListener("language-selected", (e) =>
      asked.push((e as CustomEvent).detail.lang),
    );

    buttons(el)[0].click(); // EN, already current
    await el.updateComplete;

    expect(asked).toEqual([]);
  });

  it("survives the selector still reporting the old language", async () => {
    // changeLanguage() awaits a fetch before updating currentLang. Re-reading
    // the selector on the event would report the OLD language and undo the
    // switch the player just made.
    const selector = fakeSelector("en");
    const el = await mount();

    buttons(el)[1].click();
    await el.updateComplete;
    // The selector has not caught up yet, exactly as in the real app.
    expect((selector as unknown as { currentLang: string }).currentLang).toBe(
      "en",
    );
    expect(pressed(el)).toEqual(["FR"]);
  });

  it("follows a switch made somewhere else, like the footer selector", async () => {
    const el = await mount();
    window.dispatchEvent(
      new CustomEvent("language-selected", { detail: { lang: "fr" } }),
    );
    await el.updateComplete;

    expect(pressed(el)).toEqual(["FR"]);
  });
});
