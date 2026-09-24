import { Faction } from "../game/Factions";
import {
  Execution,
  Game,
  MessageType,
  Player,
  PlayerInfo,
  PlayerType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { ALL_RESOURCES, resourceOf } from "../game/Resources";
import { PseudoRandom } from "../PseudoRandom";
import { GameID } from "../Schemas";
import { simpleHash } from "../Util";
import { SpawnExecution } from "./SpawnExecution";

/**
 * Le Cœur : le centre de la carte, tenu par des gardiens.
 *
 * L'idee vient de Travian : au milieu de la carte, une zone gardee qui vaut
 * la peine d'etre prise. Ici elle sert de contrepoids a la diplomatie — le
 * systeme des trois ressources (voir Resources.ts) oblige normalement a
 * commercer avec les deux autres factions ; le Cœur est l'autre chemin, celui
 * qu'on prend par la force.
 *
 * Sur TOUTES les cartes, sans exception : le centre est cherche au moment ou
 * la partie demarre, et la recherche descend en spirale jusqu'a trouver une
 * terre. Une carte en archipel ou toute en longueur a donc son Cœur, la ou
 * une position codee en dur n'aurait marche que sur une carte ronde.
 *
 * Deterministe : la recherche est un balayage ordonne, les gardiens sont
 * places a des angles fixes, et rien ne depend du hasard cote client.
 */

/** Combien de gardiens en cercle autour du centre. */
const NOMBRE_GARDIENS = 6;

/** Rayon du cercle, en part de la plus petite dimension de la carte. */
const RAYON_PAR_MILLE = 90;

/** Ressources versees chaque seconde a qui tient le centre. */
const PRIME_PAR_SECONDE = 2;

/**
 * Garnison permanente de chaque gardien.
 *
 * Elle est RETABLIE chaque seconde, et c'est indispensable : dans ce jeu, la
 * taille d'une armee suit la taille du territoire. Un gardien tenu en laisse
 * sur un petit anneau devient donc tres faible, et une mesure sur une vraie
 * partie a montre les six se faire manger par les nations en moins d'une
 * minute — le cercle disparaissait avant qu'un joueur l'atteigne.
 *
 * Avec la garnison, le Cœur se prend a plusieurs ou pas du tout.
 */
const GARNISON_GARDIEN = 5000;

/**
 * Rayon du fief de chaque gardien, autour de son point de depart.
 *
 * C'est ce qui fait la difference entre « six robots de plus » et « un cercle
 * garde au centre ». Sans cette laisse, l'intelligence des robots les fait
 * s'etendre comme les autres : une mesure sur une vraie partie a montre six
 * gardiens tenant 36 000 cases.
 *
 * Attachee au gardien et non au centre : une laisse autour du centre laissait
 * un disque immense, et les six se rejoignaient en une tache au lieu de six
 * postes en cercle.
 */
const RAYON_FIEF = 28;

/** Le nom qui identifie un gardien, aussi bien a l'ecran que dans le code. */
export const PREFIXE_GARDIEN = "Gardien";

/**
 * Les six directions du cercle, en millièmes, calculees a la main.
 *
 * Surtout pas de Math.cos / Math.sin : ces fonctions ne rendent pas le meme
 * chiffre d'un moteur JavaScript a l'autre, et la simulation tourne a
 * l'identique sur chaque navigateur. Deux joueurs auraient pu voir les
 * gardiens a des endroits differents — et la partie aurait diverge.
 */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1000, 0],
  [500, 866],
  [-500, 866],
  [-1000, 0],
  [-500, -866],
  [500, -866],
];

/** Cherche la terre la plus proche du centre geometrique de la carte. */
export function tileDuCoeur(mg: Game): TileRef | null {
  const cx = Math.floor(mg.width() / 2);
  const cy = Math.floor(mg.height() / 2);
  const portee = Math.max(mg.width(), mg.height());

  for (let rayon = 0; rayon < portee; rayon++) {
    // Balayage du carre de ce rayon, dans un ordre fixe : deux clients
    // trouvent forcement le meme point.
    for (let dy = -rayon; dy <= rayon; dy++) {
      for (let dx = -rayon; dx <= rayon; dx++) {
        // Seulement le bord du carre : l'interieur a deja ete vu.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rayon) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!mg.isValidCoord(x, y)) continue;
        const tile = mg.ref(x, y);
        if (mg.isLand(tile) && !mg.isImpassable(tile)) return tile;
      }
    }
  }
  return null;
}

/**
 * Les gardiens du Cœur : des robots poses en cercle autour du centre.
 *
 * Ils ne sont pas comptes dans le nombre de robots de la partie : ce sont des
 * adversaires de terrain, pas du remplissage.
 */
export function gardiensDuCoeur(mg: Game, gameID: GameID): SpawnExecution[] {
  const centre = tileDuCoeur(mg);
  if (centre === null) return [];

  const rayon = Math.max(
    6,
    Math.floor((Math.min(mg.width(), mg.height()) * RAYON_PAR_MILLE) / 1000),
  );
  const cx = mg.x(centre);
  const cy = mg.y(centre);
  const random = new PseudoRandom(simpleHash(gameID) + 7);
  const spawns: SpawnExecution[] = [];

  for (let i = 0; i < NOMBRE_GARDIENS; i++) {
    const [dx, dy] = DIRECTIONS[i % DIRECTIONS.length];
    const vise = trouverTerre(
      mg,
      cx + Math.round((rayon * dx) / 1000),
      cy + Math.round((rayon * dy) / 1000),
    );
    if (vise === null) continue;
    spawns.push(
      new SpawnExecution(
        gameID,
        new PlayerInfo(
          `${PREFIXE_GARDIEN} ${i + 1}`,
          PlayerType.Bot,
          null,
          random.nextID(),
        ),
        vise,
      ),
    );
  }
  return spawns;
}

/** La terre libre la plus proche d'un point vise (petite spirale). */
function trouverTerre(mg: Game, x: number, y: number): TileRef | null {
  for (let rayon = 0; rayon <= 12; rayon++) {
    for (let dy = -rayon; dy <= rayon; dy++) {
      for (let dx = -rayon; dx <= rayon; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rayon) continue;
        const px = x + dx;
        const py = y + dy;
        if (!mg.isValidCoord(px, py)) continue;
        const tile = mg.ref(px, py);
        if (mg.isLand(tile) && !mg.isImpassable(tile) && !mg.hasOwner(tile)) {
          return tile;
        }
      }
    }
  }
  return null;
}

/**
 * Ce que rapporte le Cœur, et qui le tient.
 *
 * Le centre verse chaque seconde les DEUX ressources que son proprietaire ne
 * sait pas produire. C'est exactement ce que le commerce apporte : tenir le
 * Cœur, c'est se passer d'allies — et devenir la cible de tout le monde, ce
 * que le message de prise rend public.
 */
export class CoeurExecution implements Execution {
  private mg: Game | null = null;
  private centre: TileRef | null = null;
  private proprietaire: Player | null = null;

  /** Point d'ancrage de chaque gardien : sa premiere case connue. */
  private ancres = new Map<string, TileRef>();

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
    this.centre = tileDuCoeur(mg);
  }

  /**
   * Ramene chaque gardien dans son anneau.
   *
   * Les gardiens sont des robots : leur intelligence les pousse a conquerir
   * toute la carte comme n'importe quel robot. On leur reprend donc ce qu'ils
   * prennent trop loin du centre. Resultat : un cercle qui reste un cercle.
   */
  private tenirLAnneau(mg: Game): void {
    const limite = RAYON_FIEF * RAYON_FIEF;
    for (const joueur of mg.players()) {
      if (!joueur.name().startsWith(PREFIXE_GARDIEN)) continue;

      // L'ancre est la premiere case qu'on lui connait : elle ne bouge plus,
      // sinon le fief deriverait avec les conquetes du robot.
      const connue = this.ancres.get(joueur.id());
      let ancre: TileRef;
      if (connue !== undefined) {
        ancre = connue;
      } else {
        const premiere: TileRef | undefined = joueur
          .tiles()
          .values()
          .next().value;
        if (premiere === undefined) continue;
        ancre = premiere;
        this.ancres.set(joueur.id(), ancre);
      }
      const ax = mg.x(ancre);
      const ay = mg.y(ancre);

      const trop: TileRef[] = [];
      joueur.tiles().forEach((tile) => {
        const dx = mg.x(tile) - ax;
        const dy = mg.y(tile) - ay;
        if (dx * dx + dy * dy > limite) trop.push(tile);
      });
      for (const tile of trop) joueur.relinquish(tile);
    }
  }

  /** Retablit la garnison de chaque gardien, chaque seconde. */
  private renforcer(mg: Game): void {
    for (const joueur of mg.players()) {
      if (!joueur.name().startsWith(PREFIXE_GARDIEN)) continue;
      const manque = GARNISON_GARDIEN - joueur.troops();
      if (manque > 0) joueur.addTroops(manque);
    }
  }

  tick(ticks: number): void {
    if (ticks % 10 !== 0) return; // une fois par seconde
    const mg = this.mg;
    const centre = this.centre;
    if (mg === null || centre === null) return;
    this.renforcer(mg);
    this.tenirLAnneau(mg);

    const owner = mg.owner(centre);
    if (!owner.isPlayer()) {
      this.proprietaire = null;
      return;
    }
    const joueur = owner as Player;

    // Changement de main : tout le monde doit le savoir, c'est ce qui fait du
    // Cœur un enjeu et pas un cadeau discret.
    if (this.proprietaire?.id() !== joueur.id()) {
      this.proprietaire = joueur;
      mg.displayMessage(
        "events_display.coeur_pris",
        MessageType.CONQUERED_PLAYER,
        null,
        undefined,
        { player: joueur.displayName() },
        undefined,
        joueur.id(),
      );
    }

    if (joueur.type() === PlayerType.Bot) return; // les gardiens ne capitalisent pas
    const sienne = resourceOf(joueur.faction() as Faction);
    for (const ressource of ALL_RESOURCES) {
      if (ressource === sienne) continue;
      joueur.addResource(ressource, PRIME_PAR_SECONDE);
    }
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    // Personne ne tient le centre avant d'avoir un territoire.
    return false;
  }
}
