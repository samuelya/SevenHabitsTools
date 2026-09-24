/**
 * The app's English is en-GB (issue #218). Each pattern matches one en-US spelling from a fixed
 * list; `usSpellingsIn()` reports every match so a spec can fail on it. "Synergize" is the book's
 * own term and deliberately not listed: there's no general `-ize` rule, only these words.
 */
export const US_SPELLINGS: readonly RegExp[] = [
  /\brecogniz\w*/i,
  /\bbehavior\w*/i,
  /\bjudgment\w*/i,
  /\bcolor(?:s|ed|ful|ing)?\b/i,
  /\bfavor(?:s|ed|ing|ite|ites)?\b/i,
  /\bhonor(?:s|ed|ing)?\b/i,
  /\bhumor\b/i,
  /\bneighbor\w*/i,
  /\blabor(?:s|ed|ing)?\b/i,
  /\bcenter(?:s|ed|ing)?\b/i,
  /\borganiz\w*/i,
  /\brealiz\w*/i,
  /\bprioritiz\w*/i,
  /\banalyz\w*/i,
  /\bsummariz\w*/i,
  /\bapologiz\w*/i,
  /\bemphasiz\w*/i,
  /\bmemoriz\w*/i,
  /\bcriticiz\w*/i,
  /\bminimiz\w*/i,
  /\bmaximiz\w*/i,
  /\bcategoriz\w*/i,
  /\bpersonaliz\w*/i,
  /\bvisualiz\w*/i,
  /\bcatalog(?:s)?\b/i,
  /\bgray\b/i,
  /\bcancel(?:ed|ing)\b/i,
  /\btravel(?:ed|ing|er|ers)\b/i,
  /\blabel(?:ed|ing)\b/i,
  /\bfulfill(?:s|ment)?\b/i,
  /\benroll(?:s|ment)?\b/i,
  /\bskillful\w*/i,
  /\btheater\w*/i,
  /\bpracticing\b/i,
];

/** Every en-US spelling (from `US_SPELLINGS`) found in `text`, as written. */
export function usSpellingsIn(text: string): string[] {
  const found: string[] = [];
  for (const pattern of US_SPELLINGS) {
    const global = new RegExp(pattern.source, 'gi');
    for (const match of text.matchAll(global)) {
      found.push(match[0]);
    }
  }
  return found;
}

/** Every string value in a translation file, with its dotted key path. Keys aren't user-facing,
 * so only values are checked. */
export function translationStrings(
  value: unknown,
  path = '',
): { readonly key: string; readonly text: string }[] {
  if (typeof value === 'string') {
    return [{ key: path, text: value }];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      translationStrings(child, path ? `${path}.${key}` : key),
    );
  }
  return [];
}
