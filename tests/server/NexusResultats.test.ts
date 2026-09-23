import { describe, expect, it } from "vitest";
import type { PartialGameRecord } from "../../src/core/Schemas";
import { messageDePartie } from "../../src/server/nexus/Resultats";

// Regle Nexus Tri : le classement ne compte QUE les parties entre humains.

function partie(
  joueurs: { clientID: string; persistentID: string }[],
  winner?: PartialGameRecord["info"]["winner"],
): PartialGameRecord {
  return {
    info: { players: joueurs, winner },
  } as unknown as PartialGameRecord;
}

describe("resultats Nexus Tri", () => {
  it("ignore une partie a un seul humain (solo ou contre des robots)", () => {
    expect(
      messageDePartie(partie([{ clientID: "c1", persistentID: "p1" }])),
    ).toBeNull();
  });

  it("retient le gagnant d'un duel entre humains", () => {
    const msg = messageDePartie(
      partie(
        [
          { clientID: "c1", persistentID: "p1" },
          { clientID: "c2", persistentID: "p2" },
        ],
        ["player", "c2"],
      ),
    );
    expect(msg?.joueurs).toEqual(["p1", "p2"]);
    expect(msg?.gagnants).toEqual(["p2"]);
  });

  it("retient toute l'equipe gagnante", () => {
    const msg = messageDePartie(
      partie(
        [
          { clientID: "c1", persistentID: "p1" },
          { clientID: "c2", persistentID: "p2" },
          { clientID: "c3", persistentID: "p3" },
        ],
        ["team", "Rouge", "c1", "c3"],
      ),
    );
    expect(msg?.gagnants).toEqual(["p1", "p3"]);
  });

  it("compte la participation quand une nation non humaine l'emporte", () => {
    const msg = messageDePartie(
      partie(
        [
          { clientID: "c1", persistentID: "p1" },
          { clientID: "c2", persistentID: "p2" },
        ],
        ["nation", "France"],
      ),
    );
    expect(msg?.joueurs).toHaveLength(2);
    expect(msg?.gagnants).toEqual([]);
  });
});
