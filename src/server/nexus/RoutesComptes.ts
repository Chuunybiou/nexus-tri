/**
 * Adresses des comptes Starfall, montees sur le serveur principal.
 *
 * Rien ici n'est obligatoire pour jouer : sans compte, le jeu fonctionne
 * exactement pareil. Le compte ajoute le pseudonyme reserve, l'historique et
 * le classement.
 */
import { Router, type Request, type Response } from "express";
import { logger } from "../Logger";
import {
  LIMITES,
  classement,
  creer,
  creerJeton,
  lierAppareil,
  lireJeton,
  parId,
  parPseudo,
  verifierMotDePasse,
  verifierPseudo,
  vuePublique,
} from "./Comptes";

const log = logger.child({ comp: "comptes" });

function compteDeLaRequete(req: Request) {
  const entete = req.headers.authorization ?? "";
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7) : undefined;
  const id = lireJeton(jeton);
  return id ? parId(id) : undefined;
}

export function routesComptes(): Router {
  const router = Router();

  router.post("/compte/inscription", async (req: Request, res: Response) => {
    const pseudo = String(req.body?.pseudo ?? "");
    const motDePasse = String(req.body?.motDePasse ?? "");
    const email = req.body?.email ? String(req.body.email) : null;

    const souci = verifierPseudo(pseudo);
    if (souci) return res.status(400).json({ erreur: souci });
    if (motDePasse.length < LIMITES.MOT_DE_PASSE_MIN) {
      return res.status(400).json({
        erreur: `Le mot de passe doit faire au moins ${LIMITES.MOT_DE_PASSE_MIN} caractères.`,
      });
    }
    if (parPseudo(pseudo)) {
      return res.status(409).json({ erreur: "Ce pseudonyme est déjà pris." });
    }
    const compte = await creer(pseudo, motDePasse, email);
    log.info("compte cree", { pseudo: compte.pseudo });
    return res
      .status(201)
      .json({ jeton: creerJeton(compte.id), compte: vuePublique(compte) });
  });

  router.post("/compte/connexion", async (req: Request, res: Response) => {
    const compte = parPseudo(String(req.body?.pseudo ?? ""));
    const motDePasse = String(req.body?.motDePasse ?? "");
    // Meme reponse que le pseudonyme existe ou non : sinon on apprend a un
    // inconnu quels pseudonymes sont pris.
    if (!compte || !(await verifierMotDePasse(compte, motDePasse))) {
      return res
        .status(401)
        .json({ erreur: "Pseudonyme ou mot de passe incorrect." });
    }
    return res.json({
      jeton: creerJeton(compte.id),
      compte: vuePublique(compte),
    });
  });

  router.get("/compte/moi", (req: Request, res: Response) => {
    const compte = compteDeLaRequete(req);
    if (!compte) return res.status(401).json({ erreur: "Non connecté." });
    return res.json({ compte: vuePublique(compte) });
  });

  /** Relie l'appareil courant au compte : c'est ce lien qui rattache les parties. */
  router.post("/compte/appareil", async (req: Request, res: Response) => {
    const compte = compteDeLaRequete(req);
    if (!compte) return res.status(401).json({ erreur: "Non connecté." });
    const persistentId = String(req.body?.persistentId ?? "");
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(persistentId)) {
      return res
        .status(400)
        .json({ erreur: "Identifiant d'appareil invalide." });
    }
    await lierAppareil(compte.id, persistentId);
    return res.json({ message: "ok" });
  });

  router.get("/classement", (_req: Request, res: Response) => {
    return res.json({ classement: classement() });
  });

  return router;
}
