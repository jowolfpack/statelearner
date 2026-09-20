import type { Card, Deck, Group } from "./data/types";
import { cardsOf } from "./data/types";
import { matchesAnswer } from "./normalize";
import { questionFor, shuffled, type Direction, type Question } from "./quiz";

export type Phase = "study" | "drill" | "cleared";

export interface DrillResult {
  correct: boolean;
  answer: string;
}

export interface GroupSessionOptions {
  direction: Direction;
  /** Injectable for deterministic tests; defaults to Math.random. */
  rng?: () => number;
  /** Go straight to the drill, for a group that has been cleared before. */
  skipStudy?: boolean;
}

/**
 * One group, learned in two phases.
 *
 * Study shows both sides of every card in a fixed order. The drill then asks
 * each card in a shuffled order: a correct answer advances, and a wrong answer
 * reveals the correct one and sends you back to the start of the group with a
 * fresh shuffle. A group is cleared only by answering every card correctly in
 * one unbroken run -- there is deliberately no restart limit and no way back to
 * Study once the drill has begun.
 */
export class GroupSession {
  private readonly cards: Card[];
  private readonly rng: () => number;
  private readonly direction: Direction;

  private phaseValue: Phase;
  private studyIndex = 0;
  private queue: Question[] = [];
  private drillIndex = 0;
  private result: DrillResult | null = null;
  private attemptValue = 1;

  constructor(
    readonly deck: Deck,
    readonly group: Group,
    options: GroupSessionOptions,
  ) {
    this.cards = cardsOf(deck, group);
    if (this.cards.length === 0) throw new Error(`Group ${group.id} has no cards`);
    this.rng = options.rng ?? Math.random;
    this.direction = options.direction;
    this.phaseValue = options.skipStudy === true ? "drill" : "study";
    if (this.phaseValue === "drill") this.queue = this.buildQueue();
  }

  get phase(): Phase {
    return this.phaseValue;
  }

  get size(): number {
    return this.cards.length;
  }

  /** 1-based; increments every time a wrong answer restarts the group. */
  get attempt(): number {
    return this.attemptValue;
  }

  // -- Study -------------------------------------------------------------

  get studyCard(): Card | null {
    return this.phaseValue === "study" ? (this.cards[this.studyIndex] ?? null) : null;
  }

  get studyPosition(): number {
    return this.studyIndex;
  }

  /** Advances the study pass; past the last card the drill begins. */
  studyNext(): void {
    if (this.phaseValue !== "study") return;
    this.studyIndex++;
    if (this.studyIndex >= this.cards.length) this.beginDrill();
  }

  /** Ends the study pass early. */
  beginDrill(): void {
    if (this.phaseValue !== "study") return;
    this.phaseValue = "drill";
    this.queue = this.buildQueue();
  }

  // -- Drill -------------------------------------------------------------

  get question(): Question | null {
    return this.phaseValue === "drill" ? (this.queue[this.drillIndex] ?? null) : null;
  }

  /** How many cards of this run are already behind you. */
  get drillPosition(): number {
    return this.drillIndex;
  }

  /** The current question's result, or null while it is unanswered. */
  get lastResult(): DrillResult | null {
    return this.result;
  }

  /** Grades `input`. Repeat calls for the same question are ignored. */
  submit(input: string): DrillResult | null {
    const question = this.question;
    if (question === null || this.result !== null) return this.result;
    this.result = {
      correct: matchesAnswer(input, question.accepted),
      answer: question.answer,
    };
    return this.result;
  }

  /** Gives up on the current question, which restarts the group. */
  reveal(): DrillResult | null {
    const question = this.question;
    if (question === null || this.result !== null) return this.result;
    this.result = { correct: false, answer: question.answer };
    return this.result;
  }

  /**
   * Moves on from a graded question: forward on a correct answer, back to the
   * start of a freshly shuffled group on a wrong one. No-op while ungraded.
   */
  next(): void {
    if (this.result === null) return;
    const correct = this.result.correct;
    this.result = null;

    if (!correct) {
      this.attemptValue++;
      this.queue = this.buildQueue();
      this.drillIndex = 0;
      return;
    }

    this.drillIndex++;
    if (this.drillIndex >= this.queue.length) this.phaseValue = "cleared";
  }

  private buildQueue(): Question[] {
    return shuffled(this.cards, this.rng).map((card) =>
      questionFor(this.deck, card, this.direction, this.rng),
    );
  }
}
