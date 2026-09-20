import { MAP_VIEWBOX, STATE_PATHS } from "./data/us-map";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * The US map. Every state is one <path> built once; highlighting is a class
 * swap, so asking a new state never touches the DOM beyond two elements.
 */
export class UsMap {
  private readonly paths = new Map<string, SVGPathElement>();
  private highlighted: string | null = null;

  readonly element: SVGSVGElement;

  constructor() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", MAP_VIEWBOX);
    svg.setAttribute("class", "us-map");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Map of the United States");

    for (const [id, d] of Object.entries(STATE_PATHS)) {
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
      // Keep the active state painted over its neighbours' borders.
      path.parentNode?.append(path);
    }
    this.highlighted = path === undefined ? null : cardId;
  }
}
