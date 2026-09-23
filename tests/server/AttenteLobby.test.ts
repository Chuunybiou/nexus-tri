import { afterEach, describe, expect, test } from "vitest";
import { ServerEnv } from "../../src/server/ServerEnv";

/**
 * Le compte a rebours d'un salon public.
 *
 * Notre serveur tourne en mode developpement pour desactiver les services
 * fermes d'OpenFront, et heritait au passage du compte a rebours de 5 secondes
 * prevu pour tester : la partie demarrait avant qu'on ait eu le temps de se
 * placer. NEXUS_ATTENTE_LOBBY tranche.
 */
describe("attente avant le demarrage d'un salon", () => {
  const avant = process.env.NEXUS_ATTENTE_LOBBY;

  afterEach(() => {
    if (avant === undefined) delete process.env.NEXUS_ATTENTE_LOBBY;
    else process.env.NEXUS_ATTENTE_LOBBY = avant;
  });

  test("le reglage est lu en secondes", () => {
    process.env.NEXUS_ATTENTE_LOBBY = "90";
    expect(ServerEnv.gameCreationRate()).toBe(90_000);
  });

  test("une valeur trop courte est ignoree", () => {
    process.env.NEXUS_ATTENTE_LOBBY = "1";
    expect(ServerEnv.gameCreationRate()).toBeGreaterThanOrEqual(5_000);
  });

  test("une valeur illisible est ignoree", () => {
    process.env.NEXUS_ATTENTE_LOBBY = "bientot";
    expect(ServerEnv.gameCreationRate()).toBeGreaterThanOrEqual(5_000);
  });

  test("sans reglage, le comportement d'origine est conserve", () => {
    delete process.env.NEXUS_ATTENTE_LOBBY;
    // 5 s en dev, 2 min autrement : on ne change rien tant que personne ne
    // demande.
    expect([5_000, 120_000]).toContain(ServerEnv.gameCreationRate());
  });
});
