import { Faction } from "./Factions";

/**
 * Territory patterns, one per faction.
 *
 * The renderer already tiles a 1-bit bitmap over owned tiles to pick between a
 * player's primary and secondary colour (see PatternDecoder / TerritoryPass) —
 * it exists for purchased cosmetics. Giving each faction a default pattern
 * makes conquered ground readable at a glance without inventing a second
 * rendering path: it is the same texture the shader already samples.
 *
 * `#` is the secondary colour, `.` the primary. Written as art rather than hex
 * because these are pictures, and a hex blob cannot be reviewed or adjusted.
 *
 * The scale is a bit-shift: SCALE 1 means one pattern pixel covers a 2x2 block
 * of map tiles, which is what gives the chunky, built look rather than a fine
 * dither that disappears when zoomed out.
 */
const SCALE = 1;

/** Riveted steel plating: a hard grid, nothing organic. */
const VANGUARD_ART = [
  "########",
  "#...#...",
  "#...#...",
  "#...#...",
  "########",
  "#...#...",
  "#...#...",
  "#...#...",
];

/** Irregular clumps — a carpet of bodies rather than a built surface. */
const SWARM_ART = [
  "..##...#",
  ".####...",
  "..##..##",
  ".....###",
  "##....##",
  "###.....",
  ".##.##..",
  "....###.",
];

/** A crossing diagonal lattice: faceted, regular, clearly manufactured. */
const ASCENDANT_ART = [
  "#...#...",
  ".#.#.#.#",
  "..#...#.",
  ".#.#.#.#",
  "#...#...",
  ".#.#.#.#",
  "..#...#.",
  ".#.#.#.#",
];

/**
 * Packs pattern art into the wire byte layout PatternDecoder reads back:
 *
 *   byte0 : version (0)
 *   byte1 : bits 0-2 scale, bits 3-7 low five bits of (width - 2)
 *   byte2 : bits 0-1 high two bits of (width - 2), bits 2-7 (height - 2)
 *   rest  : one bit per pattern pixel, row-major, LSB first.
 *           A CLEAR bit is the primary colour (PatternDecoder.isPrimary).
 */
export function packPattern(art: readonly string[], scale: number): Uint8Array {
  const height = art.length;
  const width = art[0]?.length ?? 0;
  if (width < 2 || height < 2) {
    throw new Error(`Pattern must be at least 2x2, got ${width}x${height}`);
  }
  if (art.some((row) => row.length !== width)) {
    throw new Error("Pattern rows must all be the same width");
  }
  if (width > 129 || height > 65) {
    throw new Error(`Pattern ${width}x${height} exceeds the encodable range`);
  }
  if (scale < 0 || scale > 7) {
    throw new Error(`Pattern scale must fit in three bits, got ${scale}`);
  }

  const w = width - 2;
  const h = height - 2;
  const bytes = new Uint8Array(3 + ((width * height + 7) >> 3));
  bytes[0] = 0;
  bytes[1] = (scale & 0x07) | ((w & 0x1f) << 3);
  bytes[2] = ((w >> 5) & 0x03) | ((h & 0x3f) << 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (art[y][x] !== "#") continue; // clear bit = primary colour
      const idx = y * width + x;
      bytes[3 + (idx >> 3)] |= 1 << (idx & 7);
    }
  }
  return bytes;
}

export interface FactionPattern {
  width: number;
  height: number;
  scale: number;
  /** Pixel bits only — the 3 header bytes are already consumed. */
  bits: Uint8Array;
}

/**
 * The pattern a faction paints its territory with.
 *
 * Returns the decoded shape the renderer wants, so callers never re-parse the
 * header they just wrote.
 */
export function factionPattern(faction: Faction): FactionPattern {
  return CACHE[factionArtKey(faction)];
}

/**
 * Routed through a switch with a default rather than indexing a record by the
 * raw value: this is fed by PlayerView.faction(), which can carry whatever an
 * old replay or a future build put on the wire. An unrecognised faction should
 * paint the baseline, not throw inside the render loop and take the frame with
 * it.
 */
function factionArtKey(faction: Faction): Faction {
  switch (faction) {
    case Faction.Swarm:
      return Faction.Swarm;
    case Faction.Ascendant:
      return Faction.Ascendant;
    default:
      return Faction.Vanguard;
  }
}

function build(art: readonly string[]): FactionPattern {
  return {
    width: art[0].length,
    height: art.length,
    scale: SCALE,
    bits: packPattern(art, SCALE).slice(3),
  };
}

// Packed once at module load: syncPlayer runs per player per frame.
const CACHE: Readonly<Record<Faction, FactionPattern>> = {
  [Faction.Vanguard]: build(VANGUARD_ART),
  [Faction.Swarm]: build(SWARM_ART),
  [Faction.Ascendant]: build(ASCENDANT_ART),
};
