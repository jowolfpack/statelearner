/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpeaker } from "./speech";
import { usStatesDeck } from "./data/us-states";
import { questionFor } from "./quiz";

/** jsdom implements neither API, so a recording stub stands in. */
function installSynth(overrides: Partial<SpeechSynthesis> = {}) {
  const spoken: string[] = [];
  const cancel = vi.fn();
  const synth = {
    speak: vi.fn((u: SpeechSynthesisUtterance) => spoken.push(u.text)),
    cancel,
    getVoices: () => [],
    addEventListener: vi.fn(),
    ...overrides,
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      lang = "";
      rate = 1;
      voice: unknown = null;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  return { spoken, synth, cancel };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createSpeaker", () => {
  it("speaks through the browser API", () => {
    const { spoken } = installSynth();
    createSpeaker().speak("Montpelier");
    expect(spoken).toEqual(["Montpelier"]);
  });

  it("cancels anything still talking before starting", () => {
    const { cancel } = installSynth();
    createSpeaker().speak("Boise");
    expect(cancel).toHaveBeenCalled();
  });

  it("ignores blank text", () => {
    const { spoken } = installSynth();
    const speaker = createSpeaker();
    speaker.speak("   ");
    speaker.speak("");
    expect(spoken).toEqual([]);
  });

  it("reports unsupported, and stays silent, without the API", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    const speaker = createSpeaker();
    expect(speaker.supported).toBe(false);
    expect(() => {
      speaker.speak("Denver");
      speaker.cancel();
    }).not.toThrow();
  });

  it("survives an engine that throws", () => {
    installSynth({
      speak: () => {
        throw new Error("engine exploded");
      },
    });
    const speaker = createSpeaker();
    expect(() => speaker.speak("Topeka")).not.toThrow();
  });
});

describe("pronunciation overrides", () => {
  const cardFor = (id: string) => {
    const card = usStatesDeck.cards.find((c) => c.id === id);
    if (card === undefined) throw new Error(`no card ${id}`);
    return card;
  };
  const rng = () => 0;

  it("hands the speech engine the respelling, not the spelling", () => {
    const question = questionFor(usStatesDeck, cardFor("sd"), "front-to-back", rng);
    expect(question.answer).toBe("Pierre");
    expect(question.answerSpoken).toBe("peer");
  });

  it("falls back to the written form when there is no override", () => {
    const question = questionFor(usStatesDeck, cardFor("co"), "front-to-back", rng);
    expect(question.answer).toBe("Denver");
    expect(question.answerSpoken).toBe("Denver");
  });

  it("carries the override whichever way round the card is asked", () => {
    const question = questionFor(usStatesDeck, cardFor("sd"), "back-to-front", rng);
    expect(question.prompt).toBe("Pierre");
    expect(question.promptSpoken).toBe("peer");
    expect(question.answerSpoken).toBe("South Dakota");
  });

  it("overrides only names that are actually listed", () => {
    const overridden = usStatesDeck.cards.filter(
      (c) => c.frontSpoken !== undefined || c.backSpoken !== undefined,
    );
    // Deliberately few: an override on a name the engine already says right
    // makes it worse.
    expect(overridden.length).toBeLessThan(15);
    expect(overridden.map((c) => c.id)).toContain("sd");
  });
});
