import { buildAssetUrl, workerAssetBase } from "../src/core/AssetUrls";

/**
 * Le fil de calcul du jeu tourne depuis une adresse `blob:` (le worker est
 * embarque dans le paquet). Une adresse `blob:` ne peut pas servir de base :
 * `fetch("/_assets/...")` y echoue avec « Failed to parse URL », et la partie
 * reste bloquee sur « La partie est en train de commencer... ».
 *
 * Le bug ne se voit pas sur un serveur avec CDN, ou toutes les adresses sont
 * deja absolues — d'ou ces tests, qui decrivent le cas SANS CDN.
 */
describe("base d'adresses du fil de calcul", () => {
  test("sans CDN, on prend l'origine de la page", () => {
    expect(workerAssetBase("", "http://51.79.241.226:8080")).toBe(
      "http://51.79.241.226:8080",
    );
  });

  test("avec un CDN, on garde le CDN", () => {
    expect(workerAssetBase("https://cdn.exemple.net", "http://page")).toBe(
      "https://cdn.exemple.net",
    );
  });

  test("l'adresse d'une carte devient absolue", () => {
    const manifest = {
      "maps/world/manifest.json": "/_assets/maps/world/manifest.abc123.json",
    };
    const base = workerAssetBase("", "http://51.79.241.226:8080");
    const url = buildAssetUrl("maps/world/manifest.json", manifest, base);

    expect(url).toBe(
      "http://51.79.241.226:8080/_assets/maps/world/manifest.abc123.json",
    );
    // Le controle qui compte : cette adresse doit etre utilisable telle quelle,
    // sans base. C'est exactement ce que fait fetch() dans le worker.
    expect(() => new URL(url)).not.toThrow();
  });

  test("sans base, l'adresse reste relative et casse dans un blob", () => {
    const manifest = {
      "maps/world/manifest.json": "/_assets/maps/world/manifest.abc123.json",
    };
    const url = buildAssetUrl("maps/world/manifest.json", manifest, "");
    expect(() => new URL(url)).toThrow();
  });
});
