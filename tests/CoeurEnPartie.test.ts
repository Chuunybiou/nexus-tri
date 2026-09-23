import path from "path";
import { fileURLToPath } from "url";
import { createGameRunner } from "../src/core/GameRunner";
import { Faction } from "../src/core/game/Factions";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerType,
} from "../src/core/game/Game";
import { GameStartInfo } from "../src/core/Schemas";
import { NodeGameMapLoader } from "./perf/fullgame/NodeGameMapLoader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Le cercle de gardiens doit EXISTER DANS LA PARTIE, pas seulement dans la
 * fonction qui le calcule.
 *
 * Le test precedent verifiait que gardiensDuCoeur() renvoyait des spawns ;
 * celui-ci demarre une vraie partie, la fait tourner, et regarde qui tient du
 * terrain au centre. C'est la difference entre « le code a l'air bon » et « on
 * le voit quand on lance une partie ».
 */
function startInfo(carte: GameMapType): GameStartInfo {
  return {
    gameID: "coeur-test",
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
      bots: 0,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
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

describe("les gardiens du Cœur dans une vraie partie", () => {
  const loader = new NodeGameMapLoader(path.join(__dirname, "../resources/maps"));

  for (const carte of ["World", "Europe", "Africa"] as GameMapType[]) {
    test(
      `${carte} : six gardiens tiennent le centre`,
      async () => {
        const runner = await createGameRunner(
          startInfo(carte),
          "j1",
          loader,
          () => {},
        );
        // La phase de depart, puis quelques secondes de jeu.
        for (let i = 0; i < 260; i++) runner.game.executeNextTick();

        const gardiens = runner.game
          .players()
          .filter((p) => p.name().startsWith("Gardien"));

        expect(gardiens.length).toBeGreaterThanOrEqual(4);
        for (const g of gardiens) {
          expect(g.type()).toBe(PlayerType.Bot);
          // Un gardien sans terrain ne se voit pas : c'est tout l'objet du
          // test.
          expect(g.numTilesOwned()).toBeGreaterThan(0);
        }
      },
      180_000,
    );
  }
});
