import { getCdnBase } from "../AssetUrls";
import {
  BuildableUnit,
  Cell,
  PlayerActions,
  PlayerBorderTiles,
  PlayerBuildableUnitType,
  PlayerID,
  PlayerProfile,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { ErrorUpdate, GameUpdateViewData } from "../game/GameUpdates";
import { ClientID, GameStartInfo, Turn } from "../Schemas";
import { generateID } from "../Util";
import { WorkerMessage } from "./WorkerMessages";

// Inlined as a same-origin Blob (Vite's `?worker&inline`), sidestepping the
// cross-origin `new Worker(url)` restriction that would otherwise apply when
// the worker bundle is served from the CDN. The dynamic import keeps the
// ~700 KB base64 payload in its own chunk, fetched when a game starts,
// instead of inside the main bundle.
async function createGameWorker(): Promise<Worker> {
  const { default: GameWorker } =
    await import("./Worker.worker.ts?worker&inline");
  return new GameWorker();
}

export class WorkerClient {
  private worker: Worker | null = null;
  private isInitialized = false;
  private messageHandlers: Map<string, (message: WorkerMessage) => void>;
  private gameUpdateCallback?: (
    update: GameUpdateViewData | ErrorUpdate,
  ) => void;
  /**
   * Derniere etape franchie par la preparation de la partie.
   *
   * Sert au message d'attente : « bloque a l'etape carte » se diagnostique,
   * « delai depasse » ne se diagnostique pas.
   */
  private derniereEtape = "aucune";

  constructor(
    private gameStartInfo: GameStartInfo,
    private clientID: ClientID | undefined,
  ) {
    this.messageHandlers = new Map();
  }

  private handleWorkerMessage(event: MessageEvent<WorkerMessage>) {
    const message = event.data;

    switch (message.type) {
      case "game_update":
        if (this.gameUpdateCallback && message.gameUpdate) {
          this.gameUpdateCallback(message.gameUpdate);
        }
        break;
      case "game_update_batch":
        if (this.gameUpdateCallback && message.gameUpdates) {
          for (const gu of message.gameUpdates) {
            this.gameUpdateCallback(gu);
          }
        }
        break;
      case "game_error":
        if (this.gameUpdateCallback && message.error) {
          this.gameUpdateCallback(message.error);
        }
        break;

      // Traite a part : plusieurs etapes arrivent pour un meme identifiant, et
      // le gestionnaire ci-dessous est retire des qu'il a servi une fois.
      case "init_step":
        this.derniereEtape = message.step;
        break;

      case "initialized":
      default:
        if (message.id && this.messageHandlers.has(message.id)) {
          const handler = this.messageHandlers.get(message.id)!;
          handler(message);
          this.messageHandlers.delete(message.id);
        }
        break;
    }
  }

  async initialize(): Promise<void> {
    const worker = await createGameWorker();
    this.worker = worker;
    worker.addEventListener("message", this.handleWorkerMessage.bind(this));

    return new Promise((resolve, reject) => {
      const messageId = generateID();

      // Un fil de calcul qui meurt au chargement (import manquant, erreur au
      // niveau du module) ne repond simplement jamais : sans cette ecoute, on
      // attend soixante secondes pour un « timeout » qui cache la vraie
      // erreur. Elle est deja ecrite dans la console du navigateur, mais le
      // joueur, lui, ne la voit pas.
      worker.addEventListener("error", (event) => {
        const where = event.filename
          ? ` (${event.filename}:${event.lineno})`
          : "";
        reject(
          new Error(
            `Le moteur du jeu n'a pas pu demarrer : ${event.message}${where}`,
          ),
        );
      });
      worker.addEventListener("messageerror", () => {
        reject(
          new Error(
            "Le moteur du jeu n'a pas pu lire les donnees de la partie.",
          ),
        );
      });

      this.messageHandlers.set(messageId, (message) => {
        if (message.type === "initialized") {
          this.isInitialized = true;
          resolve();
        } else if (message.type === "init_error") {
          // La vraie cause, plutot que le delai d'attente de soixante
          // secondes qui suivrait sans ca.
          reject(
            new Error(`La partie n'a pas pu demarrer : ${message.message}`),
          );
        }
      });

      worker.postMessage({
        type: "init",
        id: messageId,
        gameStartInfo: this.gameStartInfo,
        clientID: this.clientID,
        cdnBase: getCdnBase(),
      });

      setTimeout(() => {
        if (!this.isInitialized) {
          this.messageHandlers.delete(messageId);
          reject(
            new Error(
              `Le moteur du jeu ne repond plus (bloque a l'etape : ${this.derniereEtape}).`,
            ),
          );
        }
      }, 60000);
    });
  }

  start(gameUpdate: (gu: GameUpdateViewData | ErrorUpdate) => void) {
    if (!this.isInitialized) {
      throw new Error("Failed to initialize pathfinder");
    }
    this.gameUpdateCallback = gameUpdate;
  }

  sendTurn(turn: Turn) {
    if (!this.isInitialized) {
      throw new Error("Worker not initialized");
    }

    this.worker!.postMessage({
      type: "turn",
      turn,
    });
  }

  playerProfile(playerID: number): Promise<PlayerProfile> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const messageId = generateID();

      this.messageHandlers.set(messageId, (message) => {
        if (
          message.type === "player_profile_result" &&
          message.result !== undefined
        ) {
          resolve(message.result);
        }
      });

      this.worker!.postMessage({
        type: "player_profile",
        id: messageId,
        playerID: playerID,
      });
    });
  }

  playerBorderTiles(playerID: PlayerID): Promise<PlayerBorderTiles> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const messageId = generateID();

      this.messageHandlers.set(messageId, (message) => {
        if (
          message.type === "player_border_tiles_result" &&
          message.result !== undefined
        ) {
          resolve(message.result);
        }
      });

      this.worker!.postMessage({
        type: "player_border_tiles",
        id: messageId,
        playerID: playerID,
      });
    });
  }

  playerInteraction(
    playerID: PlayerID,
    x?: number,
    y?: number,
    units?: readonly PlayerBuildableUnitType[] | null,
  ): Promise<PlayerActions> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const messageId = generateID();

      this.messageHandlers.set(messageId, (message) => {
        if (
          message.type === "player_actions_result" &&
          message.result !== undefined
        ) {
          resolve(message.result);
        }
      });

      this.worker!.postMessage({
        type: "player_actions",
        id: messageId,
        playerID,
        x,
        y,
        units,
      });
    });
  }

  playerBuildables(
    playerID: PlayerID,
    x?: number,
    y?: number,
    units?: readonly PlayerBuildableUnitType[],
  ): Promise<BuildableUnit[]> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const messageId = generateID();

      this.messageHandlers.set(messageId, (message) => {
        if (
          message.type === "player_buildables_result" &&
          message.result !== undefined
        ) {
          resolve(message.result);
        }
      });

      this.worker!.postMessage({
        type: "player_buildables",
        id: messageId,
        playerID,
        x,
        y,
        units,
      });
    });
  }

  attackClusteredPositions(
    playerID: number,
    attackID?: string,
  ): Promise<{ id: string; positions: Cell[] }[]> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const messageId = generateID();

      const timeout = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        reject(new Error("attack_clustered_positions request timed out"));
      }, 5000);

      this.messageHandlers.set(messageId, (message) => {
        clearTimeout(timeout);
        if (message.type !== "attack_clustered_positions_result") {
          reject(
            new Error(
              `Unexpected message type for attackClusteredPositions: ${message.type}`,
            ),
          );
          return;
        }
        resolve(
          message.attacks.map((a) => ({
            id: a.id,
            positions: a.positions.map((c) => new Cell(c.x, c.y)),
          })),
        );
      });

      this.worker!.postMessage({
        type: "attack_clustered_positions",
        id: messageId,
        playerID,
        attackID,
      });
    });
  }

  transportShipSpawn(
    playerID: PlayerID,
    targetTile: TileRef,
  ): Promise<TileRef | false> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const messageId = generateID();

      this.messageHandlers.set(messageId, (message) => {
        if (
          message.type === "transport_ship_spawn_result" &&
          message.result !== undefined
        ) {
          resolve(message.result);
        }
      });

      this.worker!.postMessage({
        type: "transport_ship_spawn",
        id: messageId,
        playerID: playerID,
        targetTile: targetTile,
      });
    });
  }

  cleanup() {
    this.worker?.terminate();
    this.messageHandlers.clear();
    this.gameUpdateCallback = undefined;
  }
}
