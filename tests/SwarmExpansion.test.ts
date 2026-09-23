import { SwarmExpansionExecution } from "../src/core/execution/SwarmExpansionExecution";
import { Faction } from "../src/core/game/Factions";
import { Game, Player, PlayerInfo, PlayerType } from "../src/core/game/Game";
import { setup } from "./util/Setup";

function joueur(game: Game, id: string, faction: Faction): Player {
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
  return game.player(id);
}

/** Une case de terre libre, pour poser un joueur. */
function terreLibre(game: Game, depuis = 0): number {
  let vus = 0;
  for (let y = 0; y < game.height(); y++) {
    for (let x = 0; x < game.width(); x++) {
      const t = game.ref(x, y);
      if (game.isLand(t) && !game.isImpassable(t) && !game.hasOwner(t)) {
        if (vus++ >= depuis) return t;
      }
    }
  }
  throw new Error("aucune terre libre");
}

function seconde(exec: SwarmExpansionExecution, game: Game, n = 1) {
  exec.init(game, 10);
  for (let i = 0; i < n; i++) exec.tick(10 + i * 10);
}

describe("le Swarm rampe sur la terre libre", () => {
  let game: Game;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
  });

  test("il gagne des cases sans rien faire", () => {
    const swarm = joueur(game, "nuee", Faction.Swarm);
    swarm.conquer(terreLibre(game));
    swarm.addTroops(500);
    const avant = swarm.numTilesOwned();

    seconde(new SwarmExpansionExecution(), game, 3);
    expect(swarm.numTilesOwned()).toBeGreaterThan(avant);
  });

  test("les deux autres factions ne rampent pas", () => {
    const vanguard = joueur(game, "acier", Faction.Vanguard);
    vanguard.conquer(terreLibre(game, 50));
    vanguard.addTroops(500);
    const avant = vanguard.numTilesOwned();

    seconde(new SwarmExpansionExecution(), game, 3);
    expect(vanguard.numTilesOwned()).toBe(avant);
  });

  test("elle ne mord jamais le territoire d'un autre", () => {
    const swarm = joueur(game, "nuee2", Faction.Swarm);
    const voisin = joueur(game, "voisin", Faction.Vanguard);
    swarm.conquer(terreLibre(game));
    swarm.addTroops(500);
    // Le voisin prend les cases juste a cote.
    const aCote = game
      .neighbors(terreLibre(game))
      .filter((t) => game.isLand(t) && !game.hasOwner(t));
    for (const t of aCote) voisin.conquer(t);
    const aVoisin = voisin.numTilesOwned();

    seconde(new SwarmExpansionExecution(), game, 5);
    expect(voisin.numTilesOwned()).toBe(aVoisin);
  });

  test("sans troupes, elle n'avance plus", () => {
    const swarm = joueur(game, "nuee3", Faction.Swarm);
    swarm.conquer(terreLibre(game, 120));
    // Un joueur nait avec des troupes : on les lui retire pour de bon.
    swarm.removeTroops(swarm.troops());
    const avant = swarm.numTilesOwned();

    seconde(new SwarmExpansionExecution(), game, 3);
    expect(swarm.numTilesOwned()).toBe(avant);
  });

  test("l'avancee est plafonnee : pas d'engloutissement", () => {
    const swarm = joueur(game, "nuee4", Faction.Swarm);
    swarm.conquer(terreLibre(game));
    swarm.addTroops(5000);
    const avant = swarm.numTilesOwned();

    seconde(new SwarmExpansionExecution(), game, 1);
    // Trois cases par seconde au maximum.
    expect(swarm.numTilesOwned() - avant).toBeLessThanOrEqual(3);
  });
});
