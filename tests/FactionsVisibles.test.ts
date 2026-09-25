import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ID_DU_COEUR } from "../src/core/execution/CoeurExecution";
import { factionDeRobot } from "../src/core/game/FactionAssignment";
import { factionPattern } from "../src/core/game/FactionPatterns";
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
const loader = new NodeGameMapLoader(path.join(__dirname, "../resources/maps"));

/**
 * « On ne voit aucune difference entre les trois races sur la carte. »
 *
 * Deux causes, et ce fichier surveille les deux :
 *
 * 1. Personne n'avait de faction. PlayerInfo retombe sur Vanguard quand on ne
 *    precise rien, et aucun generateur de robots ou de nations ne precisait
 *    quoi que ce soit — donc sur une carte ou presque tous les joueurs sont
 *    des nations, tout le monde peignait le meme motif.
 * 2. Les motifs se ressemblaient. De loin, un quadrillage et un treillis
 *    donnent la meme trame grise ; ce qui survit au dezoom, c'est la densite
 *    et la direction.
 */

/** Part de cases peintes en couleur secondaire, entre 0 et 1. */
function densite(faction: Faction): number {
  const p = factionPattern(faction);
  let allumees = 0;
  for (let i = 0; i < p.width * p.height; i++) {
    if ((p.bits[i >> 3] & (1 << (i & 7))) !== 0) allumees++;
  }
  return allumees / (p.width * p.height);
}

describe("les trois motifs se distinguent", () => {
  test("ils ne sont pas identiques", () => {
    const v = factionPattern(Faction.Vanguard);
    const s = factionPattern(Faction.Swarm);
    const a = factionPattern(Faction.Ascendant);
    expect(Buffer.from(v.bits).equals(Buffer.from(s.bits))).toBe(false);
    expect(Buffer.from(s.bits).equals(Buffer.from(a.bits))).toBe(false);
    expect(Buffer.from(v.bits).equals(Buffer.from(a.bits))).toBe(false);
  });

  test("leurs densites sont nettement separees", () => {
    const v = densite(Faction.Vanguard);
    const s = densite(Faction.Swarm);
    const a = densite(Faction.Ascendant);

    // Vanguard sombre et bati, Swarm moyen et grumeleux, Ascendant clair et
    // diagonal. Dix points d'ecart au minimum : en dessous, la difference ne
    // se voit plus une fois la carte dezoomee.
    expect(v - s).toBeGreaterThan(0.1);
    expect(s - a).toBeGreaterThan(0.1);
  });

  test("aucun n'est vide ni plein (un motif invisible ne sert a rien)", () => {
    for (const f of [Faction.Vanguard, Faction.Swarm, Faction.Ascendant]) {
      expect(densite(f)).toBeGreaterThan(0.1);
      expect(densite(f)).toBeLessThan(0.8);
    }
  });
});

describe("la faction d'un robot ou d'une nation", () => {
  test("toujours la meme pour le meme identifiant (sinon les clients divergent)", () => {
    for (const id of ["abc", "xyz123", "nation-42", ""]) {
      expect(factionDeRobot(id)).toBe(factionDeRobot(id));
    }
  });

  test("les trois sont servies, a peu pres a egalite", () => {
    const comptes = new Map<Faction, number>();
    for (let i = 0; i < 900; i++) {
      const f = factionDeRobot(`joueur-${i}`);
      comptes.set(f, (comptes.get(f) ?? 0) + 1);
    }
    expect(comptes.size).toBe(3);
    for (const n of comptes.values()) {
      expect(n).toBeGreaterThan(200);
    }
  });
});

describe("dans une vraie partie", () => {
  test("les nations ne sont plus toutes de la meme faction", async () => {
    const start = {
      gameID: "factions",
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
        bots: 20,
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

    const runner = await createGameRunner(start, "j1", loader, () => {});
    for (let i = 0; i < 300; i++) runner.game.executeNextTick();

    const autres = runner.game
      .players()
      .filter(
        (p) =>
          p.id() !== ID_DU_COEUR &&
          (p.type() === PlayerType.Nation || p.type() === PlayerType.Bot),
      );
    expect(autres.length).toBeGreaterThan(30);

    const comptes = new Map<Faction, number>();
    for (const p of autres) {
      const f = p.info().faction;
      comptes.set(f, (comptes.get(f) ?? 0) + 1);
    }

    // Les trois doivent etre representees, et aucune ne doit rester
    // marginale : c'est la difference entre « trois races existent » et
    // « on les voit en jouant ».
    expect(comptes.size).toBe(3);
    for (const n of comptes.values()) {
      expect(n / autres.length).toBeGreaterThan(0.15);
    }
  }, 300_000);
});

describe("le contrat avec la carte graphique", () => {
  /**
   * Les formes et les couleurs des batiments sont choisies dans un shader,
   * c'est-a-dire dans du code que rien ici ne peut executer : ni test ni
   * compilateur ne verront une faute. Ce qu'on peut verifier, c'est que les
   * deux cotes parlent encore la meme langue — meme nom d'uniforme, memes
   * codes 0/1/2. Renommer l'un sans l'autre est l'erreur la plus facile a
   * commettre et la plus penible a diagnostiquer : a l'ecran, les batiments
   * redeviennent silencieusement identiques.
   */
  const shader = fs.readFileSync(
    path.join(
      __dirname,
      "../src/client/render/gl/shaders/structure/structure.frag.glsl",
    ),
    "utf8",
  );

  test("le shader recoit bien la faction du proprietaire", () => {
    expect(shader).toMatch(/uniform\s+highp\s+usampler2D\s+uFaction\s*;/);
    expect(shader).toMatch(/texelFetch\(\s*uFaction/);
  });

  test("les trois codes sont traites, pour la forme comme pour la couleur", () => {
    const silhouette = shader.slice(
      shader.indexOf("float factionSDF"),
      shader.indexOf("vec3 factionColor"),
    );
    const couleur = shader.slice(
      shader.indexOf("vec3 factionColor"),
      shader.indexOf("float shapeSDF"),
    );
    for (const bloc of [silhouette, couleur]) {
      expect(bloc).toContain("f == 1");
      expect(bloc).toContain("f == 2");
    }
    // Le code 0 ne doit surtout PAS avoir sa propre condition : il est le cas
    // par defaut, ce qui fait qu'un joueur dont la faction est inconnue (vieux
    // replay, version plus recente) s'affiche en Vanguard au lieu de
    // disparaitre de la carte.
    expect(silhouette).not.toContain("f == 0");
    expect(couleur).not.toContain("f == 0");
  });
});
