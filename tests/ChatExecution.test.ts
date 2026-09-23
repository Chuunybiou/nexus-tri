import { ChatExecution } from "../src/core/execution/ChatExecution";
import { Faction } from "../src/core/game/Factions";
import {
  Game,
  MessageType,
  Player,
  PlayerInfo,
  PlayerType,
} from "../src/core/game/Game";
import { ChatIntentSchema } from "../src/core/Schemas";
import { setup } from "./util/Setup";

function addPlayer(game: Game, id: string): Player {
  const info = new PlayerInfo(
    id,
    PlayerType.Human,
    null,
    id,
    false,
    null,
    [],
    null,
    null,
    Faction.Vanguard,
  );
  game.addPlayer(info);
  return game.player(id);
}

/** Joue l'execution une fois, au tick demande. */
function say(game: Game, sender: Player, text: string, tick: number) {
  const exec = new ChatExecution(sender, text);
  exec.init(game, tick);
  exec.tick(tick);
}

describe("chat libre", () => {
  let game: Game;
  let sender: Player;
  let messages: any[];

  beforeEach(async () => {
    game = await setup("ocean_and_land");
    sender = addPlayer(game, "bavard");
    messages = [];
    const vrai = game.displayMessage.bind(game);
    game.displayMessage = ((...args: any[]) => {
      messages.push(args);
      return vrai(...(args as Parameters<typeof vrai>));
    }) as typeof game.displayMessage;
  });

  test("le message part vers tout le monde", () => {
    say(game, sender, "on s'allie ?", 10);

    expect(messages).toHaveLength(1);
    const [key, type, playerID, , params] = messages[0];
    expect(key).toBe("events_display.chat_message");
    expect(type).toBe(MessageType.CHAT);
    // null = tout le monde le voit, pas seulement un destinataire.
    expect(playerID).toBeNull();
    expect(params.text).toBe("on s'allie ?");
  });

  test("un message vide n'est pas envoye", () => {
    say(game, sender, "   ", 10);
    expect(messages).toHaveLength(0);
  });

  test("deux messages coup sur coup : le second est refuse", () => {
    say(game, sender, "premier", 10);
    say(game, sender, "second", 12);
    expect(messages).toHaveLength(1);

    // L'attente se compte sur l'horloge de la partie, pas sur le numero de
    // tick passe a l'execution : c'est elle qui fait foi pour tout le monde.
    for (let i = 0; i < 21; i++) game.executeNextTick();
    say(game, sender, "troisieme", 31);
    expect(messages).toHaveLength(2);
    expect(messages[1][4].text).toBe("troisieme");
  });

  test("le texte accepte les accents et le vietnamien, pas les caracteres de controle", () => {
    expect(
      ChatIntentSchema.safeParse({ type: "chat", text: "ça va ?" }).success,
    ).toBe(true);
    expect(
      ChatIntentSchema.safeParse({ type: "chat", text: "Chào bạn" }).success,
    ).toBe(true);
    expect(
      ChatIntentSchema.safeParse({ type: "chat", text: "deux\nlignes" })
        .success,
    ).toBe(false);
    expect(ChatIntentSchema.safeParse({ type: "chat", text: "" }).success).toBe(
      false,
    );
    expect(
      ChatIntentSchema.safeParse({ type: "chat", text: "a".repeat(201) })
        .success,
    ).toBe(false);
  });
});
