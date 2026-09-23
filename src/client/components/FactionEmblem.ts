import { TemplateResult, svg } from "lit";
import { Faction } from "../../core/game/Factions";

/**
 * The faction accent colour, as a CSS value.
 *
 * Lives beside the emblem so shape and colour can never drift apart: every
 * surface that draws one draws the other from the same switch.
 */
export function factionAccent(faction: Faction): string {
  switch (faction) {
    case Faction.Swarm:
      return "var(--color-swarm)";
    case Faction.Ascendant:
      return "var(--color-ascendant)";
    default:
      return "var(--color-vanguard)";
  }
}

/**
 * The faction emblems.
 *
 * Original geometry, drawn inline rather than shipped as image assets: three
 * small shapes cost less inline than three sprite requests, they inherit the
 * faction accent through `currentColor`, and they stay crisp at every size the
 * UI needs them — a 16px badge beside a name and a 40px mark on a lobby card.
 *
 * Each silhouette states its faction's mechanic rather than just decorating it,
 * so the shape teaches the rule:
 *   Vanguard  — a braced chevron. Straight lines, flat base, rivet holes:
 *               industrial, dependable, nothing clever.
 *   Swarm     — a cluster of pods around a core. Read it as numbers, and as the
 *               breeding pressure that rots a hoarded army.
 *   Ascendant — a faceted crystal inside a broken ring. The ring is the energy
 *               grid: deliberately open, because losing it is how the faction dies.
 */
export function factionEmblem(faction: Faction): TemplateResult {
  switch (faction) {
    case Faction.Swarm:
      return swarmEmblem();
    case Faction.Ascendant:
      return ascendantEmblem();
    default:
      return vanguardEmblem();
  }
}

/** Heavy angular chevron on a braced base. All 45° cuts, no curves. */
function vanguardEmblem(): TemplateResult {
  return svg`
    <path
      d="M12 3 L21 10 L21 13.5 L12 6.5 L3 13.5 L3 10 Z"
      fill="currentColor"
    />
    <path
      d="M12 10 L18 14.7 L18 18 L12 13.3 L6 18 L6 14.7 Z"
      fill="currentColor"
      opacity="0.75"
    />
    <rect x="4.5" y="19.5" width="15" height="1.8" fill="currentColor" />
    <circle cx="6.8" cy="20.4" r="0.55" fill="#000" opacity="0.45" />
    <circle cx="12" cy="20.4" r="0.55" fill="#000" opacity="0.45" />
    <circle cx="17.2" cy="20.4" r="0.55" fill="#000" opacity="0.45" />
  `;
}

/** A core ringed by six pods — numbers, and the pressure that comes with them. */
function swarmEmblem(): TemplateResult {
  const pods = [0, 60, 120, 180, 240, 300].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const cx = 12 + Math.cos(rad) * 7.2;
    const cy = 12 + Math.sin(rad) * 7.2;
    return svg`<ellipse
      cx=${cx.toFixed(2)}
      cy=${cy.toFixed(2)}
      rx="2.9"
      ry="2.2"
      transform=${`rotate(${deg} ${cx.toFixed(2)} ${cy.toFixed(2)})`}
      fill="currentColor"
      opacity="0.7"
    />`;
  });
  return svg`
    ${pods}
    <circle cx="12" cy="12" r="4.1" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="#000" opacity="0.4" />
  `;
}

/** A faceted crystal inside a broken ring: the grid, drawn as something cuttable. */
function ascendantEmblem(): TemplateResult {
  return svg`
    <path
      d="M20.4 7.5 A9 9 0 0 1 20.4 16.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      opacity="0.65"
    />
    <path
      d="M3.6 16.5 A9 9 0 0 1 3.6 7.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      opacity="0.65"
    />
    <path d="M12 2.6 L16.4 12 L12 21.4 L7.6 12 Z" fill="currentColor" />
    <path d="M12 2.6 L16.4 12 L12 12 Z" fill="#000" opacity="0.28" />
    <path d="M12 21.4 L7.6 12 L12 12 Z" fill="#fff" opacity="0.22" />
  `;
}
