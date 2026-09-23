import path from "path";
import { fileURLToPath } from "url";
import { Faction } from "../src/core/game/Factions";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "../src/core/game/Game";
import { createGameRunner } from "../src/core/GameRunner";
import { GameStartInfo } from "../src/core/Schemas";
import { NodeGameMapLoader } from "./perf/fullgame/NodeGameMapLoader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Le demarrage d'une partie, exactement comme le navigateur le fait.
 *
 * Dans le navigateur, createGameRunner tourne dans un fil separe et son echec
 * n'est attrape par personne : le joueur voit « La partie est en train de
 * commencer... » pendant soixante secondes, puis « Worker initialization
 * timeout », sans jamais savoir ce qui a casse. Ce test rejoue la meme
 * sequence en clair, pour que la panne soit lisible ici plutot que muette
 * chez le joueur.
 */
function startInfo(
  overrides: Partial<GameStartInfo["config"]> = {},
): GameStartInfo {
  return {
    gameID: "1Ey2pGBs",
    lobbyCreatedAt: Date.now(),
    config: {
      gameMap: GameMapType.World,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Public,
      difficulty: Difficulty.Medium,
      nations: "default",
      donateGold: true,
      donateTroops: true,
      bots: 20,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      ...overrides,
    },
    players: [
      {
        clientID: "8Tq5BPLB",
        username: "Chuuny",
        clanTag: null,
        faction: Faction.Swarm,
      },
      {
        clientID: "9Zz1CDEF",
        username: "Statikzor",
        clanTag: null,
        faction: Faction.Ascendant,
      },
    ],
  } as GameStartInfo;
}

describe("demarrage d'une partie (chemin du navigateur)", () => {
  const mapLoader = new NodeGameMapLoader(
    path.join(__dirname, "../resources/maps"),
  );

  test("une partie publique se prepare sans erreur", async () => {
    const runner = await createGameRunner(
      startInfo(),
      "8Tq5BPLB",
      mapLoader,
      () => {},
    );
    expect(runner).toBeDefined();
  }, 120_000);

  test("une partie avec des tribus achetees se prepare aussi", async () => {
    const info = startInfo();
    // Les parties publiques portent parfois des noms de tribus achetees ;
    // elles viennent du service ferme, absent ici.
    (info as { tribes?: { name: string }[] }).tribes = [
      { name: "Alpha" },
      { name: "Beta" },
    ];
    const runner = await createGameRunner(
      info,
      "8Tq5BPLB",
      mapLoader,
      () => {},
    );
    expect(runner).toBeDefined();
  }, 120_000);

  test("une partie en equipes se prepare aussi", async () => {
    const runner = await createGameRunner(
      startInfo({ gameMode: GameMode.Team, playerTeams: 2 } as never),
      "8Tq5BPLB",
      mapLoader,
      () => {},
    );
    expect(runner).toBeDefined();
  }, 120_000);

  test("une partie solo se prepare aussi", async () => {
    const runner = await createGameRunner(
      startInfo({ gameType: GameType.Singleplayer, bots: 5 }),
      "8Tq5BPLB",
      mapLoader,
      () => {},
    );
    expect(runner).toBeDefined();
  }, 120_000);
});
