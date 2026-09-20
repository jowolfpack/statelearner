import { describe, expect, it } from "vitest";
import { MAP_VIEWBOX, STATE_PATHS } from "./data/us-map";
import { usStatesDeck } from "./data/us-states";

describe("generated map data", () => {
  it("has a path for every card in the deck", () => {
    for (const card of usStatesDeck.cards) {
      expect(STATE_PATHS[card.id], card.front).toBeTypeOf("string");
    }
    expect(Object.keys(STATE_PATHS)).toHaveLength(50);
  });

  it("emits closed paths only", () => {
    for (const [id, d] of Object.entries(STATE_PATHS)) {
      expect(d.startsWith("M"), id).toBe(true);
      expect(d.endsWith("Z"), id).toBe(true);
    }
  });

  it("fits every state inside the viewBox", () => {
    const [vx, vy, vw, vh] = MAP_VIEWBOX.split(" ").map(Number) as [
      number,
      number,
      number,
      number,
    ];
    for (const [id, d] of Object.entries(STATE_PATHS)) {
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      expect(Math.min(...xs), `${id} left`).toBeGreaterThanOrEqual(vx);
      expect(Math.max(...xs), `${id} right`).toBeLessThanOrEqual(vx + vw);
      expect(Math.min(...ys), `${id} top`).toBeGreaterThanOrEqual(vy);
      expect(Math.max(...ys), `${id} bottom`).toBeLessThanOrEqual(vy + vh);
    }
  });
});
