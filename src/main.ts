import "./style.css";
import { usStatesDeck } from "./data/us-states";
import { wholeDeckGroup, type Group } from "./data/types";
import { GroupSession } from "./group-session";
import { UsMap } from "./map";
import { progress, settings, type Theme } from "./storage";
import { applyTheme, initTheme } from "./theme";
import { createSpeaker } from "./speech";
import type { Direction } from "./quiz";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Missing element #${id}`);
  return node as T;
}

const ui = {
  back: el<HTMLButtonElement>("back"),
  title: el("title"),
  direction: el<HTMLSelectElement>("direction"),
  theme: el<HTMLSelectElement>("theme"),
  mapToggle: el<HTMLInputElement>("map-toggle"),
  soundToggle: el<HTMLInputElement>("sound-toggle"),
  soundToggleLabel: el("sound-toggle-label"),
  mapSlot: el("map-slot"),

  picker: el("picker"),
  groupList: el<HTMLUListElement>("group-list"),
  resetProgress: el<HTMLButtonElement>("reset-progress"),

  study: el("study"),
  studyPosition: el("study-position"),
  studyFrontLabel: el("study-front-label"),
  studyFront: el("study-front"),
  studyFrontRow: el("study-front-row"),
  studyBackLabel: el("study-back-label"),
  studyBack: el("study-back"),
  studyBackRow: el("study-back-row"),
  studyNext: el<HTMLButtonElement>("study-next"),
  studySkip: el<HTMLButtonElement>("study-skip"),

  drill: el("drill"),
  progressBar: el("progress-bar"),
  drillPosition: el("drill-position"),
  attempt: el("attempt"),
  promptLabel: el("prompt-label"),
  prompt: el("prompt"),
  promptRow: el("prompt-row"),
  form: el<HTMLFormElement>("answer-form"),
  answer: el<HTMLInputElement>("answer"),
  submit: el<HTMLButtonElement>("submit"),
  feedback: el("feedback"),
  giveUp: el<HTMLButtonElement>("give-up"),

  cleared: el("cleared"),
  clearedDetail: el("cleared-detail"),
  nextGroup: el<HTMLButtonElement>("next-group"),
  backToGroups: el<HTMLButtonElement>("back-to-groups"),
};

const deck = usStatesDeck;
const everyState = wholeDeckGroup(deck);
const map = new UsMap();
const speech = createSpeaker();
ui.mapSlot.append(map.element);

let session: GroupSession | null = null;

const SPEAKER_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4z"/>' +
  '<path d="M15.5 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round"/></svg>';

/**
 * Attaches a speaker button to `container`, replacing any previous one.
 *
 * Passing null removes it. That is how the spoiler rule is enforced: a speaker
 * is only ever mounted for text already on screen, so it can never read out an
 * answer the user has not been shown -- the same trap the map avoids.
 */
function mountSpeaker(container: HTMLElement, spoken: string | null, label: string): void {
  container.querySelector(".speak")?.remove();
  if (!speech.supported || spoken === null || spoken === "") return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "speak";
  button.title = `Hear "${label}"`;
  button.setAttribute("aria-label", `Hear "${label}"`);
  button.innerHTML = SPEAKER_ICON;
  button.addEventListener("click", () => speech.speak(spoken));
  container.append(button);
}

// -- Rendering -----------------------------------------------------------

function render(): void {
  const phase = session?.phase ?? null;

  ui.picker.hidden = session !== null;
  ui.study.hidden = phase !== "study";
  ui.drill.hidden = phase !== "drill";
  ui.cleared.hidden = phase !== "cleared";
  ui.back.hidden = session === null;
  ui.title.textContent = session === null ? "StateLearner" : session.group.name;

  if (session === null) renderPicker();
  else if (phase === "study") renderStudy(session);
  else if (phase === "drill") renderDrill(session);
  else renderCleared(session);

  renderMap();
}

function groupRow(group: Group, cleared: Set<string>): HTMLLIElement {
  const open = document.createElement("button");
  open.type = "button";
  open.className = "group";
  if (cleared.has(group.id)) open.classList.add("is-cleared");
  open.addEventListener("click", () => startGroup(group));

  const name = document.createElement("span");
  name.className = "group-name";
  name.textContent = group.name;

  const count = document.createElement("span");
  count.className = "group-count";
  count.textContent = cleared.has(group.id)
    ? `${group.cardIds.length} · cleared`
    : `${group.cardIds.length}`;

  open.append(name, count);

  // Study is the opt-in path, so it gets its own quieter control.
  const study = document.createElement("button");
  study.type = "button";
  study.className = "group-study";
  study.textContent = "Study";
  study.title = `Read through ${group.name} with the capitals shown, then drill`;
  study.addEventListener("click", () => startGroup(group, true));

  const item = document.createElement("li");
  item.className = "group-row";
  item.append(open, study);
  return item;
}

function renderPicker(): void {
  const cleared = progress.cleared();

  const everything = groupRow(everyState, cleared);
  everything.classList.add("is-everything");

  // Widest first: the whole deck, then the coarse regions, then the divisions.
  const regions = (deck.regions ?? []).map((region) => {
    const row = groupRow(region, cleared);
    row.classList.add("is-region");
    return row;
  });

  ui.groupList.replaceChildren(
    everything,
    ...regions,
    ...deck.groups.map((group) => groupRow(group, cleared)),
  );
}

function renderStudy(active: GroupSession): void {
  const card = active.studyCard;
  if (card === null) return;
  const last = active.studyPosition + 1 === active.size;

  ui.studyPosition.textContent = `${active.studyPosition + 1} of ${active.size}`;
  ui.studyFrontLabel.textContent = deck.frontLabel;
  ui.studyFront.textContent = card.front;
  ui.studyBackLabel.textContent = deck.backLabel;
  ui.studyBack.textContent = card.back;
  mountSpeaker(ui.studyFrontRow, card.frontSpoken ?? card.front, card.front);
  mountSpeaker(ui.studyBackRow, card.backSpoken ?? card.back, card.back);
  ui.studyNext.textContent = last ? "Start drill" : "Next";
  ui.studySkip.hidden = last;
}

function renderDrill(active: GroupSession): void {
  const question = active.question;
  if (question === null) return;
  const result = active.lastResult;

  ui.progressBar.style.width = `${(active.drillPosition / active.size) * 100}%`;
  ui.drillPosition.textContent = `${active.drillPosition + 1} of ${active.size}`;
  ui.attempt.textContent = active.attempt === 1 ? "" : `Attempt ${active.attempt}`;
  ui.promptLabel.textContent = question.promptLabel;
  ui.prompt.textContent = question.prompt;

  // Once graded, the same form advances instead of grading again.
  ui.answer.readOnly = result !== null;
  ui.submit.textContent = result === null ? "Check" : result.correct ? "Next" : "Start over";
  ui.giveUp.hidden = result !== null;

  if (result === null) {
    ui.feedback.replaceChildren();
    ui.feedback.className = "feedback spoken";
    ui.answer.value = "";
  } else if (result.correct) {
    ui.feedback.replaceChildren(document.createTextNode("Correct"));
    ui.feedback.className = "feedback spoken ok";
  } else {
    ui.feedback.replaceChildren(
      document.createTextNode(`${result.answer} — back to the start`),
    );
    ui.feedback.className = "feedback spoken bad";
  }

  // The prompt is on screen, so it is always safe to offer; the answer only
  // once it has been revealed.
  mountSpeaker(ui.promptRow, question.promptSpoken, question.prompt);
  mountSpeaker(ui.feedback, result === null ? null : question.answerSpoken, question.answer);

  ui.answer.focus();
}

/**
 * The next group in whichever tier this one belongs to -- division after
 * division, region after region. Undefined at the end of a tier, and for the
 * whole-deck run, which belongs to no tier.
 */
function nextInSameTier(current: Group): Group | undefined {
  for (const tier of [deck.groups, deck.regions ?? []]) {
    const index = tier.findIndex((group) => group.id === current.id);
    if (index !== -1) return tier[index + 1];
  }
  return undefined;
}

function renderCleared(active: GroupSession): void {
  ui.progressBar.style.width = "100%";
  ui.nextGroup.hidden = nextInSameTier(active.group) === undefined;
  ui.clearedDetail.textContent =
    active.attempt === 1
      ? `${active.size} of ${active.size}, first run, no mistakes.`
      : `${active.size} of ${active.size} after ${active.attempt} attempts.`;
}

/**
 * The map must not give the answer away: when the state is what you are being
 * asked for, it stays unmarked until the question has been graded.
 */
function highlightedCardId(): string | null {
  if (session === null) return null;
  if (session.phase === "study") return session.studyCard?.id ?? null;

  const question = session.question;
  if (question === null) return null;

  const stateIsThePrompt = question.promptLabel === deck.frontLabel;
  return stateIsThePrompt || session.lastResult !== null ? question.cardId : null;
}

function renderMap(): void {
  const enabled = settings.mapEnabled();
  ui.mapSlot.hidden = !enabled;
  map.highlight(enabled ? highlightedCardId() : null);
}

// -- Flow ----------------------------------------------------------------

function startGroup(group: Group, studyFirst = false): void {
  session = new GroupSession(deck, group, {
    direction: settings.direction(),
    // Drilling is the point, so it is the default; study is opt-in per group.
    skipStudy: !studyFirst,
  });
  render();
}

function leaveGroup(): void {
  speech.cancel();
  session = null;
  render();
}

// -- Events --------------------------------------------------------------

ui.back.addEventListener("click", leaveGroup);
ui.backToGroups.addEventListener("click", leaveGroup);

ui.studyNext.addEventListener("click", () => {
  session?.studyNext();
  render();
});

ui.studySkip.addEventListener("click", () => {
  session?.beginDrill();
  render();
});

/** Reads the answer out once it is on screen, whether right or wrong. */
function announce(answerSpoken: string): void {
  if (settings.soundEnabled()) speech.speak(answerSpoken);
}

ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (session === null) return;

  if (session.lastResult === null) {
    const question = session.question;
    session.submit(ui.answer.value);
    if (question !== null && session.lastResult !== null) announce(question.answerSpoken);
  } else {
    session.next();
  }

  if (session.phase === "cleared") progress.markCleared(session.group.id);
  render();
});

ui.giveUp.addEventListener("click", () => {
  if (session === null) return;
  const question = session.question;
  session.reveal();
  if (question !== null && session.lastResult !== null) announce(question.answerSpoken);
  render();
});

ui.nextGroup.addEventListener("click", () => {
  if (session === null) return;
  const next = nextInSameTier(session.group);
  if (next === undefined) leaveGroup();
  else startGroup(next);
});

ui.direction.addEventListener("change", () => {
  const direction = ui.direction.value as Direction;
  settings.setDirection(direction);
  // Switching direction mid-group is a different exercise, so restart it --
  // staying in whichever phase you were already in.
  if (session !== null) startGroup(session.group, session.phase === "study");
  else render();
});

ui.theme.addEventListener("change", () => {
  const theme = ui.theme.value as Theme;
  settings.setTheme(theme);
  applyTheme(theme);
});

ui.soundToggle.addEventListener("change", () => {
  settings.setSoundEnabled(ui.soundToggle.checked);
  if (!ui.soundToggle.checked) speech.cancel();
});

ui.mapToggle.addEventListener("change", () => {
  settings.setMapEnabled(ui.mapToggle.checked);
  renderMap();
});

ui.resetProgress.addEventListener("click", () => {
  progress.reset();
  render();
});

// -- Boot ----------------------------------------------------------------

ui.theme.value = initTheme();
ui.direction.value = settings.direction();
ui.mapToggle.checked = settings.mapEnabled();
ui.soundToggle.checked = settings.soundEnabled();
// No point offering a switch for something this browser cannot do.
ui.soundToggleLabel.hidden = !speech.supported;
render();
