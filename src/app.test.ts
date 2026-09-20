/**
 * @vitest-environment jsdom
 *
 * Drives the real index.html through a whole group: pick, study, drill, fail,
 * restart, clear. This is what catches wiring mistakes that the pure session
 * tests cannot see -- a renamed id, a screen that never unhides, a map that
 * leaks the answer.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usStatesDeck } from "./data/us-states";

// Not import.meta.url: under the jsdom environment that is an http URL.
const html = readFileSync(resolve(process.cwd(), "index.html"), "utf-8");

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Missing #${id}`);
  return node as T;
}

function visible(id: string): boolean {
  return !byId(id).hidden;
}

/** Fresh DOM plus a fresh module instance, since main.ts runs on import. */
async function boot(): Promise<void> {
  document.documentElement.innerHTML = html;
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.resetModules();
  await import("./main");
}

function answer(text: string): void {
  byId<HTMLInputElement>("answer").value = text;
  byId<HTMLFormElement>("answer-form").dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
}

function advance(): void {
  byId<HTMLFormElement>("answer-form").dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
}

function activeStateId(): string | null {
  return document.querySelector(".us-map-state.is-active")?.getAttribute("d") ?? null;
}

function capitalFor(state: string): string {
  const card = usStatesDeck.cards.find((c) => c.front === state);
  if (card === undefined) throw new Error(`No card for prompt "${state}"`);
  return card.back;
}

/** Answers the question on screen correctly and moves on. */
function answerCorrectly(): void {
  answer(capitalFor(byId("prompt").textContent ?? ""));
  advance();
}

/** Answers correctly until the group is cleared. */
function clearGroup(limit = 120): void {
  let guard = 0;
  while (!visible("cleared") && guard++ < limit) answerCorrectly();
  if (!visible("cleared")) throw new Error("group never cleared");
}

/** Opens the first group. Groups now start in the drill. */
function openFirstGroupAndDrill(): void {
  document.querySelectorAll<HTMLButtonElement>(".group")[0]?.click();
}

/** Opens the first group via its opt-in Study button. */
function openFirstGroupForStudy(): void {
  document.querySelectorAll<HTMLButtonElement>(".group-study")[0]?.click();
}

beforeEach(async () => {
  await boot();
});

describe("boot", () => {
  it("starts on the group picker with all nine divisions plus a whole-deck run", () => {
    expect(visible("picker")).toBe(true);
    expect(document.querySelectorAll(".group")).toHaveLength(10);
    expect(document.querySelectorAll(".group-row.is-everything")).toHaveLength(1);
    expect(byId("title").textContent).toBe("StateLearner");
  });

  it("draws all 50 states", () => {
    expect(document.querySelectorAll(".us-map-state")).toHaveLength(50);
  });
});

describe("study pass", () => {
  it("is not the default -- picking a group drills straight away", () => {
    document.querySelectorAll<HTMLButtonElement>(".group")[0]?.click();
    expect(visible("drill")).toBe(true);
    expect(visible("study")).toBe(false);
    expect(byId("prompt").textContent).toBeTruthy();
  });

  it("offers a Study button per group", () => {
    expect(document.querySelectorAll(".group-study")).toHaveLength(10);
  });

  it("opens a group into study, showing both sides", () => {
    openFirstGroupForStudy();
    expect(visible("study")).toBe(true);
    expect(visible("picker")).toBe(false);
    expect(byId("title").textContent).toBe("New England");
    expect(byId("study-front").textContent).toBeTruthy();
    expect(byId("study-back").textContent).toBeTruthy();
  });

  it("walks every card, then starts the drill", () => {
    openFirstGroupForStudy();
    for (let i = 0; i < 6; i++) byId<HTMLButtonElement>("study-next").click();
    expect(visible("drill")).toBe(true);
    expect(visible("study")).toBe(false);
  });
});

describe("drill", () => {
  it("restarts the group on a wrong answer, after revealing it", () => {
    openFirstGroupAndDrill();
    const expected = byId("prompt").textContent;

    answer("completely wrong");
    expect(byId("feedback").className).toContain("bad");
    expect(byId("feedback").textContent).toMatch(/back to the start/);
    expect(byId("drill-position").textContent).toBe("1 of 6");

    advance();
    expect(byId("attempt").textContent).toBe("Attempt 2");
    expect(byId("drill-position").textContent).toBe("1 of 6");
    expect(expected).toBeTruthy();
  });

  it("advances on a correct answer", () => {
    openFirstGroupAndDrill();
    answer(capitalFor(byId("prompt").textContent ?? ""));
    expect(byId("feedback").className).toContain("ok");
    advance();
    expect(byId("drill-position").textContent).toBe("2 of 6");
  });

  it("clears the group only after an unbroken run, and remembers it", () => {
    openFirstGroupAndDrill();
    clearGroup();
    expect(visible("cleared")).toBe(true);
    expect(byId("cleared-detail").textContent).toMatch(/first run/);

    byId<HTMLButtonElement>("back-to-groups").click();
    expect(visible("picker")).toBe(true);
    expect(document.querySelectorAll(".group.is-cleared")).toHaveLength(1);
  });
});

describe("map", () => {
  it("highlights the state being asked when the state is the prompt", () => {
    openFirstGroupAndDrill();
    expect(activeStateId()).not.toBeNull();
  });

  it("does not give the answer away when the state is the answer", () => {
    byId<HTMLSelectElement>("direction").value = "back-to-front";
    byId("direction").dispatchEvent(new Event("change"));
    openFirstGroupAndDrill();

    expect(byId("prompt-label").textContent).toBe("Capital");
    expect(activeStateId()).toBeNull();

    // ...but it does show up once the answer is on screen.
    answer("wrong");
    expect(activeStateId()).not.toBeNull();
  });

  it("can be switched off", () => {
    const toggle = byId<HTMLInputElement>("map-toggle");
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    expect(visible("map-slot")).toBe(false);
    expect(activeStateId()).toBeNull();
  });
});

describe("theme", () => {
  it("overrides the OS setting and persists the choice", () => {
    const select = byId<HTMLSelectElement>("theme");
    select.value = "dark";
    select.dispatchEvent(new Event("change"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    select.value = "system";
    select.dispatchEvent(new Event("change"));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("statelearner:theme")).toBe("system");
  });
});

describe("all 50 states", () => {
  /** The whole-deck row is rendered last, after the nine divisions. */
  function openEverything(): void {
    document.querySelector<HTMLButtonElement>(".group-row.is-everything .group")?.click();
  }

  it("is offered as its own run covering every state", () => {
    const row = document.querySelector(".group-row.is-everything");
    expect(row?.textContent).toContain("All 50 States");
    expect(row?.textContent).toContain("50");
  });

  it("drills all 50 under the same restart rule", () => {
    openEverything();
    expect(visible("drill")).toBe(true);
    expect(byId("title").textContent).toBe("All 50 States");
    expect(byId("drill-position").textContent).toBe("1 of 50");

    answer("completely wrong");
    advance();
    expect(byId("attempt").textContent).toBe("Attempt 2");
    expect(byId("drill-position").textContent).toBe("1 of 50");
  });

  it("offers no next group once cleared, having no division after it", () => {
    openEverything();
    clearGroup();
    expect(visible("cleared")).toBe(true);
    expect(byId("next-group").hidden).toBe(true);
  });

  it("still offers a next group after clearing a division", () => {
    openFirstGroupAndDrill();
    clearGroup();
    expect(byId("next-group").hidden).toBe(false);
  });

  it("leaves the nine divisions partitioning the states exactly once", () => {
    const rows = [...document.querySelectorAll(".group-row:not(.is-everything) .group-count")];
    expect(rows).toHaveLength(9);
    const total = rows.reduce((sum, el) => sum + Number(el.textContent?.split(" ")[0] ?? 0), 0);
    expect(total).toBe(50);
  });
});
