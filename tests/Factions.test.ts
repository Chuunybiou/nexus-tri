import fs from "fs";
import path from "path";
import {
  ALL_FACTIONS,
  DEFAULT_FACTION,
  FACTIONS,
  Faction,
  PER_MILLE_BASE,
  factionTraits,
  isFaction,
  scaleGoldPerMille,
  scalePerMille,
} from "../src/core/game/Factions";

const EN_JSON = path.join(__dirname, "..", "resources", "lang", "en.json");

describe("FACTIONS table", () => {
  it("covers every Faction exactly once, with matching ids", () => {
    const enumValues = Object.values(Faction);
    expect(Object.keys(FACTIONS).sort()).toEqual([...enumValues].sort());
    expect([...ALL_FACTIONS].sort()).toEqual([...enumValues].sort());
    for (const [key, traits] of Object.entries(FACTIONS)) {
      expect(traits.id).toBe(key);
    }
  });

  it("keeps Vanguard as the neutral balance anchor", () => {
    // Every modifier at base means a Vanguard player plays exactly like a
    // pre-faction player, so existing balance tests keep their meaning.
    const v = FACTIONS[Faction.Vanguard];
    expect(v.troopGrowthPerMille).toBe(PER_MILLE_BASE);
    expect(v.goldRatePerMille).toBe(PER_MILLE_BASE);
    expect(v.attackPerMille).toBe(PER_MILLE_BASE);
    expect(v.unitCostPerMille).toBe(PER_MILLE_BASE);
    expect(DEFAULT_FACTION).toBe(Faction.Vanguard);
  });

  it("states every modifier as a plain integer in a sane range", () => {
    // Floats here would drift between clients; see the module header.
    for (const traits of Object.values(FACTIONS)) {
      const modifiers = [
        traits.troopGrowthPerMille,
        traits.goldRatePerMille,
        traits.attackPerMille,
        traits.unitCostPerMille,
      ];
      for (const m of modifiers) {
        expect(Number.isInteger(m)).toBe(true);
        expect(m).toBeGreaterThan(0);
        // A modifier past 2x is a redesign, not a tweak — fail loudly.
        expect(m).toBeLessThanOrEqual(2 * PER_MILLE_BASE);
      }
    }
  });

  it("gives each non-baseline faction a real trade-off", () => {
    // Asymmetry only works if no faction is strictly better than the anchor.
    for (const faction of [Faction.Swarm, Faction.Ascendant]) {
      const t = FACTIONS[faction];
      const modifiers = [
        t.troopGrowthPerMille,
        t.goldRatePerMille,
        t.attackPerMille,
        // Cost is inverted: paying less is the buff.
        2 * PER_MILLE_BASE - t.unitCostPerMille,
      ];
      expect(modifiers.some((m) => m > PER_MILLE_BASE)).toBe(true);
      expect(modifiers.some((m) => m < PER_MILLE_BASE)).toBe(true);
    }
  });
});

describe("faction i18n keys", () => {
  it("resolves against en.json", () => {
    const en = JSON.parse(fs.readFileSync(EN_JSON, "utf8"));
    for (const traits of Object.values(FACTIONS)) {
      for (const key of [traits.nameKey, traits.descriptionKey]) {
        const [section, leaf] = key.split(".");
        expect(key.split(".")).toHaveLength(2);
        expect(en[section]?.[leaf]).toBeTypeOf("string");
        expect(en[section][leaf].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("isFaction", () => {
  it("accepts the real values and rejects everything else", () => {
    for (const faction of ALL_FACTIONS) {
      expect(isFaction(faction)).toBe(true);
    }
    for (const bad of [
      "vanguard",
      "Vanguard",
      "TERRAN",
      "",
      null,
      undefined,
      0,
      {},
      ["SWARM"],
      // Object.prototype members must not leak through the lookup.
      "toString",
      "constructor",
    ]) {
      expect(isFaction(bad)).toBe(false);
    }
  });
});

describe("factionTraits", () => {
  it("falls back to the baseline when no faction is set", () => {
    // Replays, bots and old wire messages all arrive without one.
    expect(factionTraits(null)).toBe(FACTIONS[DEFAULT_FACTION]);
    expect(factionTraits(undefined)).toBe(FACTIONS[DEFAULT_FACTION]);
    expect(factionTraits(Faction.Swarm)).toBe(FACTIONS[Faction.Swarm]);
  });
});

describe("scalePerMille", () => {
  it("leaves values untouched at the base rate", () => {
    for (const value of [0, 1, 7, 250_000, 4_000_000_000_000]) {
      expect(scalePerMille(value, PER_MILLE_BASE)).toBe(value);
    }
  });

  it("applies buffs and debuffs as integers", () => {
    expect(scalePerMille(1000, 1250)).toBe(1250);
    expect(scalePerMille(1000, 750)).toBe(750);
    expect(scalePerMille(100, 1250)).toBe(125);
    // Rounds rather than truncating, so small values are not eaten.
    expect(scalePerMille(1, 1250)).toBe(1);
    expect(scalePerMille(3, 900)).toBe(3);
  });

  it("rounds halves away from zero, symmetrically", () => {
    expect(scalePerMille(5, 500)).toBe(3);
    expect(scalePerMille(-5, 500)).toBe(-3);
    expect(scalePerMille(-1000, 1250)).toBe(-1250);
  });

  it("is deterministic: same inputs, same integer, every time", () => {
    // The whole point of per-mille integers — every client must agree.
    for (const traits of Object.values(FACTIONS)) {
      for (let value = 0; value < 500; value++) {
        const first = scalePerMille(value, traits.attackPerMille);
        expect(scalePerMille(value, traits.attackPerMille)).toBe(first);
        expect(Number.isInteger(first)).toBe(true);
      }
    }
  });

  it("rejects non-integer input instead of silently drifting", () => {
    expect(() => scalePerMille(1.5, 1000)).toThrow();
    expect(() => scalePerMille(NaN, 1000)).toThrow();
    expect(() => scalePerMille(100, 1150.5)).toThrow();
  });

  it("refuses products past 2^53 rather than desyncing clients", () => {
    // Above the exact-integer range the product is rounded before the divide,
    // so two clients can land one apart. Throwing beats disagreeing silently.
    expect(() => scalePerMille(7_536_911_884_871_098, 1250)).toThrow();
    // A value right up against the limit is still accepted.
    expect(scalePerMille(4_503_599_627_370, 2000)).toBe(9_007_199_254_740);
  });
});

describe("scaleGoldPerMille", () => {
  it("stays in exact bigint arithmetic", () => {
    expect(scaleGoldPerMille(1_000_000n, PER_MILLE_BASE)).toBe(1_000_000n);
    expect(scaleGoldPerMille(1_000_000n, 1100)).toBe(1_100_000n);
    expect(scaleGoldPerMille(1_000_000n, 900)).toBe(900_000n);
    // Truncates toward zero; gold is never fractional.
    expect(scaleGoldPerMille(1n, 1100)).toBe(1n);
    expect(scaleGoldPerMille(0n, 1250)).toBe(0n);
  });

  it("survives values far past Number.MAX_SAFE_INTEGER", () => {
    // Late-game treasuries genuinely reach this range.
    const huge = 10n ** 30n;
    expect(scaleGoldPerMille(huge, 1100)).toBe((huge * 11n) / 10n);
  });
});
