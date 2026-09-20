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

/** Opens the first group and skips to the drill. */
function openFirstGroupAndDrill(): void {
  document.querySelectorAll<HTMLButtonElement>(".group")[0]?.click();
  byId<HTMLButtonElement>("study-skip").click();
}

beforeEach(async () => {
  await boot();
});

describe("boot", () => {
  it("starts on the group picker with all nine divisions", () => {
    expect(visible("picker")).toBe(true);
    expect(document.querySelectorAll(".group")).toHaveLength(9);
    expect(byId("title").textContent).toBe("StateLearner");
  });

  it("draws all 50 states", () => {
    expect(document.querySelectorAll(".us-map-state")).toHaveLength(50);
  });
});

describe("study pass", () => {
  it("opens a group into study, showing both sides", () => {
    document.querySelectorAll<HTMLButtonElement>(".group")[0]?.click();
    expect(visible("study")).toBe(true);
    expect(visible("picker")).toBe(false);
    expect(byId("title").textContent).toBe("New England");
    expect(byId("study-front").textContent).toBeTruthy();
    expect(byId("study-back").textContent).toBeTruthy();
  });

  it("walks every card, then starts the drill", () => {
    document.querySelectorAll<HTMLButtonElement>(".group")[0]?.click();
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
    // The prompt is a state; look its capital up from the rendered deck.
    const capitals: Record<string, string> = {
      Connecticut: "Hartford",
      Maine: "Augusta",
      Massachusetts: "Boston",
      "New Hampshire": "Concord",
      "Rhode Island": "Providence",
      Vermont: "Montpelier",
    };
    answer(capitals[byId("prompt").textContent ?? ""] ?? "");
    expect(byId("feedback").className).toContain("ok");
    advance();
    expect(byId("drill-position").textContent).toBe("2 of 6");
  });

  it("clears the group only after an unbroken run, and remembers it", () => {
    const capitals: Record<string, string> = {
      Connecticut: "Hartford",
      Maine: "Augusta",
      Massachusetts: "Boston",
      "New Hampshire": "Concord",
      "Rhode Island": "Providence",
      Vermont: "Montpelier",
    };
    openFirstGroupAndDrill();
    for (let i = 0; i < 6; i++) {
      answer(capitals[byId("prompt").textContent ?? ""] ?? "");
      advance();
    }
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
