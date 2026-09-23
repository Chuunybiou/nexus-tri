import {
  AscendantGridExecution,
  ascendantGridPowered,
} from "../src/core/execution/AscendantGridExecution";
import { AscendantShieldExecution } from "../src/core/execution/AscendantShieldExecution";
import { SwarmDecayExecution } from "../src/core/execution/SwarmDecayExecution";
import {
  ASCENDANT_GRID,
  Faction,
  SWARM_DECAY,
  scalePerMille,
} from "../src/core/game/Factions";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";

/** Enough territory for maxTroops() to be meaningful, small enough to be cheap. */
const TILES_PER_PLAYER = 40;

/** First tile a player owns. tiles() is a ReadonlyTileSet, not an array. */
function ownedTile(player: Player): number {
  const tile = player.tiles().values().next().value;
  if (tile === undefined) throw new Error("player owns no tiles");
  return tile;
}

/** Unowned land tiles, handed out so each player gets its own territory. */
function* landTiles(game: Game): Generator<number> {
  for (let y = 0; y < game.height(); y++) {
    for (let x = 0; x < game.width(); x++) {
      const tile = game.ref(x, y);
      if (game.isLand(tile) && !game.hasOwner(tile)) yield tile;
    }
  }
}

/**
 * Adds a player AND gives them territory.
 *
 * The territory is not decoration: every one of these executions iterates
 * `game.players()`, which returns only players that are alive, and `isAlive()`
 * is "owns at least one tile". A landless player is invisible to all three
 * mechanics, so every test would no-op and pass for the wrong reason. The
 * assertions at the end of this helper exist to make that failure loud.
 */
function addPlayer(
  game: Game,
  tiles: Generator<number>,
  faction: Faction,
  id: string = faction,
): Player {
  const info = new PlayerInfo(
    id,
    PlayerType.Human,
    null,
    id,
    false,
    null,
    [],
    null,
    null,
    faction,
  );
  game.addPlayer(info);
  const player = game.player(id);
  // Conquering directly rather than going through SpawnExecution: the spawn
  // path needs a center with a clear radius around it and silently declines
  // otherwise, which is fragile scaffolding for tests that are not about
  // spawning. Real tiles are all these mechanics read.
  for (let i = 0; i < TILES_PER_PLAYER; i++) {
    const tile = tiles.next().value;
    if (tile === undefined) throw new Error("ran out of land tiles");
    player.conquer(tile);
  }

  // Guard the guard: if this ever stops holding, the tests below stop testing
  // anything and would otherwise still pass.
  expect(player.isAlive()).toBe(true);
  expect(game.players().map((p) => p.id())).toContain(id);
  return player;
}

/** Run an execution for `seconds`, feeding it the per-second ticks it wants. */
function run(
  exec: { init: (g: Game, t: number) => void; tick: (t: number) => void },
  game: Game,
  seconds: number,
  startTick = 10,
) {
  exec.init(game, startTick);
  for (let s = 0; s < seconds; s++) {
    exec.tick(startTick + s * 10);
  }
}

function hoardThreshold(game: Game, player: Player): number {
  return scalePerMille(
    Math.floor(game.config().maxTroops(player)),
    SWARM_DECAY.hoardThresholdPerMille,
  );
}

describe("Swarm breeding pressure", () => {
  let game: Game;
  let tiles: Generator<number>;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
    tiles = landTiles(game);
  });

  test("leaves a Swarm player below the hoard threshold alone", () => {
    const swarm = addPlayer(game, tiles, Faction.Swarm);
    const threshold = hoardThreshold(game, swarm);
    swarm.setTroops(threshold);

    run(new SwarmDecayExecution(), game, 10);

    expect(swarm.troops()).toBe(threshold);
  });

  test("rots only the excess above the threshold", () => {
    const swarm = addPlayer(game, tiles, Faction.Swarm);
    const threshold = hoardThreshold(game, swarm);
    const excess = 100_000;
    swarm.setTroops(threshold + excess);

    run(new SwarmDecayExecution(), game, 1);

    const expected =
      threshold + excess - scalePerMille(excess, SWARM_DECAY.decayPerMille);
    expect(swarm.troops()).toBe(expected);
  });

  test("never drives a hoarder below the threshold, however long it runs", () => {
    // The decay asymptotes. Losing a game to arithmetic you cannot fight back
    // against is not a mechanic.
    const swarm = addPlayer(game, tiles, Faction.Swarm);
    const threshold = hoardThreshold(game, swarm);
    swarm.setTroops(threshold + 500_000);

    run(new SwarmDecayExecution(), game, 600); // ten minutes of hoarding

    expect(swarm.troops()).toBeGreaterThanOrEqual(threshold);
  });

  test("does not touch the other two factions", () => {
    const players = [
      addPlayer(game, tiles, Faction.Vanguard),
      addPlayer(game, tiles, Faction.Ascendant),
    ];
    const hoard = Math.floor(game.config().maxTroops(players[0]));
    for (const p of players) p.setTroops(hoard);

    run(new SwarmDecayExecution(), game, 30);

    for (const p of players) expect(p.troops()).toBe(hoard);
  });

  test("idles on ticks that are not the once-per-second beat", () => {
    const swarm = addPlayer(game, tiles, Faction.Swarm);
    swarm.setTroops(Math.floor(game.config().maxTroops(swarm)));
    const before = swarm.troops();

    const exec = new SwarmDecayExecution();
    exec.init(game, 11);
    for (const tick of [11, 12, 13, 14, 15]) exec.tick(tick);

    expect(swarm.troops()).toBe(before);
  });
});

describe("Ascendant energy grid", () => {
  let game: Game;
  let tiles: Generator<number>;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
    tiles = landTiles(game);
  });

  test("reads as unpowered with no city, powered with one", () => {
    const ascendant = addPlayer(game, tiles, Faction.Ascendant);
    expect(ascendantGridPowered(ascendant)).toBe(false);

    ascendant.buildUnit(UnitType.City, ownedTile(ascendant), {});
    expect(ascendantGridPowered(ascendant)).toBe(true);
  });

  test("bleeds the treasury while the grid is down", () => {
    const ascendant = addPlayer(game, tiles, Faction.Ascendant);
    ascendant.addGold(1_000_000n);
    const before = ascendant.gold();

    run(new AscendantGridExecution(), game, 1);

    const expected =
      before -
      (before * BigInt(ASCENDANT_GRID.unpoweredGoldDrainPerMille)) / 1000n;
    expect(ascendant.gold()).toBe(expected);
  });

  test("stops bleeding once a city is standing", () => {
    const ascendant = addPlayer(game, tiles, Faction.Ascendant);
    ascendant.addGold(1_000_000n);
    ascendant.buildUnit(UnitType.City, ownedTile(ascendant), {});
    const before = ascendant.gold();

    run(new AscendantGridExecution(), game, 10);

    expect(ascendant.gold()).toBe(before);
  });

  test("does not touch the other two factions", () => {
    const players = [
      addPlayer(game, tiles, Faction.Vanguard),
      addPlayer(game, tiles, Faction.Swarm),
    ];
    for (const p of players) p.addGold(1_000_000n);
    const before = players.map((p) => p.gold());

    run(new AscendantGridExecution(), game, 10);

    players.forEach((p, i) => expect(p.gold()).toBe(before[i]));
  });
});

describe("Ascendant shields", () => {
  let game: Game;
  let tiles: Generator<number>;
  let ascendant: Player;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
    tiles = landTiles(game);
    ascendant = addPlayer(game, tiles, Faction.Ascendant);
    ascendant.buildUnit(UnitType.City, ownedTile(ascendant), {});
  });

  function warship() {
    return ascendant.buildUnit(UnitType.Warship, ownedTile(ascendant), {
      patrolTile: ownedTile(ascendant),
    });
  }

  function runShields(exec: AscendantShieldExecution, throughTick: number) {
    exec.init(game, 0);
    for (let t = 0; t <= throughTick; t++) exec.tick(t);
  }

  test("regenerates a damaged unit once the delay has elapsed", () => {
    const unit = warship();
    const max = Math.floor(unit.maxHealth());
    unit.modifyHealth(-Math.floor(max / 2));
    const damaged = Math.floor(unit.health());

    runShields(
      new AscendantShieldExecution(),
      ASCENDANT_GRID.shieldDelayTicks + 50,
    );

    expect(unit.health()).toBeGreaterThan(damaged);
  });

  test("waits out the delay before healing anything", () => {
    const unit = warship();
    unit.modifyHealth(-Math.floor(unit.maxHealth() / 2));
    const damaged = Math.floor(unit.health());

    const exec = new AscendantShieldExecution();
    exec.init(game, 0);
    for (let t = 0; t < ASCENDANT_GRID.shieldDelayTicks; t++) exec.tick(t);

    expect(Math.floor(unit.health())).toBe(damaged);
  });

  test("never exceeds max health", () => {
    const unit = warship();
    const max = Math.floor(unit.maxHealth());
    unit.modifyHealth(-1);

    runShields(
      new AscendantShieldExecution(),
      ASCENDANT_GRID.shieldDelayTicks + 500,
    );

    expect(Math.floor(unit.health())).toBe(max);
  });

  test("stays dark while the grid is down", () => {
    // Cutting the power is how an opponent takes the shields away.
    const noCity = addPlayer(game, tiles, Faction.Ascendant, "unpowered");
    const unit = noCity.buildUnit(UnitType.Warship, ownedTile(noCity), {
      patrolTile: ownedTile(noCity),
    });
    unit.modifyHealth(-Math.floor(unit.maxHealth() / 2));
    const damaged = Math.floor(unit.health());

    runShields(
      new AscendantShieldExecution(),
      ASCENDANT_GRID.shieldDelayTicks + 200,
    );

    expect(Math.floor(unit.health())).toBe(damaged);
  });

  test("leaves units of the other factions alone", () => {
    const vanguard = addPlayer(game, tiles, Faction.Vanguard);
    const unit = vanguard.buildUnit(UnitType.Warship, ownedTile(vanguard), {
      patrolTile: ownedTile(vanguard),
    });
    unit.modifyHealth(-Math.floor(unit.maxHealth() / 2));
    const damaged = Math.floor(unit.health());

    runShields(
      new AscendantShieldExecution(),
      ASCENDANT_GRID.shieldDelayTicks + 200,
    );

    expect(Math.floor(unit.health())).toBe(damaged);
  });

  test("resets the timer when a unit is damaged again", () => {
    // Shields reward disengaging; they never help a unit under fire.
    const unit = warship();
    unit.modifyHealth(-Math.floor(unit.maxHealth() / 2));

    const exec = new AscendantShieldExecution();
    exec.init(game, 0);
    for (let t = 0; t <= ASCENDANT_GRID.shieldDelayTicks * 3; t++) {
      // Chip it every second: the delay never elapses.
      if (t % 10 === 0) unit.modifyHealth(-1);
      exec.tick(t);
      if (t % 10 === 0) {
        // Any regen would have to show up right after the per-second beat.
        expect(Math.floor(unit.health())).toBeLessThan(
          Math.floor(unit.maxHealth()),
        );
      }
    }
  });
});
