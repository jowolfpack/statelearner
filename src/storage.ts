import type { Direction } from "./quiz";

export type Theme = "system" | "light" | "dark";

const KEYS = {
  direction: "statelearner:direction",
  theme: "statelearner:theme",
  map: "statelearner:map",
  cleared: "statelearner:cleared",
} as const;

/** localStorage throws in some privacy modes; settings are never worth a crash. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

export const settings = {
  direction(): Direction {
    return oneOf(
      read(KEYS.direction),
      ["front-to-back", "back-to-front", "mixed"] as const,
      "front-to-back",
    );
  },
  setDirection(value: Direction): void {
    write(KEYS.direction, value);
  },

  theme(): Theme {
    return oneOf(read(KEYS.theme), ["system", "light", "dark"] as const, "system");
  },
  setTheme(value: Theme): void {
    write(KEYS.theme, value);
  },

  mapEnabled(): boolean {
    return read(KEYS.map) !== "off";
  },
  setMapEnabled(value: boolean): void {
    write(KEYS.map, value ? "on" : "off");
  },
};

/** Ids of groups cleared at least once, used only to mark the group list. */
export const progress = {
  cleared(): Set<string> {
    const raw = read(KEYS.cleared);
    if (raw === null) return new Set();
    try {
      const parsed: unknown = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
    } catch {
      return new Set();
    }
  },
  markCleared(groupId: string): void {
    const ids = progress.cleared();
    ids.add(groupId);
    write(KEYS.cleared, JSON.stringify([...ids]));
  },
  reset(): void {
    write(KEYS.cleared, "[]");
  },
};
