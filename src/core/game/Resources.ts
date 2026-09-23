/**
 * Les trois ressources de faction, et l'arme qui les exige toutes.
 *
 * L'idee : chaque faction produit une matiere que les deux autres ne savent
 * pas fabriquer. L'arme ultime demande les trois. Personne ne peut donc y
 * arriver seul — il faut commercer avec les deux autres factions, et commercer
 * suppose la paix (un embargo, une attaque, et le robinet se ferme). La
 * diplomatie cesse d'etre une politesse pour devenir une condition de victoire.
 *
 * Comme Factions.ts, ce module est de la donnee pure : aucun import de l'etat
 * du jeu, aucun hasard, et des entiers partout. La simulation tourne a
 * l'identique sur chaque navigateur ; un flottant qui arrondit differemment
 * d'une machine a l'autre finit par les faire diverger.
 */
import { Faction } from "./Factions";

export enum Resource {
  /** Vanguard : uranium raffine. */
  Uranium = "URANIUM",
  /** Swarm : biomasse. */
  Biomass = "BIOMASS",
  /** Ascendant : cristal. */
  Crystal = "CRYSTAL",
}

export const ALL_RESOURCES: readonly Resource[] = [
  Resource.Uranium,
  Resource.Biomass,
  Resource.Crystal,
];

export const RESOURCE_BY_FACTION: Readonly<Record<Faction, Resource>> = {
  [Faction.Vanguard]: Resource.Uranium,
  [Faction.Swarm]: Resource.Biomass,
  [Faction.Ascendant]: Resource.Crystal,
};

/** i18n : jamais afficher l'identifiant brut. */
export const RESOURCE_NAME_KEY: Readonly<Record<Resource, string>> = {
  [Resource.Uranium]: "resources.uranium",
  [Resource.Biomass]: "resources.biomass",
  [Resource.Crystal]: "resources.crystal",
};

export const RESOURCE_RULES = {
  /**
   * Production, par seconde. Elle suit les villes : un joueur qui s'etend
   * produit plus, sans qu'on ait a inventer un batiment ni un gisement sur la
   * carte. La part fixe evite qu'un joueur sans ville soit exclu du jeu
   * diplomatique.
   */
  basePerSecond: 1,
  perCityPerSecond: 1,
  /**
   * Plafond de stock. Sans lui, un joueur prudent accumule pendant une heure
   * et sort l'arme sans avoir jamais rien risque ; avec lui, il faut etre
   * fourni par les autres AU MOMENT ou on assemble.
   */
  cap: 600,
  /** Ce qu'un bateau de commerce depose en arrivant. */
  perTradeShip: 10,
  /** Quantite de CHAQUE ressource exigee par l'arme. */
  weaponThreshold: 300,
} as const;

/** Stock d'un joueur. Toujours complet : trois cles, jamais undefined. */
export type ResourceStock = Readonly<Record<Resource, number>>;

export function emptyStock(): Record<Resource, number> {
  return {
    [Resource.Uranium]: 0,
    [Resource.Biomass]: 0,
    [Resource.Crystal]: 0,
  };
}

export function resourceOf(faction: Faction | null | undefined): Resource {
  return RESOURCE_BY_FACTION[faction ?? Faction.Vanguard];
}

/**
 * Combien des trois ressources sont au seuil (0 a 3).
 *
 * C'est le compteur que TOUT LE MONDE voit sur la fiche d'un joueur. Sans lui,
 * celui qui assemble l'arme trahit deux allies qui n'ont rien vu venir, et une
 * partie perdue sans avoir pu reagir n'est pas une partie. Avec lui, c'est du
 * suspense : chacun sait qu'il reste une ressource a empecher.
 */
export function resourcesAtThreshold(stock: ResourceStock): number {
  return ALL_RESOURCES.filter((r) => stock[r] >= RESOURCE_RULES.weaponThreshold)
    .length;
}

export function canBuildUltimateWeapon(stock: ResourceStock): boolean {
  return resourcesAtThreshold(stock) === ALL_RESOURCES.length;
}
