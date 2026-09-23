// Nexus Tri est une version modifiee d'OpenFront. Le service en ligne d'OpenFront
// (comptes, boutique, inventaire, classement, clans, cosmetiques, Steam, actualites)
// est ferme : il ne fait pas partie du code libre et n'a pas d'equivalent ici. Ces
// entrees sont donc masquees plutot que de repondre par une erreur sous le doigt du
// joueur -- le client appelait `api.<domaine>`, qui n'existe pas pour ce serveur.
//
// Ce qui fonctionne sans lui : le solo, et les parties publiques et privees servies
// par CE serveur (les intentions transitent par lui, la partie tourne chez chaque
// joueur).
//
// Repasser a true le jour ou un service equivalent existe.
export const SERVICES_DE_COMPTE = false;
