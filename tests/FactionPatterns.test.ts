import { PatternDecoder } from "../src/core/PatternDecoder";
import { factionPattern, packPattern } from "../src/core/game/FactionPatterns";
import { ALL_FACTIONS, Faction } from "../src/core/game/Factions";

/** Re-attach the header so the shipped decoder can read what we packed. */
function decoderFor(art: readonly string[], scale: number): PatternDecoder {
  const bytes = packPattern(art, scale);
  return new PatternDecoder({ patternData: "unused" } as never, () => bytes);
}

describe("packPattern", () => {
  it("round-trips through the decoder the renderer actually uses", () => {
    // The whole point: our writer and their reader must agree bit for bit. A
    // packing that only round-trips through our own reader would paint
    // garbage on the map and nothing would fail.
    const art = ["#..#", ".##.", "#..#", "....", "####", "#..#"];
    const decoder = decoderFor(art, 0);

    expect(decoder.width).toBe(4);
    expect(decoder.height).toBe(6);
    expect(decoder.scale).toBe(0);

    for (let y = 0; y < art.length; y++) {
      for (let x = 0; x < art[y].length; x++) {
        // '#' is the secondary colour, so isPrimary must be false there.
        expect(decoder.isPrimary(x, y)).toBe(art[y][x] !== "#");
      }
    }
  });

  it("carries the scale through, which is what makes blocks chunky", () => {
    const art = ["#.", ".#"];
    const decoder = decoderFor(art, 2);

    expect(decoder.scale).toBe(2);
    // scale 2 means one pattern pixel covers a 4x4 block of map tiles.
    expect(decoder.scaledWidth()).toBe(8);
    expect(decoder.scaledHeight()).toBe(8);
    for (let d = 0; d < 4; d++) {
      expect(decoder.isPrimary(d, d)).toBe(false);
    }
  });

  it("tiles across the map rather than stopping at its own edge", () => {
    const art = ["#.", ".."];
    const decoder = decoderFor(art, 0);
    expect(decoder.isPrimary(0, 0)).toBe(false);
    // One full repeat away: same pixel.
    expect(decoder.isPrimary(2, 2)).toBe(false);
    expect(decoder.isPrimary(200, 200)).toBe(false);
  });

  it("rejects art it cannot encode instead of writing a corrupt header", () => {
    expect(() => packPattern(["#"], 0)).toThrow();
    expect(() => packPattern(["##", "#"], 0)).toThrow();
    expect(() => packPattern(["##", "##"], 8)).toThrow();
    expect(() => packPattern(["##", "##"], -1)).toThrow();
  });
});

describe("faction territory patterns", () => {
  it("gives every faction a pattern the decoder accepts", () => {
    for (const faction of ALL_FACTIONS) {
      const fp = factionPattern(faction);
      expect(fp.width).toBeGreaterThanOrEqual(2);
      expect(fp.height).toBeGreaterThanOrEqual(2);
      // The renderer copies these into a 1024-byte slot per player.
      expect(fp.bits.length).toBeLessThanOrEqual(1024);
      expect(fp.bits.length).toBe((fp.width * fp.height + 7) >> 3);
    }
  });

  it("makes the three visually distinct, not just differently named", () => {
    // Three patterns that happened to pack identically would look like one
    // faction on the map while every other test stayed green.
    const seen = ALL_FACTIONS.map((f) =>
      Array.from(factionPattern(f).bits).join(","),
    );
    expect(new Set(seen).size).toBe(ALL_FACTIONS.length);
  });

  it("keeps each pattern visible: neither blank nor solid", () => {
    // An all-primary pattern is invisible; an all-secondary one repaints the
    // whole territory and hides the player colour.
    for (const faction of ALL_FACTIONS) {
      const fp = factionPattern(faction);
      let set = 0;
      for (let i = 0; i < fp.width * fp.height; i++) {
        if (fp.bits[i >> 3] & (1 << (i & 7))) set++;
      }
      const total = fp.width * fp.height;
      expect(set).toBeGreaterThan(total * 0.1);
      expect(set).toBeLessThan(total * 0.9);
    }
  });

  it("defaults an unknown faction to Vanguard rather than crashing", () => {
    const rogue = factionPattern("NOT_A_FACTION" as Faction);
    expect(Array.from(rogue.bits)).toEqual(
      Array.from(factionPattern(Faction.Vanguard).bits),
    );
  });
});
