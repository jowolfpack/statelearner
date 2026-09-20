/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { migrateLegacyProgress, progressFor, settings } from "./storage";

beforeEach(() => {
  localStorage.clear();
});

describe("per-deck progress", () => {
  it("keeps one deck's cleared groups out of another's", () => {
    const states = progressFor("us-states");
    const other = progressFor("manhattan");

    states.markCleared("new-england");
    expect([...states.cleared()]).toEqual(["new-england"]);
    expect([...other.cleared()]).toEqual([]);

    other.markCleared("downtown");
    expect([...states.cleared()]).toEqual(["new-england"]);
    expect([...other.cleared()]).toEqual(["downtown"]);
  });

  it("resets only the deck asked for", () => {
    progressFor("us-states").markCleared("mountain");
    progressFor("manhattan").markCleared("downtown");

    progressFor("manhattan").reset();
    expect([...progressFor("us-states").cleared()]).toEqual(["mountain"]);
    expect([...progressFor("manhattan").cleared()]).toEqual([]);
  });

  it("survives a corrupt stored value", () => {
    localStorage.setItem("statelearner:cleared:us-states", "{not json");
    expect([...progressFor("us-states").cleared()]).toEqual([]);
  });

  it("ignores non-string entries", () => {
    localStorage.setItem("statelearner:cleared:us-states", '["east", 7, null]');
    expect([...progressFor("us-states").cleared()]).toEqual(["east"]);
  });
});

describe("legacy progress migration", () => {
  it("moves pre-multi-deck progress onto the states deck", () => {
    localStorage.setItem("statelearner:cleared", '["east","pacific"]');

    migrateLegacyProgress("us-states");

    expect([...progressFor("us-states").cleared()].sort()).toEqual(["east", "pacific"]);
    expect(localStorage.getItem("statelearner:cleared")).toBeNull();
  });

  it("cannot hand the same progress to a second deck later", () => {
    localStorage.setItem("statelearner:cleared", '["east"]');
    migrateLegacyProgress("us-states");
    // The legacy key is gone, so a later deck inherits nothing.
    migrateLegacyProgress("manhattan");
    expect([...progressFor("manhattan").cleared()]).toEqual([]);
  });

  it("never overwrites progress the deck already has", () => {
    progressFor("us-states").markCleared("mountain");
    localStorage.setItem("statelearner:cleared", '["east"]');

    migrateLegacyProgress("us-states");

    expect([...progressFor("us-states").cleared()]).toEqual(["mountain"]);
    expect(localStorage.getItem("statelearner:cleared")).toBeNull();
  });

  it("does nothing without a legacy value", () => {
    expect(() => migrateLegacyProgress("us-states")).not.toThrow();
    expect([...progressFor("us-states").cleared()]).toEqual([]);
  });
});

describe("deck setting", () => {
  it("round-trips the chosen deck", () => {
    expect(settings.deck()).toBeNull();
    settings.setDeck("manhattan");
    expect(settings.deck()).toBe("manhattan");
  });
});
