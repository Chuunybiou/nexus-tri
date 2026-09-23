import {
  CoeurExecution,
  gardiensDuCoeur,
  tileDuCoeur,
} from "../src/core/execution/CoeurExecution";
import { Faction } from "../src/core/game/Factions";
import { Game, Player, PlayerInfo, PlayerType } from "../src/core/game/Game";
import { Resource } from "../src/core/game/Resources";
import { setup } from "./util/Setup";

/**
 * Le Cœur doit exister sur TOUTES les cartes : c'est la promesse faite: une
 * position codee en dur ne marcherait que sur une carte ronde.
 */
describe("le Cœur de la carte", () => {
  let game: Game;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
  });

  test("le centre tombe sur de la terre praticable", () => {
    const centre = tileDuCoeur(game);
    expect(centre).not.toBeNull();
    expect(game.isLand(centre!)).toBe(true);
    expect(game.isImpassable(centre!)).toBe(false);
  });

  test("le meme centre est trouve a chaque fois (deux clients doivent s'accorder)", () => {
    expect(tileDuCoeur(game)).toBe(tileDuCoeur(game));
  });

  test("des gardiens sont poses autour du centre", () => {
    const spawns = gardiensDuCoeur(game, "partie-test");
    expect(spawns.length).toBeGreaterThan(0);
    // Chacun a sa tuile, et aucun ne se pose sur le centre lui-meme.
    const centre = tileDuCoeur(game);
    for (const s of spawns) {
      expect(s.tile).toBeDefined();
      expect(s.tile).not.toBe(centre);
    }
  });

  test("tenir le centre rapporte les DEUX ressources qu'on ne produit pas", () => {
    const info = new PlayerInfo(
      "tenant",
      PlayerType.Human,
      null,
      "tenant",
      false,
      null,
      [],
      null,
      null,
      Faction.Swarm,
    );
    game.addPlayer(info);
    const joueur: Player = game.player("tenant");
    const centre = tileDuCoeur(game)!;
    joueur.conquer(centre);

    const exec = new CoeurExecution();
    exec.init(game, 10);
    exec.tick(10);

    // Le Swarm produit la biomasse : le Cœur donne les deux autres.
    expect(joueur.resource(Resource.Biomass)).toBe(0);
    expect(joueur.resource(Resource.Uranium)).toBeGreaterThan(0);
    expect(joueur.resource(Resource.Crystal)).toBeGreaterThan(0);
  });

  test("rien ne tombe entre deux secondes", () => {
    const info = new PlayerInfo(
      "tenant2",
      PlayerType.Human,
      null,
      "tenant2",
      false,
      null,
      [],
      null,
      null,
      Faction.Vanguard,
    );
    game.addPlayer(info);
    const joueur: Player = game.player("tenant2");
    joueur.conquer(tileDuCoeur(game)!);

    const exec = new CoeurExecution();
    exec.init(game, 10);
    for (let t = 11; t < 20; t++) exec.tick(t);
    expect(joueur.resource(Resource.Biomass)).toBe(0);
    exec.tick(20);
    expect(joueur.resource(Resource.Biomass)).toBeGreaterThan(0);
  });
});
