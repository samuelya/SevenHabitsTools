import { diffSummary, diffWords } from './mission-diff.logic';
import {
  addMonths,
  hubStatus,
  isReviewDue,
  nextReviewDate,
  MAX_NOTE_LENGTH,
  restoreNeedsConfirm,
  reviewOf,
  versionRows,
  withRestoredVersion,
  withReviewInterval,
  withReviewed,
  withVersion,
} from './mission.logic';
import { Mission, MissionVersion } from './mission.model';

const T0 = '2026-01-01T00:00:00.000Z';
const NOW = new Date('2026-02-10T10:00:00.000Z');

/** Noon UTC: the same local date in every timezone the suite runs in. */
const version = (id: string, date: string, text: string, note?: string): MissionVersion => ({
  id,
  savedAt: `${date}T12:00:00.000Z`,
  text,
  ...(note ? { note } : {}),
});

function mission(fields: Partial<Mission> = {}): Mission {
  return {
    id: 'm1',
    createdAt: T0,
    updatedAt: T0,
    values: [],
    principles: [],
    roleLines: [],
    toBe: [],
    toDo: [],
    draft: '',
    checklist: {},
    versions: [],
    ...fields,
  };
}

describe('diffWords (issue #62)', () => {
  it('returns nothing for two empty texts', () => {
    expect(diffWords('', '')).toEqual([]);
    expect(diffWords('  ', '\n')).toEqual([]);
  });

  it('reads identical texts as one same run, whatever the whitespace', () => {
    expect(diffWords('I keep my word', 'I  keep\nmy word ')).toEqual([
      { kind: 'same', text: 'I keep my word' },
    ]);
  });

  it('marks every word when nothing is shared, removed first', () => {
    expect(diffWords('old words', 'new text here')).toEqual([
      { kind: 'removed', text: 'old words' },
      { kind: 'added', text: 'new text here' },
    ]);
    expect(diffWords('', 'all new')).toEqual([{ kind: 'added', text: 'all new' }]);
    expect(diffWords('all gone', '')).toEqual([{ kind: 'removed', text: 'all gone' }]);
  });

  it('keeps the shared words in order around an edit', () => {
    const parts = diffWords('I want to be rich and present', 'I want to be present and kind');
    expect(parts.map((part) => part.kind)).toEqual(['same', 'removed', 'same', 'added']);
    expect(parts.filter((p) => p.kind === 'same').map((p) => p.text)).toEqual([
      'I want to be',
      'present',
    ]);
    expect(diffSummary(parts)).toEqual({ added: 2, removed: 2 });
  });

  it('compares Arabic tokens the same way', () => {
    const parts = diffWords('أريد أن أكون حاضرًا', 'أريد أن أكون صادقًا وحاضرًا');
    expect(parts).toEqual([
      { kind: 'same', text: 'أريد أن أكون' },
      { kind: 'removed', text: 'حاضرًا' },
      { kind: 'added', text: 'صادقًا وحاضرًا' },
    ]);
    expect(diffSummary(parts)).toEqual({ added: 2, removed: 1 });
  });

  it('sums nothing for identical texts', () => {
    expect(diffSummary(diffWords('same', 'same'))).toEqual({ added: 0, removed: 0 });
  });

  it('diffs two 3,000-word texts with a one-word change quickly (#62 review 8)', () => {
    const words = Array.from({ length: 3000 }, (_, index) => `w${index}`);
    const changed = [...words];
    changed[1500] = 'changed';
    const started = performance.now();
    const parts = diffWords(words.join(' '), changed.join(' '));
    expect(performance.now() - started).toBeLessThan(200);
    expect(parts.map((part) => part.kind)).toEqual(['same', 'removed', 'added', 'same']);
    expect(diffSummary(parts)).toEqual({ added: 1, removed: 1 });
  });
});

describe('versions list and restore (issue #62)', () => {
  const v1 = version('v1', '2026-01-10', 'I keep my word.');
  const v2 = version(
    'v2',
    '2026-02-01',
    'I keep my word and call first.',
    'Added the friend line.',
  );

  it('lists the versions newest first, numbered from the oldest', () => {
    expect(versionRows([v1, v2])).toEqual([
      {
        id: 'v2',
        n: 2,
        savedAt: v2.savedAt,
        note: 'Added the friend line.',
        words: 7,
        text: v2.text,
      },
      { id: 'v1', n: 1, savedAt: v1.savedAt, words: 4, text: v1.text },
    ]);
    expect(versionRows([])).toEqual([]);
  });

  it('copies the version into the draft and leaves the versions alone', () => {
    const current = mission({ versions: [v1, v2], draft: v2.text });
    const restored = withRestoredVersion(current, 'v1', NOW);
    expect(restored.draft).toBe(v1.text);
    expect(restored.versions).toBe(current.versions);
    expect(restored.updatedAt).toBe(NOW.toISOString());
    expect(withRestoredVersion(restored, 'v1', NOW)).toBe(restored);
    expect(withRestoredVersion(current, 'nope', NOW)).toBe(current);
  });

  it('asks only when the draft holds words no saved version has (#62 review 2)', () => {
    expect(restoreNeedsConfirm(mission({ versions: [v1, v2], draft: v2.text }))).toBe(false);
    // An older saved version as the draft loses nothing either.
    expect(restoreNeedsConfirm(mission({ versions: [v1, v2], draft: `  ${v1.text} ` }))).toBe(
      false,
    );
    expect(restoreNeedsConfirm(mission({ versions: [v1, v2], draft: 'New words' }))).toBe(true);
    expect(restoreNeedsConfirm(mission({ versions: [v1, v2], draft: ' ' }))).toBe(false);
    expect(restoreNeedsConfirm(null)).toBe(false);
  });

  it('stores a note normalised, and none when blank', () => {
    const saved = withVersion(mission({ draft: 'x' }), 'v1', NOW, '  cut  the part ');
    expect(saved.versions[0].note).toBe('cut the part');
    expect('note' in withVersion(mission({ draft: 'x' }), 'v1', NOW, '  ').versions[0]).toBe(false);
  });

  it('clamps a note to MAX_NOTE_LENGTH, on save and on display (#62 review 9)', () => {
    const long = 'a'.repeat(MAX_NOTE_LENGTH + 20);
    const saved = withVersion(mission({ draft: 'x' }), 'v1', NOW, long);
    expect(saved.versions[0].note).toBe('a'.repeat(MAX_NOTE_LENGTH));
    // An imported note over the limit shows clamped.
    const imported = version('v1', '2026-01-01T09:00:00.000Z', 'x', long);
    expect(versionRows([imported])[0].note).toHaveLength(MAX_NOTE_LENGTH);
  });
});

describe('review rhythm (issue #62)', () => {
  it('adds calendar months with the day clamped to the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2028-02-29', 12)).toBe('2029-02-28');
  });

  const versions = [version('v1', '2026-01-31', 'x')];

  it('counts from the latest version until the first review, then from the review', () => {
    expect(nextReviewDate({ interval: 'monthly' }, versions, '2026-02-01')).toBe('2026-02-28');
    expect(nextReviewDate({ interval: 'quarterly' }, versions, '2026-02-01')).toBe('2026-04-30');
    expect(nextReviewDate({ interval: 'yearly' }, versions, '2026-02-01')).toBe('2027-01-31');
    expect(
      nextReviewDate({ interval: 'monthly', lastReviewedAt: '2026-03-31' }, versions, '2026-04-01'),
    ).toBe('2026-04-30');
    expect(nextReviewDate({ interval: 'off' }, versions, '2026-02-01')).toBeNull();
    expect(nextReviewDate({ interval: 'monthly' }, [], '2026-02-01')).toBe('2026-03-01');
  });

  it('is due from the next date on, never when off', () => {
    const review = { interval: 'monthly' as const };
    expect(isReviewDue(review, versions, '2026-02-27')).toBe(false);
    expect(isReviewDue(review, versions, '2026-02-28')).toBe(true);
    expect(isReviewDue(review, versions, '2026-06-01')).toBe(true);
    expect(isReviewDue({ interval: 'off' }, versions, '2030-01-01')).toBe(false);
  });

  it('stores the interval with its next date; "Off" first is a no-op', () => {
    const current = mission({ versions });
    expect(reviewOf(current)).toEqual({ interval: 'off' });
    expect(withReviewInterval(current, 'off', NOW)).toBe(current);
    const monthly = withReviewInterval(current, 'monthly', NOW);
    expect(monthly.review).toEqual({ interval: 'monthly', nextAt: '2026-02-28' });
    expect(withReviewInterval(monthly, 'monthly', NOW)).toBe(monthly);
    expect(withReviewInterval(monthly, 'off', NOW).review).toEqual({ interval: 'off' });
  });

  it('"Reviewed today" moves the next date, and twice in a day changes nothing', () => {
    const monthly = withReviewInterval(mission({ versions }), 'monthly', NOW);
    const reviewed = withReviewed(monthly, '2026-03-05', NOW);
    expect(reviewed.review).toEqual({
      interval: 'monthly',
      lastReviewedAt: '2026-03-05',
      nextAt: '2026-04-05',
    });
    expect(withReviewed(reviewed, '2026-03-05', NOW)).toBe(reviewed);
  });

  it('moves a never-reviewed next date with a new version', () => {
    const monthly = withReviewInterval(mission({ versions, draft: 'y' }), 'monthly', NOW);
    const saved = withVersion(monthly, 'v2', new Date('2026-02-10T12:00:00.000Z'));
    expect(saved.review).toEqual({ interval: 'monthly', nextAt: '2026-03-10' });
  });

  it('shows "Review due" on the hub while due, over the done date, else the version count', () => {
    const monthly = withReviewInterval(mission({ versions }), 'monthly', NOW);
    expect(hubStatus(monthly, '2026-02-28')).toEqual({
      key: 'habits.exercises.h2-mission.reviewDue',
      count: 1,
      overridesDone: true,
    });
    expect(hubStatus(monthly, '2026-02-27')).toEqual({
      key: 'habits.exercises.h2-mission.versionCount',
      count: 1,
    });
  });
});
