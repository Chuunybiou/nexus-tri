import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { assetUrl } from "../../core/AssetUrls";
import { MapCategory, MapInfo, maps } from "../../core/game/Maps.gen";
import { SinglePlayerModal } from "../SinglePlayerModal";
import { normaliseMapKey, translateText } from "../Utils";

/**
 * Display order for the catalogue.
 *
 * Explicit rather than alphabetical: a player scanning the list wants the
 * headline categories first and the geographic long tail last. Any category
 * that appears on a map but is missing here still shows, appended at the end,
 * so adding one to a map can never make it silently unlistable.
 */
const CATEGORY_ORDER: readonly MapCategory[] = [
  "featured",
  "world",
  "continental",
  "cosmic",
  "fictional",
  "arcade",
  "tournament",
  "countries",
  "europe",
  "asia",
  "north_america",
  "south_america",
  "africa",
  "oceania",
  "antarctica",
] as const;

/** Categories open on first paint; the rest start collapsed. */
const OPEN_BY_DEFAULT: ReadonlySet<string> = new Set([
  "featured",
  "cosmic",
  "fictional",
]);

interface CategoryGroup {
  category: string;
  entries: MapInfo[];
}

/**
 * The map catalogue on the play page.
 *
 * Clicking a map opens the singleplayer modal already set to it. It stops
 * there rather than launching: the player still picks bots and difficulty, and
 * a single click in a browsing list should not drop anyone into a game.
 *
 * Driven entirely by Maps.gen.ts, which the Go map-generator rewrites on every
 * run, so a newly generated map appears here with no code change.
 */
@customElement("map-catalog")
export class MapCatalog extends LitElement {
  @state() private open: Set<string> = new Set(OPEN_BY_DEFAULT);

  createRenderRoot() {
    return this;
  }

  /** Maps grouped by category, in display order, unknown categories last. */
  private groups(): CategoryGroup[] {
    const byCategory = new Map<string, MapInfo[]>();
    for (const map of maps) {
      for (const category of map.categories) {
        const list = byCategory.get(category);
        if (list === undefined) byCategory.set(category, [map]);
        else list.push(map);
      }
    }

    const ordered: CategoryGroup[] = [];
    const seen = new Set<string>();
    for (const category of CATEGORY_ORDER) {
      const entries = byCategory.get(category);
      if (entries === undefined) continue; // no map uses it: do not draw an empty header
      ordered.push({ category, entries });
      seen.add(category);
    }
    for (const [category, entries] of byCategory) {
      if (!seen.has(category)) ordered.push({ category, entries });
    }
    return ordered;
  }

  /** Opens the solo modal on the clicked map. */
  private play(map: MapInfo) {
    const modal = document.querySelector(
      "single-player-modal",
    ) as SinglePlayerModal | null;
    // The modal lives in index.html, so it is normally there. Guard anyway:
    // a missing element should do nothing, not throw on every click.
    modal?.openWithMap(map.type);
  }

  private toggle(category: string) {
    const next = new Set(this.open);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    this.open = next;
  }

  render() {
    const groups = this.groups();
    return html`
      <div class="w-full px-2 lg:px-0">
        <div class="mb-3 flex items-baseline gap-3">
          <span
            class="text-xs font-bold uppercase tracking-[0.22em] text-white/50"
            role="heading"
            aria-level="2"
          >
            ${translateText("map_catalog.title")}
          </span>
          <span class="h-px flex-1 bg-white/10"></span>
          <span class="text-xs text-white/40">
            ${translateText("map_catalog.count", { count: maps.length })}
          </span>
        </div>
        <div class="flex flex-col gap-1.5">
          ${groups.map((g) => this.renderGroup(g))}
        </div>
      </div>
    `;
  }

  private renderGroup(group: CategoryGroup) {
    const isOpen = this.open.has(group.category);
    const label = translateText(`map_categories.${group.category}`);
    return html`
      <div class="rounded-lg border border-white/[0.08] bg-white/[0.02]">
        <button
          type="button"
          class="flex w-full items-center gap-3 px-3 py-2 text-left
                 transition-colors hover:bg-white/[0.04]"
          aria-expanded=${isOpen ? "true" : "false"}
          @click=${() => this.toggle(group.category)}
        >
          <span
            class="text-white/40 transition-transform duration-150
                   ${isOpen ? "rotate-90" : ""}"
            aria-hidden="true"
            >▸</span
          >
          <span class="flex-1 text-sm font-semibold text-white">${label}</span>
          <span class="text-xs tabular-nums text-white/40">
            ${group.entries.length}
          </span>
        </button>
        ${isOpen ? this.renderEntries(group.entries) : ""}
      </div>
    `;
  }

  private renderEntries(entries: MapInfo[]) {
    // Sorted by the name the player actually reads, not by internal id.
    const sorted = [...entries].sort((a, b) =>
      translateText(a.translationKey).localeCompare(
        translateText(b.translationKey),
      ),
    );
    return html`
      <div
        class="grid grid-cols-2 gap-2 border-t border-white/[0.06] p-2
               sm:grid-cols-3 lg:grid-cols-4"
      >
        ${sorted.map((map) => this.renderEntry(map))}
      </div>
    `;
  }

  private renderEntry(map: MapInfo) {
    const name = translateText(map.translationKey);
    return html`
      <button
        type="button"
        class="group flex min-w-0 items-center gap-2 rounded-md p-1 text-left
               transition-colors hover:bg-white/[0.07]
               focus-visible:bg-white/[0.07] focus-visible:outline-none"
        title=${translateText("map_catalog.play", { map: name })}
        @click=${() => this.play(map)}
      >
        <img
          src=${assetUrl(
            `maps/${encodeURIComponent(normaliseMapKey(map.type))}/thumbnail.webp`,
          )}
          alt=""
          loading="lazy"
          class="h-9 w-12 shrink-0 rounded object-cover opacity-80
                 transition-opacity group-hover:opacity-100"
        />
        <span
          class="min-w-0 truncate text-xs text-white/75 group-hover:text-white"
        >
          ${name}
        </span>
      </button>
    `;
  }
}
