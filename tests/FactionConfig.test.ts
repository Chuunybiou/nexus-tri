import {
  applyPerMille,
  Faction,
  FACTIONS,
  PER_MILLE_BASE,
} from "../src/core/game/Factions";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";

function addPlayer(game: Game, faction: Faction, type = PlayerType.Human) {
  const id = `${faction}_${type}`;
  game.addPlayer(
    new PlayerInfo(id, type, null, id, false, null, [], null, null, faction),
  );
  return game.player(id);
}

describe("Faction traits applied by Config", () => {
  let game: Game;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
  });

  describe("attackAmount", () => {
    test("scales with the faction's attack modifier", () => {
      // setTroops, not addTroops: players are seeded with startManpower
      // (25_000 for humans), which would otherwise skew the arithmetic.
      const troops = 100_000;
      const results = new Map<Faction, number>();
      for (const faction of Object.values(Faction)) {
        const player = addPlayer(game, faction);
        player.setTroops(troops);
        results.set(
          faction,
          game.config().attackAmount(player, game.terraNullius()),
        );
      }

      const baseline = results.get(Faction.Vanguard)!;
      // Vanguard is the anchor: troops / 5, untouched.
      expect(baseline).toBe(troops / 5);
      expect(results.get(Faction.Swarm)).toBeCloseTo(
        applyPerMille(baseline, FACTIONS[Faction.Swarm].attackPerMille),
        6,
      );
      expect(results.get(Faction.Ascendant)).toBeCloseTo(
        applyPerMille(baseline, FACTIONS[Faction.Ascendant].attackPerMille),
        6,
      );
      // The identity that makes the faction playable, not just configured.
      expect(results.get(Faction.Ascendant)!).toBeGreaterThan(baseline);
      expect(results.get(Faction.Swarm)!).toBeLessThan(baseline);
    });

    test("stacks on top of the bot penalty rather than replacing it", () => {
      const bot = addPlayer(game, Faction.Swarm, PlayerType.Bot);
      const human = addPlayer(game, Faction.Swarm, PlayerType.Human);
      // Equal troops, so the only difference left is the bot/human split.
      bot.setTroops(100_000);
      human.setTroops(100_000);

      const botAmount = game.config().attackAmount(bot, game.terraNullius());
      const humanAmount = game
        .config()
        .attackAmount(human, game.terraNullius());
      // Bots commit 1/20 where humans commit 1/5 — a 4x gap that the shared
      // faction modifier must preserve.
      expect(humanAmount / botAmount).toBeCloseTo(4, 6);
    });
  });

  describe("goldAdditionRate", () => {
    test("scales with the faction's gold modifier, in exact bigint", () => {
      const vanguard = addPlayer(game, Faction.Vanguard);
      const swarm = addPlayer(game, Faction.Swarm);
      const ascendant = addPlayer(game, Faction.Ascendant);

      const base = game.config().goldAdditionRate(vanguard);
      expect(game.config().goldAdditionRate(swarm)).toBe((base * 900n) / 1000n);
      expect(game.config().goldAdditionRate(ascendant)).toBe(
        (base * 1100n) / 1000n,
      );
    });
  });

  describe("unit costs", () => {
    test("Swarm builds cheaper and Ascendant dearer than Vanguard", () => {
      const players = new Map<Faction, Player>();
      for (const faction of Object.values(Faction)) {
        players.set(faction, addPlayer(game, faction));
      }

      for (const unit of [UnitType.City, UnitType.Port, UnitType.Warship]) {
        const cost = (f: Faction) =>
          game.config().unitInfo(unit).cost(game, players.get(f)!);
        const base = cost(Faction.Vanguard);

        expect(base).toBeGreaterThan(0n);
        expect(cost(Faction.Swarm)).toBe((base * 750n) / 1000n);
        expect(cost(Faction.Ascendant)).toBe((base * 1400n) / 1000n);
        expect(cost(Faction.Swarm)).toBeLessThan(base);
        expect(cost(Faction.Ascendant)).toBeGreaterThan(base);
      }
    });
  });

  describe("troopIncreaseRate", () => {
    test("Swarm regrows faster and Ascendant slower", () => {
      const rates = new Map<Faction, number>();
      for (const faction of Object.values(Faction)) {
        const player = addPlayer(game, faction);
        player.setTroops(50_000);
        rates.set(faction, game.config().troopIncreaseRate(player));
      }

      expect(rates.get(Faction.Swarm)!).toBeGreaterThan(
        rates.get(Faction.Vanguard)!,
      );
      expect(rates.get(Faction.Ascendant)!).toBeLessThan(
        rates.get(Faction.Vanguard)!,
      );
    });

    test("never pushes a player past maxTroops", () => {
      // The modifier is applied before the clamp, so even the fastest-growing
      // faction stops at the ceiling.
      const swarm = addPlayer(game, Faction.Swarm);
      const max = game.config().maxTroops(swarm);
      swarm.setTroops(max);

      expect(game.config().troopIncreaseRate(swarm)).toBeLessThanOrEqual(0);
    });
  });
});

describe("applyPerMille", () => {
  test("is an exact no-op at the neutral rate", () => {
    // `(x * 1000) / 1000` drifts one ulp for ~2% of doubles, which would move
    // every Vanguard player off the pre-faction numbers.
    const drifters = [
      2537.1786659471013, 2885.514743087493, 3476.4768313682966,
    ];
    for (const value of drifters) {
      expect((value * PER_MILLE_BASE) / PER_MILLE_BASE).not.toBe(value);
      expect(applyPerMille(value, PER_MILLE_BASE)).toBe(value);
    }
  });

  test("applies the ratio otherwise", () => {
    expect(applyPerMille(100, 1250)).toBeCloseTo(125, 10);
    expect(applyPerMille(100, 750)).toBeCloseTo(75, 10);
    expect(applyPerMille(0.5, 1400)).toBeCloseTo(0.7, 10);
  });
});
