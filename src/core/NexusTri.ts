// Starfall est une version modifiee d'OpenFront. Le service en ligne d'OpenFront
// (comptes, boutique, inventaire, classement, clans, cosmetiques, Steam, actualites)
// est ferme : il ne fait pas partie du code libre et n'a pas d'equivalent ici.
//
// Ce drapeau est lu par le client ET par le serveur. Tant qu'il vaut false :
//  - les entrees d'interface qui dependent d'un compte sont masquees
//    (voir src/client/NexusTri.ts et les barres de navigation) ;
//  - AUCUNE partie publique n'est creee « reservee aux joueurs de confiance ».
//    Ce statut ne s'obtenait que via le service ferme : une partie sur sept
//    devenait donc injouable pour tout le monde, cadenas a l'appui (constate
//    par Anthony le 23/09/2026). Le mecanisme reste dans le code, intact, pour
//    le jour ou un service de comptes existera.
//
// Tout doit rester jouable sans compte. Un compte, quand il existera, ajoutera
// (sauvegarde, classement) — il ne retirera rien.
export const SERVICES_DE_COMPTE = false;
