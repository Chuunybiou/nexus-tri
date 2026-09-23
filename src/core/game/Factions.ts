/**
 * The three asymmetric factions.
 *
 * This module is pure data: no imports, no game state, no randomness. It is the
 * single source of truth for what a faction *is*; how those traits are applied
 * lives in Config (economy/combat tunables) and in the individual Executions
 * (signature mechanics). Nothing here reads or mutates a Game.
 *
 * Modifiers are integers in per-mille (1000 = unchanged), never floats. The
 * simulation runs independently on every client, so a modifier has to produce
 * bit-identical results everywhere. Integer ratios do; a `* 1.15` literal is
 * fine in isolation but invites the rounding drift that desyncs clients once it
 * compounds over thousands of ticks.
 */

export enum Faction {
  /** "Terrans" — the baseline. Every modifier is neutral by design. */
  Vanguard = "VANGUARD",
  /** "Zorgs" — cheap, fast, numerous; individually weak. */
  Swarm = "SWARM",
  /** "Protossis" — expensive elite units backed by a heavy economy. */
  Ascendant = "ASCENDANT",
}

/** Neutral value for every per-mille modifier. */
export const PER_MILLE_BASE = 1000;

export interface FactionTraits {
  readonly id: Faction;
  /** i18n key for the display name. Never render `id` directly. */
  readonly nameKey: string;
  /** i18n key for the one-line description shown in the lobby picker. */
  readonly descriptionKey: string;
  /** Troop regeneration rate. */
  readonly troopGrowthPerMille: number;
  /** Gold income rate. */
  readonly goldRatePerMille: number;
  /** Damage dealt per attacking troop. */
  readonly attackPerMille: number;
  /** Build cost of every buildable unit. */
  readonly unitCostPerMille: number;
}

/**
 * Vanguard is the balance anchor: all four modifiers are 1000, so a Vanguard
 * player behaves exactly like a pre-faction player. That keeps the existing
 * balance tests meaningful and makes Vanguard the safe default everywhere a
 * faction is missing (replays, old wire messages, bots not yet assigned one).
 */
export const FACTIONS: Readonly<Record<Faction, FactionTraits>> = {
  [Faction.Vanguard]: {
    id: Faction.Vanguard,
    nameKey: "faction.vanguard_name",
    descriptionKey: "faction.vanguard_desc",
    troopGrowthPerMille: 1000,
    goldRatePerMille: 1000,
    attackPerMille: 1000,
    unitCostPerMille: 1000,
  },
  [Faction.Swarm]: {
    id: Faction.Swarm,
    nameKey: "faction.swarm_name",
    descriptionKey: "faction.swarm_desc",
    // Grows fastest and builds cheapest, and pays for it on income and on the
    // punch of any single attack: the Swarm wins by arriving first and often,
    // not by trading evenly.
    troopGrowthPerMille: 1250,
    goldRatePerMille: 900,
    attackPerMille: 900,
    unitCostPerMille: 750,
  },
  [Faction.Ascendant]: {
    id: Faction.Ascendant,
    nameKey: "faction.ascendant_name",
    descriptionKey: "faction.ascendant_desc",
    // The mirror image: slow to field, expensive to build, but every unit and
    // every attack lands harder, funded by the strongest economy.
    troopGrowthPerMille: 800,
    goldRatePerMille: 1100,
    attackPerMille: 1250,
    unitCostPerMille: 1400,
  },
};

/**
 * Swarm signature mechanic: breeding pressure.
 *
 * A Swarm army that sits still rots. Only the troops hoarded ABOVE a share of
 * the player's ceiling decay, so a Swarm player who keeps spending on attacks
 * never feels it — which is the whole point of the faction. Per-second, like
 * the other periodic drains in the sim.
 */
export const SWARM_DECAY = {
  /** Troops beyond this share of maxTroops are considered hoarded. */
  hoardThresholdPerMille: 600,
  /** Share of the hoarded excess lost each second. */
  decayPerMille: 40,
};

/**
 * The troop count past which a Swarm army starts rotting.
 *
 * Exported because the HUD has to draw the same line the rule enforces. Two
 * copies of this arithmetic would eventually disagree, and a warning that
 * lights up at the wrong moment is worse than no warning.
 */
export function swarmHoardThreshold(maxTroops: number): number {
  return scalePerMille(
    Math.floor(maxTroops),
    SWARM_DECAY.hoardThresholdPerMille,
  );
}

/**
 * Ascendant signature mechanics: regenerating shields, fed by a central grid.
 *
 * The two are deliberately coupled. Shields are what make Ascendant units worth
 * their cost, and they only regenerate while the grid is up, so cutting the
 * power is how you fight the faction. Cities are the grid nodes — an existing
 * structure rather than a new unit type, so the mechanic needs no new build
 * menu entry, wire field or sprite.
 */
export const ASCENDANT_GRID = {
  /** Share of the treasury lost each second while the grid is down. */
  unpoweredGoldDrainPerMille: 50,
  /** Share of max health a powered unit regains each second. */
  shieldRegenPerMille: 50,
  /** Ticks a unit must go undamaged before its shield starts recovering. */
  shieldDelayTicks: 30,
};

/** Used wherever a faction is absent: old replays, bots, unset lobby slots. */
export const DEFAULT_FACTION = Faction.Vanguard;

export const ALL_FACTIONS: readonly Faction[] = [
  Faction.Vanguard,
  Faction.Swarm,
  Faction.Ascendant,
];

/** Narrows untrusted input (wire messages, URL params, saved settings). */
export function isFaction(value: unknown): value is Faction {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(FACTIONS, value)
  );
}

/** Traits for a faction, falling back to the baseline when none is set. */
export function factionTraits(faction: Faction | null | undefined) {
  return FACTIONS[faction ?? DEFAULT_FACTION];
}

/**
 * Scales an integer by a per-mille modifier, rounding half away from zero.
 *
 * Exact — and therefore identical on every client — as long as
 * `value * perMille` stays within 2^53: the product is then an exact integer,
 * and IEEE-754 divide and round are specified operations with no platform
 * freedom. Past 2^53 the product is already rounded before the divide, and the
 * result can land one off the true value, so the guard below refuses rather
 * than letting two clients disagree. Troop counts and damage sit many orders of
 * magnitude below the limit; gold, which does not, uses scaleGoldPerMille.
 */
export function scalePerMille(value: number, perMille: number): number {
  if (!Number.isInteger(value)) {
    throw new Error(`scalePerMille expects an integer value, got ${value}`);
  }
  if (!Number.isInteger(perMille)) {
    throw new Error(
      `scalePerMille expects an integer perMille, got ${perMille}`,
    );
  }
  if (!Number.isSafeInteger(value * perMille)) {
    throw new Error(
      `scalePerMille overflows exact integer range: ${value} * ${perMille}`,
    );
  }
  const scaled = (value * perMille) / PER_MILLE_BASE;
  // Math.round breaks ties toward +Infinity, which would make -2.5 and 2.5
  // scale asymmetrically. Mirror the sign so a debuff behaves the same on both.
  return scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
}

/**
 * Scales an already-fractional quantity by a per-mille modifier.
 *
 * Some tunables are fractional before any faction touches them —
 * `troopIncreaseRate` builds on `pow(troops, 0.73) / 4`, `attackAmount` returns
 * `troops / 5` — so there is no integer to preserve and `scalePerMille` would
 * rightly reject them. This multiplies by the exact ratio instead. That is no
 * less deterministic than the `*= 0.95` difficulty modifiers already sitting in
 * those same functions: IEEE-754 multiply and divide are exactly specified, and
 * it is the transcendental functions (which is why DetMath exists) that vary
 * between platforms.
 *
 * Prefer scalePerMille whenever the quantity really is an integer — it catches
 * mistakes that this function cannot.
 */
export function applyPerMille(value: number, perMille: number): number {
  // The neutral rate must be a true no-op, and `(x * 1000) / 1000` is not: for
  // roughly 2% of doubles it lands one ulp away from x. Vanguard is 1000 across
  // the board, so without this short-circuit every Vanguard player would drift
  // off the pre-faction numbers a few ticks in — the exact regression the whole
  // per-mille scheme exists to prevent.
  if (perMille === PER_MILLE_BASE) {
    return value;
  }
  return (value * perMille) / PER_MILLE_BASE;
}

/** Gold is bigint, so it scales in exact integer arithmetic (truncating). */
export function scaleGoldPerMille(value: bigint, perMille: number): bigint {
  return (value * BigInt(perMille)) / BigInt(PER_MILLE_BASE);
}
