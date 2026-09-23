import { Execution, Game, MessageType, Player } from "../game/Game";

/** Longueur maximale affichee, alignee sur ChatTextSchema. */
const MAX_LENGTH = 200;

/**
 * Un message libre, lu par toute la partie.
 *
 * Le chat d'origine n'offre que des phrases toutes faites, adressees a un
 * joueur. Ici on peut ecrire ce qu'on veut, a tout le monde : c'est ce qui
 * permet de negocier une alliance, de prevenir d'une attaque ou simplement de
 * jouer ensemble.
 *
 * Le message passe par une intention, donc par le meme chemin que les autres
 * actions : il traverse le serveur, entre dans le tour, et chaque client
 * l'affiche au meme instant de la simulation. Aucun canal parallele a ouvrir,
 * et les rediffusions de parties le rejouent telles quelles.
 *
 * Le texte du joueur n'est jamais interprete comme du HTML : l'affichage passe
 * par DOMPurify (core/Util.ts, onlyImages), qui ne laisse qu'un <span> et les
 * images d'emoji.
 */
export class ChatExecution implements Execution {
  private active = true;
  private mg: Game;

  constructor(
    private sender: Player,
    private text: string,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    this.active = false;

    const text = this.text.trim().slice(0, MAX_LENGTH);
    if (text.length === 0) return;
    // Le controle vit ici, dans la simulation : un client modifie ne doit pas
    // pouvoir inonder la partie en contournant le bouton.
    if (!this.sender.canSendChat()) return;
    this.sender.recordChat();

    // playerID null = tout le monde voit le message (EventsDisplay n'ecarte
    // que les messages adresses a un autre joueur). focusPlayerID pointe sur
    // l'auteur : un clic sur la ligne centre la carte sur lui.
    this.mg.displayMessage(
      "events_display.chat_message",
      MessageType.CHAT,
      null,
      undefined,
      { name: this.sender.displayName(), text },
      undefined,
      this.sender.id(),
    );
  }

  owner(): Player {
    return this.sender;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    // On peut se parler avant meme d'avoir choisi son point de depart : c'est
    // souvent la que les alliances se decident.
    return true;
  }
}
