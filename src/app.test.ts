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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usStatesDeck } from "./data/us-states";
import { nycDeck } from "./data/nyc";

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

/** Everything the app has spoken since the last boot. */
let spoken: string[] = [];

/** jsdom has no speech synthesis, so record what would have been said. */
function installSynth(): void {
  spoken = [];
  vi.stubGlobal("speechSynthesis", {
    speak: (u: { text: string }) => spoken.push(u.text),
    cancel: () => {},
    getVoices: () => [],
    addEventListener: () => {},
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
}

/** Fresh DOM plus a fresh module instance, since main.ts runs on import. */
async function boot(): Promise<void> {
  installSynth();
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

/** The first of the nine divisions -- the whole-deck and region rows lead the list. */
const FIRST_DIVISION = ".group-row:not(.is-everything):not(.is-region)";

/** Opens the first division. Groups now start in the drill. */
function openFirstGroupAndDrill(): void {
  document.querySelector<HTMLButtonElement>(`${FIRST_DIVISION} .group`)?.click();
}

/** Opens the first division via its opt-in Study button. */
function openFirstGroupForStudy(): void {
  document.querySelector<HTMLButtonElement>(`${FIRST_DIVISION} .group-study`)?.click();
}

beforeEach(async () => {
  await boot();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("boot", () => {
  it("starts on the group picker with all three tiers", () => {
    expect(visible("picker")).toBe(true);
    // 1 whole-deck run + 3 regions + 9 divisions.
    expect(document.querySelectorAll(".group")).toHaveLength(13);
    expect(document.querySelectorAll(".group-row.is-everything")).toHaveLength(1);
    expect(document.querySelectorAll(".group-row.is-region")).toHaveLength(3);
    expect(byId("title").textContent).toBe("StateLearner");
  });

  it("draws all 50 states", () => {
    expect(document.querySelectorAll(".us-map-state")).toHaveLength(50);
  });
});

describe("study pass", () => {
  it("is not the default -- picking a group drills straight away", () => {
    openFirstGroupAndDrill();
    expect(visible("drill")).toBe(true);
    expect(visible("study")).toBe(false);
    expect(byId("prompt").textContent).toBeTruthy();
  });

  it("offers a Study button per group", () => {
    expect(document.querySelectorAll(".group-study")).toHaveLength(13);
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
    expect(byId("title").textContent).toBe("New England");
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
  const select = () => byId<HTMLSelectElement>("theme");

  function choose(theme: string): void {
    select().value = theme;
    select().dispatchEvent(new Event("change"));
  }

  it("starts dark", () => {
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(select().value).toBe("dark");
  });

  it("offers dark and light only", () => {
    const values = [...select().options].map((o) => o.value);
    expect(values).toEqual(["dark", "light"]);
  });

  it("switches to light and back, persisting the choice", () => {
    choose("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("statelearner:theme")).toBe("light");

    choose("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("statelearner:theme")).toBe("dark");
  });

  it("falls back to dark for a theme stored by an older build", async () => {
    localStorage.setItem("statelearner:theme", "system");
    document.documentElement.innerHTML = html;
    vi.resetModules();
    await import("./main");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(byId<HTMLSelectElement>("theme").value).toBe("dark");
  });
});

describe("all 50 states", () => {
  /** The whole-deck row is rendered last, after the nine divisions. */
  function openEverything(): void {
    document.querySelector<HTMLButtonElement>(".group-row.is-everything .group")?.click();
  }

  it("leads the list, above the regions and divisions", () => {
    const rows = [...document.querySelectorAll(".group-row")];
    expect(rows[0]?.classList.contains("is-everything")).toBe(true);
    expect(rows).toHaveLength(13);
  });

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
    const rows = [...document.querySelectorAll(`${FIRST_DIVISION} .group-count`)];
    expect(rows).toHaveLength(9);
    const total = rows.reduce((sum, el) => sum + Number(el.textContent?.split(" ")[0] ?? 0), 0);
    expect(total).toBe(50);
  });
});

describe("pronunciation audio", () => {
  const speakers = () => document.querySelectorAll(".speak");

  /**
   * What the engine should actually be handed for a word on screen: its
   * respelling if it has one, else the name itself. Tests must never compare
   * against the written form -- the drill order is genuinely random, so whether
   * an overridden name comes up is luck.
   */
  function spokenFor(written: string): string {
    const card = usStatesDeck.cards.find((c) => c.front === written || c.back === written);
    if (card === undefined) throw new Error(`No card for "${written}"`);
    return card.front === written
      ? (card.frontSpoken ?? card.front)
      : (card.backSpoken ?? card.back);
  }

  /** The spoken form of a state's capital. */
  function spokenCapitalFor(state: string): string {
    return spokenFor(capitalFor(state));
  }

  /** Auto-play is off by default, so tests that want it must ask. */
  function setSound(on: boolean): void {
    const toggle = byId<HTMLInputElement>("sound-toggle");
    toggle.checked = on;
    toggle.dispatchEvent(new Event("change"));
  }

  function setDirection(value: string): void {
    const select = byId<HTMLSelectElement>("direction");
    select.value = value;
    select.dispatchEvent(new Event("change"));
  }

  it("offers a Sound switch, off by default", () => {
    expect(byId<HTMLInputElement>("sound-toggle").checked).toBe(false);
    expect(byId("sound-toggle-label").hidden).toBe(false);
  });

  it("says nothing by default until sound is switched on", () => {
    openFirstGroupAndDrill();
    const state = byId("prompt").textContent ?? "";
    answer(capitalFor(state));
    expect(spoken).toEqual([]);
  });

  it("remembers the switch being turned on", () => {
    setSound(true);
    expect(localStorage.getItem("statelearner:sound")).toBe("on");
  });

  it("speaks the answer you got right", () => {
    setSound(true);
    openFirstGroupAndDrill();
    const state = byId("prompt").textContent ?? "";
    answer(capitalFor(state));
    expect(spoken).toEqual([spokenCapitalFor(state)]);
  });

  it("speaks the correct answer when you get one wrong", () => {
    setSound(true);
    openFirstGroupAndDrill();
    const state = byId("prompt").textContent ?? "";
    answer("completely wrong");
    expect(spoken).toEqual([spokenCapitalFor(state)]);
  });

  it("speaks the answer when you give up", () => {
    setSound(true);
    openFirstGroupAndDrill();
    const state = byId("prompt").textContent ?? "";
    byId<HTMLButtonElement>("give-up").click();
    expect(spoken).toEqual([spokenCapitalFor(state)]);
  });

  it("stays quiet when the switch is off, but the buttons still work", () => {
    setSound(true);
    setSound(false);

    openFirstGroupAndDrill();
    const prompt = byId("prompt").textContent ?? "";
    answer(capitalFor(prompt));
    expect(spoken).toEqual([]);

    document.querySelector<HTMLButtonElement>("#prompt-row .speak")?.click();
    expect(spoken).toEqual([spokenFor(prompt)]);
  });

  it("offers a speaker for the prompt and, once graded, the answer", () => {
    openFirstGroupAndDrill();
    expect(document.querySelector("#prompt-row .speak")).not.toBeNull();
    expect(document.querySelector("#feedback .speak")).toBeNull();

    answer("completely wrong");
    expect(document.querySelector("#feedback .speak")).not.toBeNull();
  });

  it("never offers a speaker that would give the answer away", () => {
    // Capital -> State: the state is the answer, so nothing may say it aloud
    // until the question has been graded.
    setDirection("back-to-front");
    openFirstGroupAndDrill();

    const prompt = byId("prompt").textContent ?? "";
    expect(byId("prompt-label").textContent).toBe("Capital");
    expect(speakers()).toHaveLength(1);
    document.querySelector<HTMLButtonElement>("#prompt-row .speak")?.click();
    expect(spoken).toEqual([spokenFor(prompt)]);

    answer("wrong");
    expect(document.querySelector("#feedback .speak")).not.toBeNull();
  });

  it("gives both sides a speaker during study", () => {
    openFirstGroupForStudy();
    expect(document.querySelector("#study-front-row .speak")).not.toBeNull();
    expect(document.querySelector("#study-back-row .speak")).not.toBeNull();
  });

  it("speaks the respelling for a name the engine mangles", () => {
    // Walk the study pass to New Hampshire, whose capital Concord a generic
    // engine reads as "CON-cord".
    openFirstGroupForStudy();
    for (let i = 0; i < 6 && byId("study-front").textContent !== "New Hampshire"; i++) {
      byId<HTMLButtonElement>("study-next").click();
    }
    expect(byId("study-front").textContent).toBe("New Hampshire");
    expect(byId("study-back").textContent).toBe("Concord");

    document.querySelector<HTMLButtonElement>("#study-back-row .speak")?.click();
    expect(spoken).toEqual(["conkerd"]);
  });

  it("hides the switch and every speaker where speech is unsupported", async () => {
    vi.stubGlobal("speechSynthesis", undefined);
    document.documentElement.innerHTML = html;
    vi.resetModules();
    await import("./main");

    expect(byId("sound-toggle-label").hidden).toBe(true);
    openFirstGroupAndDrill();
    expect(speakers()).toHaveLength(0);
  });
});

describe("regions", () => {
  const regionRows = () => [...document.querySelectorAll(".group-row.is-region")];

  it("offers East, Mid and West between the whole deck and the divisions", () => {
    const rows = [...document.querySelectorAll(".group-row")];
    expect(rows.slice(1, 4).every((r) => r.classList.contains("is-region"))).toBe(true);
    expect(regionRows().map((r) => r.querySelector(".group-name")?.textContent)).toEqual([
      "East",
      "Mid",
      "West",
    ]);
  });

  it("covers all 50 states across the three regions", () => {
    const counts = regionRows().map((r) =>
      Number(r.querySelector(".group-count")?.textContent?.split(" ")[0] ?? 0),
    );
    expect(counts).toEqual([21, 16, 13]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(50);
  });

  it("drills a region under the same rules", () => {
    regionRows()[0]?.querySelector<HTMLButtonElement>(".group")?.click();
    expect(visible("drill")).toBe(true);
    expect(byId("title").textContent).toBe("East");
    expect(byId("drill-position").textContent).toBe("1 of 21");

    answer("completely wrong");
    advance();
    expect(byId("attempt").textContent).toBe("Attempt 2");
    expect(byId("drill-position").textContent).toBe("1 of 21");
  });

  it("moves on to the next region, not the next division", () => {
    regionRows()[0]?.querySelector<HTMLButtonElement>(".group")?.click();
    clearGroup();
    expect(byId("next-group").hidden).toBe(false);
    byId<HTMLButtonElement>("next-group").click();
    expect(byId("title").textContent).toBe("Mid");
  });

  it("offers no next group after the last region", () => {
    regionRows()[2]?.querySelector<HTMLButtonElement>(".group")?.click();
    clearGroup();
    expect(byId("next-group").hidden).toBe(true);
  });
});

describe("decks", () => {
  it("names the mode options after the deck's own sides", () => {
    const options = [...byId<HTMLSelectElement>("direction").options];
    expect(options.map((o) => o.value)).toEqual([
      "front-to-back",
      "back-to-front",
      "mixed",
    ]);
    expect(options.map((o) => o.textContent)).toEqual([
      "State → Capital",
      "Capital → State",
      "Mixed",
    ]);
  });

  it("offers a chooser now that there is more than one deck", () => {
    expect(byId("deck-label").hidden).toBe(false);
    expect([...byId<HTMLSelectElement>("deck").options].map((o) => o.value)).toEqual([
      "us-states",
      "nyc",
    ]);
  });

  it("keeps the wide US map above the question, not beside it", () => {
    expect(byId("app").classList.contains("map-beside")).toBe(false);
  });

  it("puts the map beside the panels, not above them", () => {
    const workspace = document.querySelector(".workspace");
    expect(workspace).not.toBeNull();
    // Siblings under one container is what lets the wide layout make columns.
    expect(workspace?.querySelector(":scope > #map-slot")).not.toBeNull();
    expect(workspace?.querySelector(":scope > .panels")).not.toBeNull();
    for (const id of ["picker", "study", "drill", "cleared"]) {
      expect(document.querySelector(`.panels > #${id}`), id).not.toBeNull();
    }
  });

  it("draws the map the deck supplies", () => {
    expect(document.querySelectorAll(".us-map-state")).toHaveLength(50);
    expect(document.querySelector(".us-map")?.getAttribute("aria-label")).toBe(
      "Map of the United States",
    );
  });

  it("stores progress under the deck's own key", () => {
    openFirstGroupAndDrill();
    clearGroup();
    expect(localStorage.getItem("statelearner:cleared:us-states")).toContain("new-england");
    expect(localStorage.getItem("statelearner:cleared")).toBeNull();
  });
});

describe("the NYC deck", () => {
  function chooseNyc(): void {
    const select = byId<HTMLSelectElement>("deck");
    select.value = "nyc";
    select.dispatchEvent(new Event("change"));
  }

  function setDirection(value: string): void {
    const select = byId<HTMLSelectElement>("direction");
    select.value = value;
    select.dispatchEvent(new Event("change"));
  }

  function openFirstSection(): void {
    document
      .querySelector<HTMLButtonElement>(".group-row:not(.is-everything):not(.is-region) .group")
      ?.click();
  }

  beforeEach(() => {
    chooseNyc();
  });

  it("swaps in its own map and sections", () => {
    expect(document.querySelector(".us-map")?.getAttribute("aria-label")).toBe(
      "Map of New York City neighborhoods",
    );
    expect(document.querySelectorAll(".us-map-state")).toHaveLength(35);
    // The land silhouette for context, and Central Park as a hole in the grid.
    expect(document.querySelector(".landmark-land")).not.toBeNull();
    expect(document.querySelector(".landmark-central-park")).not.toBeNull();
    expect(document.querySelectorAll(".us-map-landmark")).toHaveLength(2);
  });

  it("puts its tall map beside the question", () => {
    expect(byId("app").classList.contains("map-beside")).toBe(true);
    const box = (nycDeck.map?.viewBox ?? "").split(" ").map(Number);
    expect(box[3]).toBeGreaterThan(box[2] ?? 0);
  });

  it("names its modes after neighborhood and location", () => {
    expect([...byId<HTMLSelectElement>("direction").options].map((o) => o.textContent)).toEqual([
      "Neighborhood → Location",
      "Location → Neighborhood",
      "Mixed",
    ]);
  });

  it("keeps the map on screen, with no toggle to hide it", () => {
    expect(byId("map-toggle-label").hidden).toBe(true);
    const toggle = byId<HTMLInputElement>("map-toggle");
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    expect(byId("map-slot").hidden).toBe(false);
  });

  it("asks by highlighting, without naming the answer", () => {
    setDirection("back-to-front");
    openFirstSection();
    expect(byId("prompt").textContent).toBe("Which one is highlighted?");
    expect(document.querySelector(".us-map-state.is-active")).not.toBeNull();
    // Nothing on screen may say the name before it is answered.
    expect(document.querySelector("#prompt-row .speak")).toBeNull();
  });

  it("is answered by clicking the right region", () => {
    setDirection("front-to-back");
    openFirstSection();
    const name = byId("prompt").textContent ?? "";
    const card = nycDeck.cards.find((c) => c.front === name);
    expect(card).toBeDefined();

    expect(byId("click-hint").hidden).toBe(false);
    expect(byId<HTMLInputElement>("answer").hidden).toBe(true);
    // Not marked until answered, or the click would be free.
    expect(document.querySelector(".us-map-state.is-active")).toBeNull();

    document.querySelectorAll<SVGPathElement>(".us-map-state")[
      Object.keys(nycDeck.map?.paths ?? {}).indexOf(card?.id ?? "")
    ]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(byId("feedback").className).toContain("ok");
  });

  it("restarts the section when the wrong region is clicked", () => {
    setDirection("front-to-back");
    openFirstSection();
    const name = byId("prompt").textContent ?? "";
    const wrong = nycDeck.cards.find((c) => c.front !== name);

    document.querySelectorAll<SVGPathElement>(".us-map-state")[
      Object.keys(nycDeck.map?.paths ?? {}).indexOf(wrong?.id ?? "")
    ]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(byId("feedback").className).toContain("bad");
    advance();
    expect(byId("attempt").textContent).toBe("Attempt 2");
  });

  it("keeps its progress separate from the states deck", () => {
    setDirection("back-to-front");
    openFirstSection();
    expect(localStorage.getItem("statelearner:cleared:us-states")).toBeNull();
  });
});
