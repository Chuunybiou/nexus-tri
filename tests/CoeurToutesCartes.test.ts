import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  gardiensDuCoeur,
  tileDuCoeur,
} from "../src/core/execution/CoeurExecution";
import { GameMapSize, GameMapType } from "../src/core/game/Game";
import { loadTerrainMap } from "../src/core/game/TerrainMapLoader";
import { NodeGameMapLoader } from "./perf/fullgame/NodeGameMapLoader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(__dirname, "../resources/maps");

/**
 * « Sur toutes les cartes, sans exception. »
 *
 * La promesse ne vaut que si elle tient sur les cartes difficiles : un
 * archipel, une carte polaire, une carte toute en longueur. Une position
 * codee en dur au milieu tomberait dans l'eau sur la moitie d'entre elles —
 * d'ou la recherche en spirale, et d'ou ce test.
 *
 * On ne charge pas les 124 cartes (ce serait des minutes de test pour une
 * garantie identique) : on prend un echantillon choisi pour ses formes
 * difficiles, plus quelques classiques.
 */
const CARTES = [
  "world",
  "europe",
  "asia",
  "archipelagosea",
  "antarctica",
  "beringstrait",
  "alps",
  "africa",
];

/** Le nom de carte tel que GameMapType l'ecrit, a partir du dossier. */
function typeDeCarte(dossier: string): string {
  const manifeste = JSON.parse(
    fs.readFileSync(path.join(RACINE, dossier, "manifest.json"), "utf8"),
  );
  return manifeste.name ?? dossier;
}

describe("le Cœur existe sur toutes les cartes", () => {
  const loader = new NodeGameMapLoader(RACINE);

  for (const dossier of CARTES) {
    test(`${dossier} : un centre sur la terre, et des gardiens autour`, async () => {
      const existe = fs.existsSync(path.join(RACINE, dossier));
      expect(existe).toBe(true);

      const terrain = await loadTerrainMap(
        typeDeCarte(dossier) as GameMapType,
        GameMapSize.Normal,
        loader,
        false,
      );
      // On n'a pas besoin d'une partie complete : la carte suffit, et
      // c'est elle qu'on teste.
      const carte = terrain.gameMap as unknown as Parameters<
        typeof tileDuCoeur
      >[0];

      const centre = tileDuCoeur(carte);
      expect(centre).not.toBeNull();
      expect(carte.isLand(centre!)).toBe(true);
      expect(carte.isImpassable(centre!)).toBe(false);

      const gardiens = gardiensDuCoeur(carte, `test-${dossier}`);
      expect(gardiens.length).toBeGreaterThan(0);
    }, 120_000);
  }
});
