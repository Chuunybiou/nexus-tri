import { AscendantGridExecution } from "../src/core/execution/AscendantGridExecution";
import { AscendantShieldExecution } from "../src/core/execution/AscendantShieldExecution";
import { Executor } from "../src/core/execution/ExecutionManager";
import { SwarmDecayExecution } from "../src/core/execution/SwarmDecayExecution";
import { Game } from "../src/core/game/Game";
import { GameRunner } from "../src/core/GameRunner";
import { setup } from "./util/Setup";

/**
 * executions() lives on GameImpl, not on the Game interface setup() returns.
 * Narrowing here rather than widening the public interface: nothing in the sim
 * should be reading the execution list, this test is the exception.
 */
function executionsOf(game: Game): { constructor: { name: string } }[] {
  return (
    game as unknown as { executions(): { constructor: { name: string } }[] }
  ).executions();
}

/**
 * The wiring test.
 *
 * Every other faction test drives an Execution directly, which proves the rule
 * works but says nothing about whether a real game ever runs it. A mechanic
 * that is implemented, tested and simply never registered behaves exactly like
 * one that does not exist — and nothing else in the suite would notice.
 */
describe("Faction mechanics are registered by GameRunner", () => {
  let game: Game;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
  });

  function initRunner(): void {
    const runner = new GameRunner(
      game,
      new Executor(game, "registration_test", undefined),
      () => {},
    );
    runner.init();
  }

  test("adds all three to the live game", () => {
    initRunner();

    const registered = executionsOf(game).map((e) => e.constructor.name);

    for (const mechanic of [
      SwarmDecayExecution,
      AscendantGridExecution,
      AscendantShieldExecution,
    ]) {
      expect(registered).toContain(mechanic.name);
    }
  });

  test("adds exactly one of each, so nothing is applied twice", () => {
    initRunner();

    const names = executionsOf(game).map((e) => e.constructor.name);
    for (const mechanic of [
      SwarmDecayExecution,
      AscendantGridExecution,
      AscendantShieldExecution,
    ]) {
      expect(names.filter((n) => n === mechanic.name)).toHaveLength(1);
    }
  });

  test("registers them regardless of which factions are in the lobby", () => {
    // They are registered unconditionally and filter by faction per tick, so a
    // player switching faction mid-lobby cannot end up in a game whose engine
    // never loaded their mechanic.
    initRunner();

    const names = executionsOf(game).map((e) => e.constructor.name);
    expect(names).toContain(SwarmDecayExecution.name);
    expect(names).toContain(AscendantGridExecution.name);
    expect(names).toContain(AscendantShieldExecution.name);
  });
});
