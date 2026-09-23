// @vitest-environment jsdom
import fs from "fs";
import path from "path";
import "../../src/client/hud/layers/FactionStatus";
import { FactionStatus } from "../../src/client/hud/layers/FactionStatus";
import { Faction, swarmHoardThreshold } from "../../src/core/game/Factions";
import { UnitType } from "../../src/core/game/Game";

const EN_JSON = path.join(
  __dirname,
  "..",
  "..",
  "resources",
  "lang",
  "en.json",
);

const MAX_TROOPS = 100_000;

interface FakePlayerOptions {
  faction: Faction;
  troops?: number;
  cities?: number;
  alive?: boolean;
}

/** Just enough of a PlayerView for the cues, which read very little. */
function fakePlayer(opts: FakePlayerOptions) {
  return {
    faction: () => opts.faction,
    isAlive: () => opts.alive ?? true,
    troops: () => opts.troops ?? 0,
    units: (type: UnitType) =>
      type === UnitType.City ? new Array(opts.cities ?? 0).fill({}) : [],
  };
}

async function mount(
  player: ReturnType<typeof fakePlayer> | null,
  inSpawnPhase = false,
): Promise<FactionStatus> {
  const el = document.createElement("faction-status") as FactionStatus;
  el.game = {
    myPlayer: () => player,
    inSpawnPhase: () => inSpawnPhase,
    config: () => ({ maxTroops: () => MAX_TROOPS }),
  } as unknown as FactionStatus["game"];
  document.body.appendChild(el);
  el.tick();
  await el.updateComplete;
  return el;
}

function text(el: FactionStatus): string {
  return el.textContent!.replace(/\s+/g, " ").trim();
}

const hoarding = swarmHoardThreshold(MAX_TROOPS) + 1;
const frugal = swarmHoardThreshold(MAX_TROOPS);

describe("FactionStatus", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("says nothing for Vanguard, which has no mechanic of its own", async () => {
    const el = await mount(
      fakePlayer({ faction: Faction.Vanguard, troops: 999_999 }),
    );
    expect(text(el)).toBe("");
  });

  it("warns a Swarm player whose troops are rotting", async () => {
    const el = await mount(
      fakePlayer({ faction: Faction.Swarm, troops: hoarding }),
    );
    expect(text(el)).not.toBe("");
  });

  it("stays quiet for a Swarm player under the threshold", async () => {
    // Exactly at the line: the rule rots the EXCESS, and at zero excess there
    // is nothing to warn about.
    const el = await mount(
      fakePlayer({ faction: Faction.Swarm, troops: frugal }),
    );
    expect(text(el)).toBe("");
  });

  it("warns an Ascendant player whose grid is down", async () => {
    const el = await mount(
      fakePlayer({ faction: Faction.Ascendant, cities: 0 }),
    );
    expect(text(el)).not.toBe("");
  });

  it("stays quiet once the Ascendant player holds a city", async () => {
    const el = await mount(
      fakePlayer({ faction: Faction.Ascendant, cities: 1 }),
    );
    expect(text(el)).toBe("");
  });

  it("stays quiet during the spawn phase, like the executions do", async () => {
    const el = await mount(
      fakePlayer({ faction: Faction.Ascendant, cities: 0 }),
      true,
    );
    expect(text(el)).toBe("");
  });

  it("stays quiet for a dead player", async () => {
    const el = await mount(
      fakePlayer({ faction: Faction.Ascendant, cities: 0, alive: false }),
    );
    expect(text(el)).toBe("");
  });

  it("survives having no player at all", async () => {
    const el = await mount(null);
    expect(text(el)).toBe("");
  });

  it("clears the warning once the player fixes the cause", async () => {
    let cities = 0;
    const player = {
      faction: () => Faction.Ascendant,
      isAlive: () => true,
      troops: () => 0,
      units: (type: UnitType) =>
        type === UnitType.City ? new Array(cities).fill({}) : [],
    };
    const el = await mount(player);
    expect(text(el)).not.toBe("");

    cities = 1;
    el.tick();
    await el.updateComplete;
    expect(text(el)).toBe("");
  });

  it("never swallows a click meant for the map underneath", async () => {
    const el = await mount(
      fakePlayer({ faction: Faction.Ascendant, cities: 0 }),
    );
    expect(el.style.pointerEvents).toBe("none");
  });

  it("uses i18n keys that exist in en.json", () => {
    const en = JSON.parse(fs.readFileSync(EN_JSON, "utf8"));
    for (const key of [
      "grid_offline",
      "grid_offline_detail",
      "swarm_rotting",
      "swarm_rotting_detail",
    ]) {
      expect(en.faction[key]).toBeTypeOf("string");
      expect(en.faction[key].length).toBeGreaterThan(0);
    }
  });

  it("is registered for re-render once translations load", () => {
    // translateText() returns the key unchanged until the language file has
    // loaded, and Lit components render before that. LangSelector fixes it by
    // calling requestUpdate() on a hardcoded list of tags — a component left
    // off that list shows "faction.grid_offline" on screen forever, and no
    // amount of unit testing catches it.
    const source = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "client", "LangSelector.ts"),
      "utf8",
    );
    expect(source).toContain('"faction-status"');
  });
});
