import { DEFAULT_FACTION, Faction } from "../src/core/game/Factions";
import { Game, PlayerInfo, PlayerType } from "../src/core/game/Game";
import { setup } from "./util/Setup";

describe("Player faction", () => {
  let game: Game;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
  });

  test("defaults to Vanguard when the caller omits it", () => {
    // Every existing spawner (TribeSpawner, NationCreation, GameServer) builds
    // a PlayerInfo without a faction. They must keep working untouched, and
    // Vanguard is balance-neutral, so nothing about their games changes.
    game.addPlayer(new PlayerInfo("legacy", PlayerType.Human, null, "legacy"));
    const player = game.player("legacy");

    expect(player.faction()).toBe(Faction.Vanguard);
    expect(player.faction()).toBe(DEFAULT_FACTION);
    expect(player.info().faction).toBe(DEFAULT_FACTION);
  });

  test("round-trips an explicit faction through the game", () => {
    game.addPlayer(
      new PlayerInfo(
        "zerg",
        PlayerType.Human,
        null,
        "zerg",
        false,
        null,
        [],
        null,
        null,
        Faction.Swarm,
      ),
    );
    const player = game.player("zerg");

    expect(player.faction()).toBe(Faction.Swarm);
    expect(player.info().faction).toBe(Faction.Swarm);
  });

  test("keeps each player's faction independent within one game", () => {
    const factions = [Faction.Vanguard, Faction.Swarm, Faction.Ascendant];
    for (const faction of factions) {
      game.addPlayer(
        new PlayerInfo(
          faction,
          PlayerType.Human,
          null,
          faction,
          false,
          null,
          [],
          null,
          null,
          faction,
        ),
      );
    }

    for (const faction of factions) {
      expect(game.player(faction).faction()).toBe(faction);
    }
  });

  test("leaves bots and nations on the baseline for now", () => {
    // Faction assignment for AI players is a later step; until then they must
    // not silently drift off the balance anchor.
    game.addPlayer(new PlayerInfo("bot", PlayerType.Bot, null, "bot"));
    game.addPlayer(new PlayerInfo("nation", PlayerType.Nation, null, "nation"));

    expect(game.player("bot").faction()).toBe(Faction.Vanguard);
    expect(game.player("nation").faction()).toBe(Faction.Vanguard);
  });
});
