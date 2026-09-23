/**
 * Petit magasin de donnees pour Starfall : un fichier JSON par table.
 *
 * Pourquoi pas une vraie base : ce serveur accueille des parties entre amis,
 * pas un service public. Quelques centaines de comptes tiennent en memoire
 * sans effort, et un fichier evite d'installer et de surveiller un moteur de
 * plus sur une machine qui heberge deja autre chose. L'interface ci-dessous
 * reste volontairement etroite (lire / ecrire tout) pour qu'un passage a
 * SQLite plus tard ne touche que ce fichier.
 *
 * L'ecriture passe par un fichier temporaire puis un rename : une coupure de
 * courant laisse l'ancienne version intacte plutot qu'un fichier a moitie
 * ecrit. Les ecritures sont serialisees par une file d'attente, sinon deux
 * sauvegardes simultanees se marchent dessus.
 */
import fs from "fs";
import path from "path";

/** Dossier des donnees : hors du code, donc conserve d'un deploiement a l'autre. */
export function dossierDonnees(): string {
  return process.env.NEXUS_DONNEES ?? "/opt/nexus-tri/donnees";
}

export class Table<T> {
  private cache: T | null = null;
  private file: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    nom: string,
    private readonly defaut: () => T,
  ) {
    this.file = path.join(dossierDonnees(), `${nom}.json`);
  }

  lire(): T {
    if (this.cache !== null) return this.cache;
    try {
      const brut = fs.readFileSync(this.file, "utf8");
      this.cache = JSON.parse(brut) as T;
    } catch {
      // Fichier absent (premier demarrage) ou illisible : on repart du defaut
      // plutot que d'empecher le serveur de demarrer.
      this.cache = this.defaut();
    }
    return this.cache;
  }

  /** Modifie puis enregistre. Le retour se resout quand le fichier est sur le disque. */
  async modifier(fn: (donnees: T) => void): Promise<void> {
    const donnees = this.lire();
    fn(donnees);
    this.cache = donnees;
    this.queue = this.queue.then(() => this.ecrire(donnees)).catch(() => {});
    return this.queue;
  }

  private async ecrire(donnees: T): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(donnees, null, 2), "utf8");
    await fs.promises.rename(tmp, this.file);
  }
}
