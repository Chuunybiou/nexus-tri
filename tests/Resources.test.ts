import { ResourceProductionExecution } from "../src/core/execution/ResourceProductionExecution";
import { Faction } from "../src/core/game/Factions";
import { Game, Player, PlayerInfo, PlayerType } from "../src/core/game/Game";
import {
  RESOURCE_RULES,
  Resource,
  canBuildUltimateWeapon,
  emptyStock,
  resourceOf,
  resourcesAtThreshold,
} from "../src/core/game/Resources";
import { setup } from "./util/Setup";

const TILES_PER_PLAYER = 40;

function* landTiles(game: Game): Generator<number> {
  for (let y = 0; y < game.height(); y++) {
    for (let x = 0; x < game.width(); x++) {
      const tile = game.ref(x, y);
      if (game.isLand(tile) && !game.hasOwner(tile)) yield tile;
    }
  }
}

/** Un joueur AVEC du territoire : players() ne renvoie que les vivants. */
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
  for (let i = 0; i < TILES_PER_PLAYER; i++) {
    const tile = tiles.next().value;
    if (tile === undefined) throw new Error("ran out of land tiles");
    player.conquer(tile);
  }
  expect(player.isAlive()).toBe(true);
  return player;
}

function run(exec: ResourceProductionExecution, game: Game, seconds: number) {
  exec.init(game, 10);
  for (let s = 0; s < seconds; s++) exec.tick(10 + s * 10);
}

describe("ressources de faction", () => {
  test("chaque faction a sa propre ressource", () => {
    expect(resourceOf(Faction.Vanguard)).toBe(Resource.Uranium);
    expect(resourceOf(Faction.Swarm)).toBe(Resource.Biomass);
    expect(resourceOf(Faction.Ascendant)).toBe(Resource.Crystal);
    // Trois factions, trois ressources : aucune n'est partagee.
    expect(new Set(Object.values(Resource)).size).toBe(3);
  });

  test("l'arme exige les trois ressources, pas deux", () => {
    const stock = emptyStock();
    stock[Resource.Uranium] = RESOURCE_RULES.weaponThreshold;
    stock[Resource.Biomass] = RESOURCE_RULES.weaponThreshold;
    expect(resourcesAtThreshold(stock)).toBe(2);
    expect(canBuildUltimateWeapon(stock)).toBe(false);

    stock[Resource.Crystal] = RESOURCE_RULES.weaponThreshold;
    expect(resourcesAtThreshold(stock)).toBe(3);
    expect(canBuildUltimateWeapon(stock)).toBe(true);
  });
});

describe("production", () => {
  let game: Game;
  let tiles: Generator<number>;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
    tiles = landTiles(game);
  });

  test("un joueur ne produit que la ressource de sa faction", () => {
    const swarm = addPlayer(game, tiles, Faction.Swarm);
    run(new ResourceProductionExecution(), game, 5);

    expect(swarm.resource(Resource.Biomass)).toBe(
      5 * RESOURCE_RULES.basePerSecond,
    );
    // Les deux autres ne s'obtiennent que par le commerce : c'est tout le
    // point du systeme.
    expect(swarm.resource(Resource.Uranium)).toBe(0);
    expect(swarm.resource(Resource.Crystal)).toBe(0);
  });

  test("le stock ne depasse jamais le plafond", () => {
    const vanguard = addPlayer(game, tiles, Faction.Vanguard);
    const entre = vanguard.addResource(Resource.Uranium, 10_000);
    expect(vanguard.resource(Resource.Uranium)).toBe(RESOURCE_RULES.cap);
    // addResource renvoie ce qui est REELLEMENT entre : le commerce s'en sert
    // pour ne pas facturer une livraison qui n'entre plus.
    expect(entre).toBe(RESOURCE_RULES.cap);
    expect(vanguard.addResource(Resource.Uranium, 50)).toBe(0);
  });

  test("la production ne tombe qu'une fois par seconde", () => {
    const asc = addPlayer(game, tiles, Faction.Ascendant);
    const exec = new ResourceProductionExecution();
    exec.init(game, 10);
    // Neuf ticks intermediaires : rien ne doit tomber.
    for (let t = 11; t < 20; t++) exec.tick(t);
    expect(asc.resource(Resource.Crystal)).toBe(0);
    exec.tick(20);
    expect(asc.resource(Resource.Crystal)).toBe(RESOURCE_RULES.basePerSecond);
  });
});
