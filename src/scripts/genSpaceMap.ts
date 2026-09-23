/**
 * Generates the source image for the space map.
 *
 * The Go map-generator reads a PNG and turns pixels into terrain using ONLY the
 * blue channel (map-generator/README.md):
 *
 *   blue === 106        -> water
 *   blue 140..200       -> land, magnitude (blue - 140) / 2
 *   r === g === b === 0 -> impassable terrain
 *
 * So "space" is not one colour, it is three roles:
 *   asteroids / platforms -> land, the only thing anyone can own
 *   open space            -> water, crossed by transport ships
 *   debris fields, void   -> impassable, hard walls that also make the map
 *                            non-rectangular
 *
 * A map that was all black would be unplayable: nothing can enter impassable
 * terrain, so there would be nowhere to go. The topology here is an archipelago,
 * which is what the engine already handles well.
 *
 * Deterministic: a fixed seed and integer-free geometry mean re-running this
 * reproduces the same image byte for byte, so the map can be tweaked and
 * regenerated rather than hand-edited and lost.
 *
 *   npx tsx src/scripts/genSpaceMap.ts
 *   npm run gen-maps            (needs Go — turns the PNG into map.bin)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIDTH = 2000;
const HEIGHT = 1400;
const SEED = 0x5ea9c0de;
/**
 * How much field a pixel needs to be rock. Raising it shrinks every mass and
 * pulls fused blobs apart, which is the dial for "belt" versus "continent".
 */
const LAND_THRESHOLD = 0.34;

/** Blue-channel values the Go generator recognises. */
const WATER_BLUE = 106;
const LAND_MIN_BLUE = 142; // just inside the land floor
const LAND_MAX_BLUE = 196; // mountain, short of the 200 clamp

/** Deterministic PRNG: same map every run, no platform-dependent Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Blob {
  x: number;
  y: number;
  r: number;
}

/**
 * Asteroid masses, placed once and repeated by 180-degree rotation.
 *
 * Point symmetry rather than mirroring: a mirrored map reads as an inkblot,
 * which no belt looks like. Rotation still gives both halves identical mass —
 * what fairness actually needs — while the shapes stay irregular.
 */
function buildBlobs(rand: () => number): Blob[] {
  const blobs: Blob[] = [];
  /**
   * One asteroid = a cluster of overlapping lobes, not a circle.
   *
   * A single metaball always renders as a disc, and a field of discs reads as
   * bubbles. Three to six offset lobes fuse into a lumpy mass with concave
   * edges, which is what actually looks like rock.
   */
  const push = (x: number, y: number, r: number) => {
    const lobes = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < lobes; i++) {
      // First lobe centred, the rest pushed out to break the silhouette.
      const spread = i === 0 ? 0 : r * (0.35 + rand() * 0.5);
      const angle = rand() * Math.PI * 2;
      const dx = Math.cos(angle) * spread;
      const dy = Math.sin(angle) * spread;
      const lr = r * (i === 0 ? 1 : 0.5 + rand() * 0.45);
      blobs.push({ x: x + dx, y: y + dy, r: lr });
      blobs.push({ x: WIDTH - (x + dx), y: HEIGHT - (y + dy), r: lr });
    }
  };

  // Two anchors per half: places worth holding, comfortably above the
  // generator's small-island removal threshold.
  push(360, 300, 170);
  push(300, 980, 155);
  push(700, 640, 120);

  // The belt itself: many small rocks along a diagonal band, which is what
  // makes the map read as a belt rather than as two continents.
  for (let i = 0; i < 46; i++) {
    const t = rand();
    // Band running lower-left to upper-right, with scatter across its width.
    const bx = 150 + t * (WIDTH - 300);
    const by = HEIGHT * 0.86 - t * HEIGHT * 0.72 + (rand() - 0.5) * 330;
    if (by < 90 || by > HEIGHT - 90) continue;
    // Only seed the first half; push() rotates each one into the other.
    if (bx > WIDTH / 2) continue;
    push(bx, by, 44 + rand() * 46);
  }

  // A few isolated outliers, so the belt has stepping stones off its spine.
  for (let i = 0; i < 6; i++) {
    push(
      200 + rand() * (WIDTH / 2 - 260),
      120 + rand() * (HEIGHT - 240),
      38 + rand() * 30,
    );
  }
  return blobs;
}

/**
 * Metaball field: overlapping blobs fuse into one irregular mass instead of
 * reading as a row of circles.
 *
 * The kernel has COMPACT SUPPORT — it reaches exactly zero at the blob radius.
 * An inverse-square kernel does not, so clipping it at a bounding box leaves a
 * step in the field, and that step shows up in the finished map as dead
 * straight edges where no straight edge was drawn.
 */
function buildField(blobs: Blob[]): Float32Array {
  const field = new Float32Array(WIDTH * HEIGHT);
  for (const b of blobs) {
    const reach = Math.ceil(b.r);
    const x0 = Math.max(0, Math.floor(b.x - reach));
    const x1 = Math.min(WIDTH - 1, Math.ceil(b.x + reach));
    const y0 = Math.max(0, Math.floor(b.y - reach));
    const y1 = Math.min(HEIGHT - 1, Math.ceil(b.y + reach));
    const rr = b.r * b.r;
    for (let y = y0; y <= y1; y++) {
      const dy = y - b.y;
      const row = y * WIDTH;
      for (let x = x0; x <= x1; x++) {
        const dx = x - b.x;
        const q = 1 - (dx * dx + dy * dy) / rr;
        if (q <= 0) continue; // exactly zero past the radius: no step, no seam
        field[row + x] += q * q * q;
      }
    }
  }
  return field;
}

/** Void that eats the corners, so the map is not a rectangle of open space. */
function isVoid(x: number, y: number, rand: () => number): boolean {
  const nx = (x / WIDTH) * 2 - 1;
  const ny = (y / HEIGHT) * 2 - 1;
  // Elliptical falloff: 1 at the centre, 0 at the corners.
  const d = Math.sqrt(nx * nx * 0.85 + ny * ny);
  // A soft, dithered edge rather than a drawn oval — the boundary should look
  // like thinning debris, not a cut.
  return d > 0.92 + rand() * 0.16;
}

function main(): void {
  const rand = mulberry32(SEED);
  const blobs = buildBlobs(rand);
  const field = buildField(blobs);
  const edgeRand = mulberry32(SEED ^ 0x9e3779b9);

  // RGB, no alpha: the generator only reads blue, plus the all-zero test.
  const rgb = new Uint8Array(WIDTH * HEIGHT * 3);
  let land = 0;
  let water = 0;
  let voidTiles = 0;

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = y * WIDTH + x;
      const o = i * 3;
      const f = field[i];

      if (f > LAND_THRESHOLD) {
        // Higher field = deeper inside the mass = rockier, so an asteroid has
        // a raised core rather than being a flat plate.
        //
        // Squared and spread over a wide range on purpose: a linear ramp
        // saturated almost immediately and left 72% of the rock as MOUNTAIN,
        // which would have played unlike any other map in the game. Most land
        // should be plains, with peaks only at the very centre of a mass.
        const ramp = Math.min(1, (f - LAND_THRESHOLD) / 2.4);
        const t = ramp * ramp;
        const blue = Math.round(
          LAND_MIN_BLUE + t * (LAND_MAX_BLUE - LAND_MIN_BLUE),
        );
        rgb[o] = 40;
        rgb[o + 1] = 40;
        rgb[o + 2] = blue;
        land++;
      } else if (isVoid(x, y, edgeRand)) {
        rgb[o] = 0;
        rgb[o + 1] = 0;
        rgb[o + 2] = 0;
        voidTiles++;
      } else {
        // Water must not be all-zero, or it would read as impassable.
        rgb[o] = 0;
        rgb[o + 1] = 0;
        rgb[o + 2] = WATER_BLUE;
        water++;
      }
    }
  }

  const outDir = join(
    __dirname,
    "..",
    "..",
    "map-generator",
    "assets",
    "maps",
    "anvilbelt",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "image.png"), encodePng(rgb, WIDTH, HEIGHT));

  const total = WIDTH * HEIGHT;
  const pct = (n: number) => ((100 * n) / total).toFixed(1);
  console.log(`wrote ${join(outDir, "image.png")}  ${WIDTH}x${HEIGHT}`);
  console.log(
    `land ${land} (${pct(land)}%)  open space ${water} (${pct(water)}%)  void ${voidTiles} (${pct(voidTiles)}%)`,
  );
}

/** Minimal PNG writer: signature, IHDR, one IDAT, IEND. */
function encodePng(rgb: Uint8Array, width: number, height: number): Buffer {
  const stride = width * 3;
  // Each scanline is prefixed with its filter type; 0 means "no filter", which
  // keeps this writer trivial and costs only a little compression.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

main();
