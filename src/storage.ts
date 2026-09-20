import type { Direction } from "./quiz";

export type Theme = "dark" | "light";

const KEYS = {
  direction: "statelearner:direction",
  theme: "statelearner:theme",
  map: "statelearner:map",
  sound: "statelearner:sound",
  deck: "statelearner:deck",
} as const;

/** Progress was a single global key before there was more than one deck. */
const LEGACY_CLEARED = "statelearner:cleared";
const clearedKey = (deckId: string) => `statelearner:cleared:${deckId}`;

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

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
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
    // A stored "system" from an older build falls through to the dark default.
    return oneOf(read(KEYS.theme), ["dark", "light"] as const, "dark");
  },
  setTheme(value: Theme): void {
    write(KEYS.theme, value);
  },

  /**
   * Governs auto-play only; the speaker buttons work either way. Off unless
   * switched on, so the app never starts talking unasked.
   */
  soundEnabled(): boolean {
    return read(KEYS.sound) === "on";
  },
  setSoundEnabled(value: boolean): void {
    write(KEYS.sound, value ? "on" : "off");
  },

  deck(): string | null {
    return read(KEYS.deck);
  },
  setDeck(value: string): void {
    write(KEYS.deck, value);
  },

  mapEnabled(): boolean {
    return read(KEYS.map) !== "off";
  },
  setMapEnabled(value: boolean): void {
    write(KEYS.map, value ? "on" : "off");
  },
};

/**
 * Moves pre-multi-deck progress onto the states deck. Runs once: the legacy key
 * is dropped afterwards, so a later deck can never inherit it.
 */
export function migrateLegacyProgress(statesDeckId: string): void {
  const legacy = read(LEGACY_CLEARED);
  if (legacy === null) return;
  if (read(clearedKey(statesDeckId)) === null) write(clearedKey(statesDeckId), legacy);
  remove(LEGACY_CLEARED);
}

export interface Progress {
  cleared(): Set<string>;
  markCleared(groupId: string): void;
  reset(): void;
}

/** Ids of groups cleared at least once, per deck, used to mark the group list. */
export function progressFor(deckId: string): Progress {
  const key = clearedKey(deckId);
  const self: Progress = {
    cleared(): Set<string> {
      const raw = read(key);
      if (raw === null) return new Set();
      try {
        const parsed: unknown = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
      } catch {
        return new Set();
      }
    },
    markCleared(groupId: string): void {
      const ids = self.cleared();
      ids.add(groupId);
      write(key, JSON.stringify([...ids]));
    },
    reset(): void {
      write(key, "[]");
    },
  };
  return self;
}
