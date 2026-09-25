import {
  Execution,
  Game,
  Player,
  PlayerID,
  PlayerInfo,
  PlayerType,
  Unit,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { PseudoRandom } from "../PseudoRandom";
import { simpleHash } from "../Util";
import { NukeExecution } from "./NukeExecution";

/**
 * Le Cœur : une zone neutre et figee au centre de chaque carte.
 *
 * L'idee vient de Travian : au milieu de la carte, un territoire gris qui
 * n'appartient a aucun joueur, qui ne grandit pas et ne recule pas. Il n'est
 * pas la pour etre pris — il est la pour exister : il coupe la carte en deux,
 * oblige a contourner, et donne a tout le monde le meme repere.
 *
 * Le cercle couvre un dixieme de la carte, sur TOUTES les cartes : son rayon
 * est calcule au demarrage a partir des dimensions reelles, donc une carte
 * large et une carte etroite ont chacune leur Cœur a la bonne echelle.
 *
 * Trois regles, et chacune repare un probleme constate en mesurant une vraie
 * partie :
 *
 * 1. Le territoire existe DES LE DEPART, pose pendant la phase de choix des
 *    positions — sinon un joueur se place au centre et le Cœur ne peut plus
 *    naitre.
 * 2. Il ne s'etend pas. Les robots du jeu conquierent tout ce qu'ils peuvent :
 *    la version precedente, faite de six robots ordinaires, tenait 36 000
 *    cases au bout d'une minute, c'est-a-dire toute la carte.
 * 3. Il ne recule pas. Ce qui lui est pris lui est rendu a la seconde
 *    suivante. C'est ce qui en fait un decor stable et non un adversaire de
 *    plus.
 *
 * Il n'est pas inoffensif pour autant : insister contre lui coute cher. Une
 * attaque sur trois, il tire une bombe atomique sur un point au hasard du
 * territoire de celui qui s'acharne (voir subirUneAttaque).
 */

/**
 * Part de la carte couverte par le cercle du Cœur, en pour mille.
 *
 * Une seule valeur commande toute la taille de la zone, et les tests la lisent
 * ici plutot que de recopier le chiffre : la changer suffit, rien d'autre a
 * retoucher. A 200 (un cinquieme), le cercle avalait le centre de l'Europe ;
 * a 100, il reste un obstacle franc sans manger la partie.
 */
export const PART_DE_LA_CARTE_POUR_MILLE = 100;

/**
 * Garnison du Cœur. Elle ne sert pas a se battre — les attaques qui le visent
 * sont deja arretees avant de partir — mais a le dire : au classement, le Cœur
 * apparait pour ce qu'il est, une masse qu'on ne prend pas.
 */
const TROUPES_DU_COEUR = 2_000_000;

/**
 * Nombre d'attaques qu'il faut tenter contre le Cœur avant qu'il ne riposte.
 * La premiere et la deuxieme ne coutent rien : c'est un avertissement. La
 * troisieme part en bombe.
 */
const ATTAQUES_AVANT_RIPOSTE = 3;

/**
 * Reserve d'or du Cœur, rechargee chaque seconde. Construire un silo et tirer
 * une bombe se paie comme pour tout le monde ; le Cœur n'a simplement jamais
 * de probleme d'argent.
 */
const OR_DU_COEUR = 100_000_000n;

/** Identifiant et nom du joueur qui tient le centre (sert aussi a le colorier). */
export const ID_DU_COEUR = "le-coeur";
export const NOM_DU_COEUR = "Le Cœur";

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
 * Le Cœur de la partie en cours, retrouvable depuis n'importe ou.
 *
 * AttackExecution doit pouvoir lui signaler une attaque, et les deux vivent
 * dans la simulation sans se connaitre. Une table indexee par la partie evite
 * a la fois une variable globale (qui melangerait deux parties du meme
 * serveur) et un detour par le moteur.
 */
const COEURS = new WeakMap<Game, CoeurExecution>();

/** Le Cœur de cette partie, s'il a ete pose. */
export function coeurDeLaPartie(mg: Game): CoeurExecution | undefined {
  return COEURS.get(mg);
}

export class CoeurExecution implements Execution {
  private mg: Game | null = null;
  private zone: TileRef[] = [];
  private dedans = new Set<TileRef>();
  private posee = false;
  private silo: Unit | null = null;
  /** Combien de fois chaque joueur a deja essaye de l'attaquer. */
  private tentatives = new Map<PlayerID, number>();
  /** Les joueurs a qui une bombe est due, servis au prochain tour. */
  private aRiposter: PlayerID[] = [];

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
    COEURS.set(mg, this);
  }

  tick(ticks: number): void {
    const mg = this.mg;
    if (mg === null) return;

    if (!this.posee) {
      this.poser(mg);
      return;
    }
    // Les bombes partent d'ici, et surtout pas de subirUneAttaque().
    //
    // Piege du moteur, paye pour le savoir : une execution ajoutee depuis
    // l'init() d'une autre execution est PERDUE. La boucle qui initialise ne
    // voit pas ce qu'on lui ajoute en cours de route, et la liste est ensuite
    // remplacee par celle des executions restantes. Depuis un tick(), en
    // revanche, l'ajout est bien pris.
    this.servirLesRipostes(mg);
    // Une fois par seconde suffit : la zone fait des dizaines de milliers de
    // cases, la parcourir dix fois par seconde couterait cher pour rien.
    if (ticks % 10 === 0) this.tenir(mg);
  }

  /**
   * Pose la zone : un cercle centre sur la carte, dont l'aire vaut la part
   * voulue de la carte entiere. Le rayon se calcule d'un coup (aire = pi r2),
   * puis un seul balayage de la boite du cercle donne au Cœur toute la terre
   * qu'il contient. L'ordre de lecture est fixe, donc chaque client obtient
   * exactement la meme zone.
   */
  private poser(mg: Game): void {
    this.posee = true;
    const centre = tileDuCoeur(mg);
    if (centre === null) return;
    const cx = mg.x(centre);
    const cy = mg.y(centre);

    const aire =
      (mg.width() * mg.height() * PART_DE_LA_CARTE_POUR_MILLE) / 1000;
    const rayon = Math.round(Math.sqrt(aire / Math.PI));
    if (rayon <= 0) return;

    mg.addPlayer(
      new PlayerInfo(NOM_DU_COEUR, PlayerType.Bot, null, ID_DU_COEUR),
    );
    const coeur = mg.player(ID_DU_COEUR);
    coeur.setTroops(TROUPES_DU_COEUR);

    const rayonCarre = rayon * rayon;
    const yMin = Math.max(0, cy - rayon);
    const yMax = Math.min(mg.height() - 1, cy + rayon);
    const xMin = Math.max(0, cx - rayon);
    const xMax = Math.min(mg.width() - 1, cx + rayon);
    for (let y = yMin; y <= yMax; y++) {
      const dy = y - cy;
      for (let x = xMin; x <= xMax; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy > rayonCarre) continue;
        const tile = mg.ref(x, y);
        if (!mg.isLand(tile) || mg.isImpassable(tile)) continue;
        coeur.conquer(tile);
        this.zone.push(tile);
        this.dedans.add(tile);
      }
    }

    // Le silo d'ou partiront les ripostes. Il est bati directement, sans passer
    // par un chantier : le Cœur existe deja fini au premier tick.
    coeur.addGold(OR_DU_COEUR);
    this.silo = coeur.buildUnit(UnitType.MissileSilo, centre, {});
  }

  /** Rend au Cœur ce qu'on lui a pris, et lui reprend ce qu'il tient hors zone. */
  private tenir(mg: Game): void {
    if (this.zone.length === 0) return;
    if (!mg.hasPlayer(ID_DU_COEUR)) return;
    const coeur = mg.player(ID_DU_COEUR);
    // La garnison ne fond pas et ne grossit pas : deux millions, toujours.
    if (coeur.troops() !== TROUPES_DU_COEUR) coeur.setTroops(TROUPES_DU_COEUR);

    // De quoi tirer, toujours : la caisse est remise a niveau et le silo ne
    // reste jamais en rechargement. Sans cela, un joueur qui s'acharne vite
    // finirait par attaquer gratuitement.
    if (coeur.gold() < OR_DU_COEUR) coeur.addGold(OR_DU_COEUR - coeur.gold());
    const silo = this.siloPret(mg, coeur);
    if (silo !== null) {
      while (silo.isInCooldown()) silo.reloadMissile();
    }

    for (const tile of this.zone) {
      if (mg.owner(tile) !== coeur) coeur.conquer(tile);
    }

    // Une conquete de sa part le ferait deborder : on ne garde que le cercle.
    if (coeur.numTilesOwned() > this.zone.length) {
      const dehors: TileRef[] = [];
      coeur.tiles().forEach((tile) => {
        if (!this.dedans.has(tile)) dehors.push(tile);
      });
      for (const tile of dehors) coeur.relinquish(tile);
    }
  }

  /**
   * Signale une attaque lancee contre le Cœur. Appele par AttackExecution, qui
   * arrete l'attaque avant qu'elle ne coute une seule troupe : ce compteur est
   * donc le seul prix a payer, et il monte vite.
   */
  subirUneAttaque(attaquant: Player): void {
    const mg = this.mg;
    if (mg === null || !this.posee) return;
    if (!mg.hasPlayer(ID_DU_COEUR)) return;

    const compte = (this.tentatives.get(attaquant.id()) ?? 0) + 1;
    if (compte < ATTAQUES_AVANT_RIPOSTE) {
      this.tentatives.set(attaquant.id(), compte);
      return;
    }
    // Le compteur repart de zero : la riposte suivante demandera trois
    // nouvelles tentatives, pas une seule.
    this.tentatives.set(attaquant.id(), 0);
    // On ne tire pas tout de suite : voir le commentaire dans tick().
    this.aRiposter.push(attaquant.id());
  }

  /** Tire les bombes dues depuis la derniere fois. */
  private servirLesRipostes(mg: Game): void {
    if (this.aRiposter.length === 0) return;
    const dus = this.aRiposter;
    this.aRiposter = [];
    for (const id of dus) {
      if (!mg.hasPlayer(id)) continue;
      this.riposter(mg, mg.player(id));
    }
  }

  /** Une bombe atomique sur un point tire au hasard chez l'attaquant. */
  private riposter(mg: Game, attaquant: Player): void {
    const coeur = mg.player(ID_DU_COEUR);
    const silo = this.siloPret(mg, coeur);
    if (silo === null) return;
    while (silo.isInCooldown()) silo.reloadMissile();

    const cible = this.cibleChez(mg, attaquant);
    if (cible === null) return;

    if (coeur.gold() < OR_DU_COEUR) coeur.addGold(OR_DU_COEUR - coeur.gold());
    mg.addExecution(new NukeExecution(UnitType.AtomBomb, coeur, cible));
  }

  /**
   * Un point au hasard du territoire de l'attaquant.
   *
   * Le tirage doit tomber sur la meme case chez le serveur et chez chaque
   * client, sinon les parties divergent : il vient donc du tour de jeu et de
   * l'identifiant de l'attaquant, jamais de Math.random. Les cases d'un joueur
   * sont rangees dans leur ordre d'acquisition, le meme partout.
   */
  private cibleChez(mg: Game, attaquant: Player): TileRef | null {
    const total = attaquant.numTilesOwned();
    if (total === 0) return null;
    const des = new PseudoRandom(mg.ticks() + simpleHash(attaquant.id()));
    const voulu = des.nextInt(0, total);

    let i = 0;
    let choisie: TileRef | null = null;
    for (const tile of attaquant.tiles()) {
      if (i === voulu) {
        choisie = tile;
        break;
      }
      i++;
    }
    if (choisie === null) return null;
    // Une case infranchissable ne peut pas etre bombardee : on retombe alors
    // sur la premiere case praticable plutot que d'annuler la riposte.
    if (!mg.isImpassable(choisie)) return choisie;
    for (const tile of attaquant.tiles()) {
      if (!mg.isImpassable(tile)) return tile;
    }
    return null;
  }

  /** Le silo du Cœur, rebati s'il a disparu. */
  private siloPret(mg: Game, coeur: Player): Unit | null {
    if (this.silo !== null && this.silo.isActive()) return this.silo;
    const centre = tileDuCoeur(mg);
    if (centre === null) return null;
    if (coeur.gold() < OR_DU_COEUR) coeur.addGold(OR_DU_COEUR - coeur.gold());
    this.silo = coeur.buildUnit(UnitType.MissileSilo, centre, {});
    return this.silo;
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    // Indispensable : la zone doit exister avant que les joueurs ne choisissent
    // leur point de depart, sinon quelqu'un se pose au milieu.
    return true;
  }
}
