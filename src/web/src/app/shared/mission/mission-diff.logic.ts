/**
 * The word-level comparison of two mission versions (issue #62), apart from `mission.logic.ts` so
 * the Shared mission (#66) can import it alone. Pure, no library.
 */

/** One part of a word-level diff: a run of words that are in both texts, only the newer one
 * (`added`) or only the older one (`removed`). */
export interface DiffPart {
  readonly kind: 'same' | 'added' | 'removed';
  readonly text: string;
}

function tokens(text: string): string[] {
  return text.split(/\s+/).filter((token) => token !== '');
}

/**
 * The words of `before` and `after` as runs of same / removed / added, in reading order: a longest
 * common subsequence over whitespace-split tokens (which holds for Arabic as for English); on a tie
 * the removed words come first, so a replaced phrase reads old then new. Whitespace isn't
 * compared, so a re-wrapped line is no change. The common prefix and suffix are matched first and
 * the table (typed-array rows) covers only the changed middle, so a small edit to a long draft
 * stays cheap in time and memory.
 */
export function diffWords(before: string, after: string): readonly DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start++;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const words: { kind: DiffPart['kind']; word: string }[] = a
    .slice(0, start)
    .map((word) => ({ kind: 'same', word }));
  words.push(...middleDiff(a.slice(start, endA), b.slice(start, endB)));
  words.push(...a.slice(endA).map((word) => ({ kind: 'same' as const, word })));
  return runsOf(words);
}

/** The LCS walk over two token lists that share no prefix or suffix. */
function middleDiff(
  a: readonly string[],
  b: readonly string[],
): { kind: DiffPart['kind']; word: string }[] {
  // lcs[i][j]: the common subsequence length of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const words: { kind: DiffPart['kind']; word: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      words.push({ kind: 'same', word: a[i] });
      i++;
      j++;
    } else if (j >= b.length || (i < a.length && lcs[i + 1][j] >= lcs[i][j + 1])) {
      words.push({ kind: 'removed', word: a[i] });
      i++;
    } else {
      words.push({ kind: 'added', word: b[j] });
      j++;
    }
  }
  return words;
}

/** Consecutive words of one kind joined into one run. */
function runsOf(words: readonly { kind: DiffPart['kind']; word: string }[]): readonly DiffPart[] {
  const parts: { kind: DiffPart['kind']; words: string[] }[] = [];
  for (const { kind, word } of words) {
    const last = parts.at(-1);
    if (last?.kind === kind) {
      last.words.push(word);
    } else {
      parts.push({ kind, words: [word] });
    }
  }
  return parts.map((part) => ({ kind: part.kind, text: part.words.join(' ') }));
}

export interface DiffSummary {
  readonly added: number;
  readonly removed: number;
}

/** The words added and removed across `parts` ("{{added}} words added, {{removed}} removed"). */
export function diffSummary(parts: readonly DiffPart[]): DiffSummary {
  const count = (kind: DiffPart['kind']) =>
    parts
      .filter((part) => part.kind === kind)
      .reduce((sum, part) => sum + tokens(part.text).length, 0);
  return { added: count('added'), removed: count('removed') };
}
