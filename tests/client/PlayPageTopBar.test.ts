import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SERVICES_DE_COMPTE } from "../../src/client/NexusTri";

const { isOnCrazyGames } = vi.hoisted(() => ({
  isOnCrazyGames: vi.fn(() => false),
}));
vi.mock("../../src/client/CrazyGamesSDK", () => ({
  crazyGamesSDK: {
    isOnCrazyGames,
    getUsername: vi.fn(async () => null),
    getUserProfile: vi.fn(async () => null),
    showAuthPrompt: vi.fn(async () => null),
    addAuthListener: vi.fn(),
  },
}));
vi.mock("../../src/core/AssetUrls", () => ({
  assetUrl: (path: string) => path,
}));

// Rendering play-page mounts its children too (steam-wishlist, cosmetic
// background, …), and some reach for browser APIs jsdom doesn't ship.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { PlayPage } from "../../src/client/components/PlayPage";

describe("play-page mobile top bar", () => {
  let el: PlayPage;

  async function mount() {
    if (!customElements.get("play-page")) {
      customElements.define("play-page", PlayPage);
    }
    el = document.createElement("play-page") as PlayPage;
    document.body.appendChild(el);
    await el.updateComplete;
  }

  afterEach(() => {
    el?.remove();
    vi.clearAllMocks();
    isOnCrazyGames.mockReturnValue(false);
  });

  const rightSlot = () =>
    Array.from(el.querySelector(".col-start-3")!.children).map((c) =>
      c.tagName.toLowerCase(),
    );

  describe("off CrazyGames", () => {
    beforeEach(mount);

    it("puts the bell/help icons beside the profile menu", () => {
      // Nexus Tri masque le controle de profil tant que SERVICES_DE_COMPTE est
      // false (pas de comptes sans le service ferme) : le test suit le drapeau.
      expect(rightSlot()).toEqual(
        SERVICES_DE_COMPTE
          ? ["language-toggle", "nav-utility-icons", "nav-account-menu"]
          : ["language-toggle", "nav-utility-icons"],
      );
    });
  });

  describe("on CrazyGames", () => {
    beforeEach(async () => {
      isOnCrazyGames.mockReturnValue(true);
      await mount();
    });

    it("renders the same controls — the menu covers their sign-in too", () => {
      // News and Help left the hamburger, so the icons have to be here for
      // CrazyGames players; the profile menu's own "Sign in" item hands off to
      // their SDK prompt, so no platform-specific button is needed.
      expect(rightSlot()).toEqual(
        SERVICES_DE_COMPTE
          ? ["language-toggle", "nav-utility-icons", "nav-account-menu"]
          : ["language-toggle", "nav-utility-icons"],
      );
    });
  });
});
