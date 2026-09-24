import path from "path";
import { fileURLToPath } from "url";
import { ID_DU_COEUR, tileDuCoeur } from "../src/core/execution/CoeurExecution";
import { Faction } from "../src/core/game/Factions";
import {
  Difficulty,
  Game,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerType,
} from "../src/core/game/Game";
import { createGameRunner } from "../src/core/GameRunner";
import { GameStartInfo } from "../src/core/Schemas";
import { NodeGameMapLoader } from "./perf/fullgame/NodeGameMapLoader";
import { setup } from "./util/Setup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loader = new NodeGameMapLoader(path.join(__dirname, "../resources/maps"));

function partie(carte: GameMapType): GameStartInfo {
  return {
    gameID: "coeur",
    lobbyCreatedAt: Date.now(),
    config: {
      gameMap: carte,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Public,
      difficulty: Difficulty.Medium,
      nations: "default",
      donateGold: true,
      donateTroops: true,
      bots: 5,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: true,
    },
    players: [
      {
        clientID: "j1",
        username: "Joueur",
        clanTag: null,
        faction: Faction.Vanguard,
      },
    ],
  } as GameStartInfo;
}

/**
 * Recalcule, a la main, la terre qui tombe dans le cercle du Cœur : un cercle
 * dont l'aire vaut 20 % de la carte, centre sur la terre la plus centrale.
 * Le test compare ce compte a ce que la partie a reellement donne au Cœur.
 */
function terreDansLeCercle(mg: Game): number {
  const centre = tileDuCoeur(mg);
  if (centre === null) return 0;
  const cx = mg.x(centre);
  const cy = mg.y(centre);
  const rayon = Math.round(
    Math.sqrt((mg.width() * mg.height() * 0.2) / Math.PI),
  );
  let n = 0;
  for (
    let y = Math.max(0, cy - rayon);
    y <= Math.min(mg.height() - 1, cy + rayon);
    y++
  ) {
    for (
      let x = Math.max(0, cx - rayon);
      x <= Math.min(mg.width() - 1, cx + rayon);
      x++
    ) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > rayon * rayon) continue;
      const t = mg.ref(x, y);
      if (mg.isLand(t) && !mg.isImpassable(t)) n++;
    }
  }
  return n;
}

describe("le centre de la carte", () => {
  test("il tombe sur de la terre praticable", async () => {
    const game = await setup("ocean_and_land");
    const centre = tileDuCoeur(game);
    expect(centre).not.toBeNull();
    expect(game.isLand(centre!)).toBe(true);
    expect(game.isImpassable(centre!)).toBe(false);
  });

  test("le meme centre a chaque fois (deux clients doivent s'accorder)", async () => {
    const game = await setup("ocean_and_land");
    expect(tileDuCoeur(game)).toBe(tileDuCoeur(game));
  });
});

describe("la zone du Cœur, dans une vraie partie", () => {
  test("elle existe des le depart et couvre 20 % de la carte", async () => {
    const runner = await createGameRunner(
      partie("Europe" as GameMapType),
      "j1",
      loader,
      () => {},
    );
    // Deux tours de boucle : le premier initialise l'execution, le second
    // pose la zone — bien avant que quiconque ait joue.
    runner.game.executeNextTick();
    runner.game.executeNextTick();

    expect(runner.game.hasPlayer(ID_DU_COEUR)).toBe(true);
    const coeur = runner.game.player(ID_DU_COEUR);
    expect(coeur.type()).toBe(PlayerType.Bot);

    // Exactement la terre du cercle : pas une case de plus, pas une de
    // moins. C'est la promesse faite, « 20 % de la carte ».
    expect(coeur.numTilesOwned()).toBe(terreDansLeCercle(runner.game));
    expect(coeur.numTilesOwned()).toBeGreaterThan(1000);
  }, 300_000);

  test("elle ne bouge plus : ni plus grande, ni plus petite", async () => {
    const runner = await createGameRunner(
      partie("Europe" as GameMapType),
      "j1",
      loader,
      () => {},
    );
    runner.game.executeNextTick();
    runner.game.executeNextTick();
    const depart = runner.game.player(ID_DU_COEUR).numTilesOwned();

    // Une minute de jeu, avec des robots qui cherchent a s'etendre partout.
    for (let i = 0; i < 800; i++) runner.game.executeNextTick();

    expect(runner.game.player(ID_DU_COEUR).numTilesOwned()).toBe(depart);
  }, 600_000);
});
