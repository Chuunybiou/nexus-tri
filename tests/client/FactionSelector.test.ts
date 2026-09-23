// @vitest-environment jsdom
import "../../src/client/components/FactionSelector";
import {
  FACTION_CHANGED_EVENT,
  FactionSelector,
} from "../../src/client/components/FactionSelector";
import {
  ALL_FACTIONS,
  DEFAULT_FACTION,
  Faction,
} from "../../src/core/game/Factions";
import { UserSettings } from "../../src/core/game/UserSettings";

async function mount(): Promise<FactionSelector> {
  const el = document.createElement("faction-selector") as FactionSelector;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function options(el: FactionSelector): HTMLButtonElement[] {
  return Array.from(el.querySelectorAll('button[role="radio"]'));
}

function checkedIndex(el: FactionSelector): number {
  return options(el).findIndex(
    (b) => b.getAttribute("aria-checked") === "true",
  );
}

describe("FactionSelector", () => {
  beforeEach(() => {
    // UserSettings caches in a private static Map shared by every instance, so
    // clearing localStorage alone would leave the previous test's pick in
    // place. Writing the anchor through the public setter resets both.
    new UserSettings().setSelectedFaction(DEFAULT_FACTION);
    document.body.innerHTML = "";
  });

  it("offers exactly the three factions", async () => {
    const el = await mount();
    expect(options(el)).toHaveLength(3);
  });

  it("opens on the stored pick rather than always the anchor", async () => {
    new UserSettings().setSelectedFaction(Faction.Swarm);
    const el = await mount();
    expect(checkedIndex(el)).toBe(ALL_FACTIONS.indexOf(Faction.Swarm));
  });

  it("persists a pick, so a reload keeps it", async () => {
    const el = await mount();
    const index = ALL_FACTIONS.indexOf(Faction.Swarm);
    options(el)[index].click();
    await el.updateComplete;

    expect(new UserSettings().selectedFaction()).toBe(Faction.Swarm);
    expect(checkedIndex(el)).toBe(index);
  });

  it("announces the change so the lobby can pick it up", async () => {
    const el = await mount();
    const seen: Faction[] = [];
    el.addEventListener(FACTION_CHANGED_EVENT, (e) =>
      seen.push((e as CustomEvent<Faction>).detail),
    );

    const index = ALL_FACTIONS.indexOf(Faction.Ascendant);
    options(el)[index].click();
    await el.updateComplete;
    // Clicking the already-selected option must not re-announce.
    options(el)[index].click();
    await el.updateComplete;

    expect(seen).toEqual([Faction.Ascendant]);
  });

  it("keeps exactly one option checked at a time", async () => {
    const el = await mount();
    for (let index = 0; index < ALL_FACTIONS.length; index++) {
      options(el)[index].click();
      await el.updateComplete;
      const checked = options(el).map((b) => b.getAttribute("aria-checked"));
      expect(checked.filter((v) => v === "true")).toHaveLength(1);
      expect(checked[index]).toBe("true");
    }
  });
});

describe("UserSettings.selectedFaction", () => {
  it("round-trips every faction", () => {
    const settings = new UserSettings();
    for (const faction of ALL_FACTIONS) {
      settings.setSelectedFaction(faction);
      expect(new UserSettings().selectedFaction()).toBe(faction);
    }
  });

  it("falls back to the anchor on a value storage should not hold", () => {
    // Hand-edited localStorage, or a value written by an older build.
    new UserSettings().setSelectedFaction("PROTOSS" as Faction);
    expect(new UserSettings().selectedFaction()).toBe(DEFAULT_FACTION);
  });
});
