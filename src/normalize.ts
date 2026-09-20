/**
 * Fold an answer down to the form we compare on: accents dropped, case and
 * punctuation ignored, whitespace collapsed. "St. Paul", "saint  paul" and
 * "SAINT-PAUL" all become "saint paul".
 */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bst\.?\b/g, "saint")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when `input` matches any of the spellings we accept. */
export function matchesAnswer(input: string, accepted: readonly string[]): boolean {
  const given = normalize(input);
  return given.length > 0 && accepted.some((candidate) => normalize(candidate) === given);
}
