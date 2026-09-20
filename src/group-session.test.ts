import { describe, expect, it } from "vitest";
import type { Deck, Group } from "./data/types";
import { GroupSession } from "./group-session";

const deck: Deck = {
  id: "test",
  name: "Test",
  frontLabel: "State",
  backLabel: "Capital",
  cards: [
    { id: "a", front: "Alabama", back: "Montgomery", frontAliases: ["AL"] },
    { id: "b", front: "Alaska", back: "Juneau", frontAliases: ["AK"] },
    { id: "c", front: "Arizona", back: "Phoenix", frontAliases: ["AZ"] },
  ],
  groups: [{ id: "g", name: "Group", cardIds: ["a", "b", "c"] }],
};

const group = deck.groups[0] as Group;

/** rng() === 0 keeps Fisher-Yates and `mixed` deterministic. */
const zero = () => 0;

const session = (overrides: Partial<Parameters<typeof make>[0]> = {}) => make(overrides);

function make(overrides: { skipStudy?: boolean } = {}) {
  return new GroupSession(deck, group, {
    direction: "front-to-back",
    rng: zero,
    ...overrides,
  });
}

/** Answers the whole current run correctly. */
function clearRun(active: GroupSession): void {
  while (active.phase === "drill") {
    const question = active.question;
    if (question === null) break;
    active.submit(question.answer);
    active.next();
  }
}

describe("study phase", () => {
  it("starts in study and walks the group in deck order", () => {
    const active = session();
    expect(active.phase).toBe("study");
    expect(active.studyCard?.front).toBe("Alabama");
    active.studyNext();
    expect(active.studyCard?.front).toBe("Alaska");
  });

  it("shows both sides, so nothing is hidden during study", () => {
    const active = session();
    expect(active.studyCard).toMatchObject({ front: "Alabama", back: "Montgomery" });
  });

  it("enters the drill after the last card", () => {
    const active = session();
    for (let i = 0; i < deck.cards.length; i++) active.studyNext();
    expect(active.phase).toBe("drill");
    expect(active.question).not.toBeNull();
  });

  it("can skip straight to the drill", () => {
    const active = session();
    active.beginDrill();
    expect(active.phase).toBe("drill");
  });

  it("skips study entirely when asked", () => {
    expect(session({ skipStudy: true }).phase).toBe("drill");
  });

  it("ignores study calls once drilling", () => {
    const active = session({ skipStudy: true });
    active.studyNext();
    expect(active.phase).toBe("drill");
    expect(active.studyCard).toBeNull();
  });
});

describe("drill phase", () => {
  it("advances on a correct answer", () => {
    const active = session({ skipStudy: true });
    const first = active.question?.prompt;
    expect(active.submit(active.question?.answer ?? "")?.correct).toBe(true);
    active.next();
    expect(active.drillPosition).toBe(1);
    expect(active.question?.prompt).not.toBe(first);
  });

  it("reveals the answer before restarting on a wrong one", () => {
    const active = session({ skipStudy: true });
    const expected = active.question?.answer;

    const result = active.submit("definitely wrong");
    expect(result).toEqual({ correct: false, answer: expected });
    // The answer stays on screen until next() is called.
    expect(active.drillPosition).toBe(0);
    expect(active.lastResult).not.toBeNull();
  });

  it("restarts the whole group after a wrong answer", () => {
    const active = session({ skipStudy: true });
    active.submit(active.question?.answer ?? "");
    active.next();
    active.submit(active.question?.answer ?? "");
    active.next();
    expect(active.drillPosition).toBe(2);

    active.submit("wrong");
    active.next();
    expect(active.drillPosition).toBe(0);
    expect(active.attempt).toBe(2);
    expect(active.phase).toBe("drill");
  });

  it("never offers a way back to study once drilling", () => {
    const active = session({ skipStudy: true });
    active.submit("wrong");
    active.next();
    active.beginDrill();
    expect(active.phase).toBe("drill");
    expect(active.studyCard).toBeNull();
  });

  it("counts a give-up as wrong", () => {
    const active = session({ skipStudy: true });
    expect(active.reveal()?.correct).toBe(false);
    active.next();
    expect(active.attempt).toBe(2);
  });

  it("ignores a second submission for the same question", () => {
    const active = session({ skipStudy: true });
    active.submit("wrong");
    active.submit(active.question?.answer ?? "");
    expect(active.lastResult?.correct).toBe(false);
  });

  it("does not advance before the question is graded", () => {
    const active = session({ skipStudy: true });
    active.next();
    expect(active.drillPosition).toBe(0);
    expect(active.attempt).toBe(1);
  });

  it("accepts aliases", () => {
    const active = new GroupSession(deck, group, { direction: "back-to-front", rng: zero });
    active.beginDrill();
    // Whichever card came up first, its postal code is an accepted spelling.
    const alias = deck.cards.find((c) => c.id === active.question?.cardId)?.frontAliases?.[0];
    expect(alias).toBeTypeOf("string");
    expect(active.submit(alias ?? "")?.correct).toBe(true);
  });
});

describe("clearing a group", () => {
  it("clears only after an unbroken run", () => {
    const active = session({ skipStudy: true });
    clearRun(active);
    expect(active.phase).toBe("cleared");
    expect(active.attempt).toBe(1);
  });

  it("requires a full clean run after a mistake", () => {
    const active = session({ skipStudy: true });
    active.submit(active.question?.answer ?? "");
    active.next();
    active.submit("wrong");
    active.next();

    expect(active.phase).toBe("drill");
    clearRun(active);
    expect(active.phase).toBe("cleared");
    expect(active.attempt).toBe(2);
  });

  it("reshuffles on restart rather than repeating the order", () => {
    // A cycling rng makes the two shuffles differ; a fixed one cannot.
    let n = 0;
    const active = new GroupSession(deck, group, {
      direction: "front-to-back",
      rng: () => [0.9, 0.1, 0.5][n++ % 3] as number,
      skipStudy: true,
    });

    const first = [active.question?.cardId];
    active.submit(active.question?.answer ?? "");
    active.next();
    first.push(active.question?.cardId);

    active.submit("wrong");
    active.next();
    const second = [active.question?.cardId];
    active.submit(active.question?.answer ?? "");
    active.next();
    second.push(active.question?.cardId);

    expect(second).not.toEqual(first);
  });

  it("rejects a group with no cards", () => {
    expect(
      () => new GroupSession(deck, { id: "x", name: "X", cardIds: [] }, { direction: "mixed" }),
    ).toThrow(/no cards/);
  });
});
