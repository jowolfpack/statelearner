import type { DeckMap } from "./data/types";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * A deck's map. Every region is one <path> built once; highlighting is a class
 * swap, so asking a new card never touches the DOM beyond two elements.
 */
export class RegionMap {
  private readonly paths = new Map<string, SVGPathElement>();
  private highlighted: string | null = null;

  readonly element: SVGSVGElement;

  constructor(source: DeckMap) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", source.viewBox);
    svg.setAttribute("class", "us-map");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", source.label);

    for (const [id, d] of Object.entries(source.paths)) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "us-map-state");
      svg.append(path);
      this.paths.set(id, path);
    }

    this.element = svg;
  }

  /** Highlights one card id, or clears the highlight with null. */
  highlight(cardId: string | null): void {
    if (cardId === this.highlighted) return;

    if (this.highlighted !== null) {
      this.paths.get(this.highlighted)?.classList.remove("is-active");
    }
    const path = cardId === null ? undefined : this.paths.get(cardId);
    if (path !== undefined) {
      path.classList.add("is-active");
      // Keep the active region painted over its neighbours' borders.
      path.parentNode?.append(path);
    }
    this.highlighted = path === undefined ? null : cardId;
  }
}
