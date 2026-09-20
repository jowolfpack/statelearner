import { describe, expect, it } from "vitest";
import { matchesAnswer, normalize } from "./normalize";

describe("normalize", () => {
  it("ignores case, padding and inner punctuation", () => {
    expect(normalize("  Salt-Lake   CITY ")).toBe("salt lake city");
  });

  it("treats St. as Saint", () => {
    expect(normalize("St. Paul")).toBe(normalize("Saint Paul"));
  });

  it("strips accents", () => {
    expect(normalize("Montpélier")).toBe("montpelier");
  });
});

describe("matchesAnswer", () => {
  it("accepts any listed spelling", () => {
    expect(matchesAnswer("wy", ["Wyoming", "WY"])).toBe(true);
  });

  it("rejects a different answer", () => {
    expect(matchesAnswer("Cheyenne", ["Wyoming", "WY"])).toBe(false);
  });

  it("rejects blank input even against a blank candidate", () => {
    expect(matchesAnswer("   ", ["Wyoming", ""])).toBe(false);
  });
});
