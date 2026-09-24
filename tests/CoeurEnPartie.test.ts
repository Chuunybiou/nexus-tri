import path from "path";
import { fileURLToPath } from "url";
import {
  ID_DU_COEUR,
  NOM_DU_COEUR,
} from "../src/core/execution/CoeurExecution";
import { Faction } from "../src/core/game/Factions";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerType,
} from "../src/core/game/Game";
import { createGameRunner } from "../src/core/GameRunner";
import { GameStartInfo } from "../src/core/Schemas";
import { NodeGameMapLoader } from "./perf/fullgame/NodeGameMapLoader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * La zone du Cœur doit EXISTER DANS LA PARTIE, pas seulement dans la fonction
 * qui la calcule.
 *
 * Le test voisin verifie que le centre tombe bien sur la terre ; celui-ci
 * demarre une vraie partie sur trois cartes et regarde qui tient du terrain au
 * milieu. C'est la difference entre « le code a l'air bon » et « on le voit
 * quand on lance une partie ».
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

describe("la zone du Cœur dans une vraie partie", () => {
  const loader = new NodeGameMapLoader(
    path.join(__dirname, "../resources/maps"),
  );

  for (const carte of ["World", "Europe", "Africa"] as GameMapType[]) {
    test(`${carte} : un seul Cœur, un cinquieme de la carte, des le depart`, async () => {
      const runner = await createGameRunner(
        startInfo(carte),
        "j1",
        loader,
        () => {},
      );
      const mg = runner.game;

      // Deux tours de boucle : le premier initialise l'execution, le second
      // pose la zone — avant meme que les joueurs ne choisissent leur place.
      mg.executeNextTick();
      mg.executeNextTick();

      expect(mg.hasPlayer(ID_DU_COEUR)).toBe(true);
      const coeur = mg.player(ID_DU_COEUR);
      expect(coeur.name()).toBe(NOM_DU_COEUR);
      expect(coeur.type()).toBe(PlayerType.Bot);

      // Le cercle couvre 20 % de la carte ; ce qu'il en reste au Cœur, c'est
      // la terre qui s'y trouve. Sur ces trois cartes, c'est une part large
      // et bien visible du continent.
      let terres = 0;
      for (let y = 0; y < mg.height(); y++) {
        for (let x = 0; x < mg.width(); x++) {
          const t = mg.ref(x, y);
          if (mg.isLand(t) && !mg.isImpassable(t)) terres++;
        }
      }
      const part = coeur.numTilesOwned() / terres;
      expect(part).toBeGreaterThan(0.15);
      expect(part).toBeLessThan(0.35);

      // Et il ne bouge pas : ni conquete, ni recul.
      const depart = coeur.numTilesOwned();
      for (let i = 0; i < 200; i++) mg.executeNextTick();
      expect(mg.player(ID_DU_COEUR).numTilesOwned()).toBe(depart);
    }, 300_000);
  }
});
