import path from "path";
import { fileURLToPath } from "url";
import { ID_DU_COEUR } from "../src/core/execution/CoeurExecution";
import { Faction } from "../src/core/game/Factions";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "../src/core/game/Game";
import { Resource } from "../src/core/game/Resources";
import { createGameRunner } from "../src/core/GameRunner";
import { GameStartInfo } from "../src/core/Schemas";
import { NodeGameMapLoader } from "./perf/fullgame/NodeGameMapLoader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * « Est-ce que ca change quelque chose en jouant ? »
 *
 * Ce test ne verifie pas qu'une fonction renvoie la bonne valeur : il fait
 * tourner une VRAIE partie une minute, puis mesure ce qu'un joueur verrait a
 * l'ecran. C'est la seule facon de repondre honnetement a la question, et de
 * regler les vitesses sur autre chose qu'une intuition.
 */
function partie(faction: Faction): GameStartInfo {
  return {
    gameID: "impact-test",
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
    players: [{ clientID: "j1", username: "Joueur", clanTag: null, faction }],
  } as GameStartInfo;
}

const loader = new NodeGameMapLoader(path.join(__dirname, "../resources/maps"));

/** Une minute de jeu apres la phase de depart. */
const TICKS = 200 + 600;

describe("impact reel des mecaniques", () => {
  test("une minute de Swarm : la nuee gagne du terrain toute seule", async () => {
    const runner = await createGameRunner(
      partie(Faction.Swarm),
      "j1",
      loader,
      () => {},
    );
    for (let i = 0; i < TICKS; i++) runner.game.executeNextTick();

    const joueur = runner.game.players().find((p) => p.clientID() === "j1");
    const coeur = runner.game.hasPlayer(ID_DU_COEUR)
      ? runner.game.player(ID_DU_COEUR)
      : null;
    const tenuParLeCoeur = coeur?.numTilesOwned() ?? 0;

    // Ce que ces chiffres disent, ecrit en clair dans la sortie du test :
    // si l'un d'eux est ridicule, la mecanique est invisible en jouant.
    console.log(
      `[impact] Swarm : ${joueur?.numTilesOwned() ?? 0} cases, ` +
        `biomasse ${joueur?.resource(Resource.Biomass) ?? 0} · ` +
        `Cœur : ${tenuParLeCoeur} cases`,
    );

    // Le Cœur doit se voir sans ecraser la partie : un cercle fige sur un
    // cinquieme de la carte. Les deux ecueils rencontres pendant la mise au
    // point etaient un anneau invisible, puis des robots qui mangeaient toute
    // la carte — et une zone si grande que les nations ne pouvaient plus
    // apparaitre.
    expect(coeur).not.toBeNull();
    expect(tenuParLeCoeur).toBeGreaterThan(100_000);

    // La nuee doit avoir gagne du terrain toute seule : c'est la mecanique
    // qu'un joueur doit sentir des la premiere minute.
    expect(joueur?.numTilesOwned() ?? 0).toBeGreaterThan(100);
  }, 300_000);

  test("une minute de Vanguard : la production de ressources tourne", async () => {
    const runner = await createGameRunner(
      partie(Faction.Vanguard),
      "j1",
      loader,
      () => {},
    );
    for (let i = 0; i < TICKS; i++) runner.game.executeNextTick();

    const joueur = runner.game.players().find((p) => p.clientID() === "j1");
    console.log(
      `[impact] Vanguard : ${joueur?.numTilesOwned() ?? 0} cases, ` +
        `uranium ${joueur?.resource(Resource.Uranium) ?? 0}`,
    );
    expect(joueur?.resource(Resource.Uranium) ?? 0).toBeGreaterThan(0);
  }, 300_000);
});
