import { Execution, Game, PlayerInfo, PlayerType } from "../game/Game";
import { TileRef } from "../game/GameMap";

/**
 * Le Cœur : une zone neutre et figee au centre de chaque carte.
 *
 * L'idee vient de Travian : au milieu de la carte, un territoire gris qui
 * n'appartient a aucun joueur, qui ne grandit pas et ne recule pas. Il n'est
 * pas la pour etre pris — il est la pour exister : il coupe la carte en deux,
 * oblige a contourner, et donne a tout le monde le meme repere.
 *
 * Le cercle couvre 20 % de la carte, sur TOUTES les cartes : son rayon est
 * calcule au demarrage a partir des dimensions reelles, donc une carte large
 * et une carte etroite ont chacune leur Cœur a la bonne echelle.
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
 */

/** Part de la carte couverte par le cercle du Cœur, en pour mille. */
const PART_DE_LA_CARTE_POUR_MILLE = 200;

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

export class CoeurExecution implements Execution {
  private mg: Game | null = null;
  private zone: TileRef[] = [];
  private dedans = new Set<TileRef>();
  private posee = false;

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    const mg = this.mg;
    if (mg === null) return;

    if (!this.posee) {
      this.poser(mg);
      return;
    }
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
  }

  /** Rend au Cœur ce qu'on lui a pris, et lui reprend ce qu'il tient hors zone. */
  private tenir(mg: Game): void {
    if (this.zone.length === 0) return;
    if (!mg.hasPlayer(ID_DU_COEUR)) return;
    const coeur = mg.player(ID_DU_COEUR);

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

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    // Indispensable : la zone doit exister avant que les joueurs ne choisissent
    // leur point de depart, sinon quelqu'un se pose au milieu.
    return true;
  }
}
