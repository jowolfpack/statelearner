import { describe, expect, it } from "vitest";
import type { Deck } from "./data/types";
import { questionFor, shuffled } from "./quiz";
import { usStatesDeck } from "./data/us-states";
import { cardsOf } from "./data/types";

const deck: Deck = {
  id: "test",
  name: "Test",
  frontLabel: "State",
  backLabel: "Capital",
  cards: [{ id: "a", front: "Alabama", back: "Montgomery", frontAliases: ["AL"] }],
  groups: [{ id: "g", name: "Group", cardIds: ["a"] }],
};

const card = deck.cards[0]!;
const constant = (value: number) => () => value;

describe("questionFor", () => {
  it("asks for the capital going front to back", () => {
    expect(questionFor(deck, card, "front-to-back", constant(0))).toMatchObject({
      prompt: "Alabama",
      answer: "Montgomery",
      promptLabel: "State",
      answerLabel: "Capital",
    });
  });

  it("asks for the state going back to front, accepting the postal code", () => {
    const question = questionFor(deck, card, "back-to-front", constant(0));
    expect(question).toMatchObject({ prompt: "Montgomery", answer: "Alabama" });
    expect(question.accepted).toContain("AL");
  });

  it("rolls a direction per card in mixed mode", () => {
    expect(questionFor(deck, card, "mixed", constant(0)).answerLabel).toBe("Capital");
    expect(questionFor(deck, card, "mixed", constant(0.9)).answerLabel).toBe("State");
  });
});

describe("shuffled", () => {
  it("keeps every item exactly once", () => {
    const items = [1, 2, 3, 4, 5];
    expect(shuffled(items, constant(0)).sort()).toEqual(items);
  });

  it("does not mutate the input", () => {
    const items = [1, 2, 3];
    shuffled(items, constant(0.99));
    expect(items).toEqual([1, 2, 3]);
  });
});

describe("the US deck", () => {
  it("has 50 states", () => {
    expect(usStatesDeck.cards).toHaveLength(50);
  });

  it("covers every state exactly once across the nine divisions", () => {
    expect(usStatesDeck.groups).toHaveLength(9);
    const grouped = usStatesDeck.groups.flatMap((group) => group.cardIds);
    expect(grouped).toHaveLength(50);
    expect(new Set(grouped).size).toBe(50);
    expect([...grouped].sort()).toEqual(usStatesDeck.cards.map((c) => c.id).sort());
  });

  it("resolves every group to real cards", () => {
    for (const group of usStatesDeck.groups) {
      expect(cardsOf(usStatesDeck, group)).toHaveLength(group.cardIds.length);
    }
  });

  it("builds each region as an exact union of divisions", () => {
    const regions = usStatesDeck.regions ?? [];
    expect(regions.map((r) => r.id)).toEqual(["east", "mid", "west"]);

    const divisions = new Map(usStatesDeck.groups.map((g) => [g.id, g.cardIds]));
    const covered = regions.flatMap((r) => r.cardIds);
    expect(covered).toHaveLength(50);
    expect(new Set(covered).size).toBe(50);

    // Every region is whole divisions, never a partial one.
    for (const region of regions) {
      const remaining = new Set(region.cardIds);
      for (const ids of divisions.values()) {
        if (ids.every((id) => remaining.has(id))) ids.forEach((id) => remaining.delete(id));
      }
      expect([...remaining], region.id).toEqual([]);
    }
  });

  it("keeps groups small enough to drill", () => {
    for (const group of usStatesDeck.groups) {
      expect(group.cardIds.length).toBeLessThanOrEqual(8);
    }
  });
});
