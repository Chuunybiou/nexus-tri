import { DEFAULT_FACTION, Faction } from "../src/core/game/Factions";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "../src/core/game/Game";
import {
  ClientJoinMessageSchema,
  ClientMessageSchema,
  PlayerRecordSchema,
  PlayerSchema,
  ServerMessageSchema,
} from "../src/core/Schemas";

const baseJoin = {
  type: "join" as const,
  token: "123e4567-e89b-12d3-a456-426614174000",
  gameID: "abcd1234",
  username: "TestPlayer",
  clanTag: null,
  turnstileToken: null,
};

// The smallest GameConfig the schema accepts; the faction fields are what
// this test is about, the rest just has to be valid.
const GAME_CONFIG = {
  gameMap: GameMapType.Asia,
  gameMapSize: GameMapSize.Normal,
  gameMode: GameMode.FFA,
  gameType: GameType.Singleplayer,
  difficulty: Difficulty.Medium,
  nations: "default" as const,
  donateGold: false,
  donateTroops: false,
  bots: 0,
  infiniteGold: false,
  infiniteTroops: false,
  instantBuild: false,
  randomSpawn: false,
};

const basePlayer = {
  clientID: "abcd1234",
  username: "TestPlayer",
  clanTag: null,
};

describe("faction on the join message", () => {
  test("survives a real binary round-trip", () => {
    // Not just zod validation: the compact wire encoding is positional, so a
    // field that parses can still decode into the wrong slot.
    for (const faction of Object.values(Faction)) {
      const msg = { ...baseJoin, faction };
      const bytes = ClientMessageSchema.serialize(msg);
      expect(ClientMessageSchema.parseBytes(bytes)).toEqual(msg);
    }
  });

  test("is optional, so a build predating the picker still joins", () => {
    const parsed = ClientJoinMessageSchema.parse(baseJoin);
    expect(parsed.faction).toBeUndefined();

    const bytes = ClientMessageSchema.serialize(baseJoin);
    expect(ClientMessageSchema.parseBytes(bytes)).toEqual(baseJoin);
  });

  test("rejects a faction that is not one of the three", () => {
    for (const bad of ["TERRAN", "vanguard", "", 0, null]) {
      expect(
        ClientJoinMessageSchema.safeParse({ ...baseJoin, faction: bad })
          .success,
      ).toBe(false);
    }
  });
});

describe("golden: the faction enum's wire positions", () => {
  // zbin has no field tags and no version byte: an enum member's index IS its
  // encoding. Reordering Faction, or inserting a member ahead of the existing
  // ones, keeps every round-trip test green while silently turning one
  // faction into another between two builds. These vectors are the only thing
  // that stops it. If this fails, the wire format changed — fine to do on
  // purpose (update the vectors), never by accident.
  const PREFIX =
    "2431323365343536372d653839622d313264332d613435362d3432363631" +
    "343137343030300861626364313233340a54657374506c61796572";

  test.each([
    [Faction.Vanguard, "00"],
    [Faction.Swarm, "01"],
    [Faction.Ascendant, "02"],
  ])("%s encodes as index %s", (faction, index) => {
    const bytes = ClientMessageSchema.serialize({ ...baseJoin, faction });
    expect(Buffer.from(bytes).toString("hex")).toBe("0445" + PREFIX + index);
  });

  test("an absent faction adds no trailing byte", () => {
    const bytes = ClientMessageSchema.serialize(baseJoin);
    expect(Buffer.from(bytes).toString("hex")).toBe("0405" + PREFIX);
  });
});

describe("faction on the broadcast player list", () => {
  test("round-trips inside a start message", () => {
    // GameStartInfo is what every client feeds into its own simulation, so
    // this is the field that actually decides what faction each player fields.
    const start = {
      type: "start" as const,
      turns: [],
      lobbyCreatedAt: 1,
      gameStartInfo: {
        gameID: "abcd1234",
        lobbyCreatedAt: 1,
        config: GAME_CONFIG,
        players: [
          { ...basePlayer, clientID: "aaaa1111", faction: Faction.Swarm },
          { ...basePlayer, clientID: "bbbb2222", faction: Faction.Ascendant },
          { ...basePlayer, clientID: "cccc3333", faction: Faction.Vanguard },
        ],
      },
    };

    const bytes = ServerMessageSchema.serialize(start);
    const back = ServerMessageSchema.parseBytes(bytes) as typeof start;
    expect(back.gameStartInfo.players.map((p) => p.faction)).toEqual([
      Faction.Swarm,
      Faction.Ascendant,
      Faction.Vanguard,
    ]);
  });

  test("keeps each player's faction attached to the right player", () => {
    // A positional encoding that drifted by one slot would still round-trip
    // three factions — just on the wrong players.
    const players = [
      { ...basePlayer, clientID: "aaaa1111", faction: Faction.Ascendant },
      { ...basePlayer, clientID: "bbbb2222", faction: Faction.Swarm },
    ];
    for (const p of players) {
      expect(PlayerSchema.parse(p)).toMatchObject({
        clientID: p.clientID,
        faction: p.faction,
      });
    }
  });
});

describe("faction on the archived record", () => {
  test("is carried, so replays rebuild the same simulation", () => {
    // GameServer rebuilds GameStartInfo from these records. A faction missing
    // here replays as Vanguard and desyncs against the recorded hashes.
    const record = {
      ...basePlayer,
      persistentID: null,
      stats: {},
      faction: Faction.Swarm,
    };
    expect(PlayerRecordSchema.parse(record).faction).toBe(Faction.Swarm);
  });

  test("falls back to the anchor on records written before factions", () => {
    const old = { ...basePlayer, persistentID: null, stats: {} };
    const parsed = PlayerRecordSchema.parse(old);
    expect(parsed.faction).toBeUndefined();
    expect(parsed.faction ?? DEFAULT_FACTION).toBe(Faction.Vanguard);
  });
});
