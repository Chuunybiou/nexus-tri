import path from "path";
import { fileURLToPath } from "url";
import { AttackExecution } from "../src/core/execution/AttackExecution";
import { ID_DU_COEUR } from "../src/core/execution/CoeurExecution";
import { Faction } from "../src/core/game/Factions";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  Player,
  UnitType,
} from "../src/core/game/Game";
import { createGameRunner } from "../src/core/GameRunner";
import { GameStartInfo } from "../src/core/Schemas";
import { NodeGameMapLoader } from "./perf/fullgame/NodeGameMapLoader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loader = new NodeGameMapLoader(path.join(__dirname, "../resources/maps"));

/**
 * « S'acharner sur le Cœur doit couter cher. »
 *
 * L'attaque elle-meme est arretee avant de depenser une troupe — sinon un
 * joueur viderait son armee contre un mur qui se reforme. Gratuit ne veut pas
 * dire sans risque : a la troisieme tentative, le Cœur tire une bombe
 * atomique sur un point au hasard du territoire de l'attaquant.
 *
 * Ce test joue une vraie partie et compte les bombes, plutot que de verifier
 * qu'un compteur s'incremente : c'est la difference entre « la fonction est
 * appelee » et « le joueur se prend une bombe ».
 */
function partie(): GameStartInfo {
  return {
    gameID: "riposte",
    lobbyCreatedAt: Date.now(),
    config: {
      gameMap: "Europe" as GameMapType,
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

/** Les bombes que le Cœur a en vol. */
function bombesDuCoeur(mg: {
  player(id: string): Player;
}): ReturnType<Player["units"]> {
  return mg.player(ID_DU_COEUR).units(UnitType.AtomBomb);
}

describe("la riposte du Cœur", () => {
  test("deux attaques ne coutent rien, la troisieme declenche une bombe", async () => {
    const runner = await createGameRunner(partie(), "j1", loader, () => {});
    const mg = runner.game;
    // Assez de tours pour que la phase de depart soit finie et que le joueur
    // ait un territoire a bombarder.
    for (let i = 0; i < 300; i++) mg.executeNextTick();

    const joueur = mg.players().find((p) => p.clientID() === "j1")!;
    expect(joueur.numTilesOwned()).toBeGreaterThan(0);
    expect(bombesDuCoeur(mg).length).toBe(0);

    const attaquer = () => {
      mg.addExecution(new AttackExecution(100, joueur, ID_DU_COEUR));
      // Trois tours, et pas moins : le premier initialise l'attaque (c'est
      // la qu'elle est refusee et signalee au Cœur), le deuxieme initialise
      // la bombe, le troisieme la fait exister sur la carte.
      for (let i = 0; i < 3; i++) mg.executeNextTick();
    };

    const troupesAvant = joueur.troops();

    attaquer();
    expect(bombesDuCoeur(mg).length).toBe(0);
    attaquer();
    expect(bombesDuCoeur(mg).length).toBe(0);
    attaquer();
    expect(bombesDuCoeur(mg).length).toBe(1);

    // L'attaque n'a rien coute en troupes : c'est la bombe qui punit, pas la
    // perte d'une armee jetee contre un mur.
    expect(joueur.troops()).toBeGreaterThanOrEqual(troupesAvant);

    // Et la bombe vise bien chez l'attaquant.
    const bombe = bombesDuCoeur(mg)[0];
    const cible = bombe.targetTile();
    expect(cible).toBeDefined();
    expect(mg.owner(cible!)).toBe(joueur);
  }, 300_000);

  test("le compteur repart de zero : trois nouvelles tentatives pour la suivante", async () => {
    const runner = await createGameRunner(partie(), "j1", loader, () => {});
    const mg = runner.game;
    for (let i = 0; i < 300; i++) mg.executeNextTick();
    const joueur = mg.players().find((p) => p.clientID() === "j1")!;

    const attaquer = () => {
      mg.addExecution(new AttackExecution(100, joueur, ID_DU_COEUR));
      for (let i = 0; i < 3; i++) mg.executeNextTick();
    };

    for (let i = 0; i < 3; i++) attaquer();
    expect(bombesDuCoeur(mg).length).toBe(1);

    // Quatrieme et cinquieme : rien de plus.
    attaquer();
    attaquer();
    expect(bombesDuCoeur(mg).length).toBe(1);

    // Sixieme : la deuxieme bombe.
    attaquer();
    expect(bombesDuCoeur(mg).length).toBe(2);
  }, 300_000);
});
