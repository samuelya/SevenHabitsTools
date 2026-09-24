import { TeachEntry } from './teach.model';
import {
  isDraftWorthSaving,
  KEY_IDEA_MAX_LENGTH,
  CHAPTER_STATUS_KINDS,
  DATE_SLOT,
  chapterStatus,
  checklistLabelsFrom,
  checklistLoaded,
  firstLine,
  defaultPlannedAt,
  doneChecklist,
  draftFor,
  entryForChapter,
  isComplete,
  isKeyIdeaValid,
  isOverdue,
  isValidPlannedAt,
  labelsFrom,
  removeEntry,
  restoreEntry,
  sharedCount,
  summarize,
  toListItem,
  upsertEntry,
  isStarted,
  addSampleEntry,
  guideForEntries,
  teachSampleFromExample,
} from './teach.logic';
import type { ExerciseGuideContent } from '../../shared/exercise-kit/exercise-guide/exercise-guide';
import { hubStatus } from './teach.logic';

const NOW = new Date('2026-01-10T00:00:00.000Z');

/** In `CHAPTER_STATUS_KINDS` order. */
const STATUS_LABELS = CHAPTER_STATUS_KINDS.map(
  (kind) =>
    ({
      notPlanned: 'Not planned',
      planned: `Planned by ${DATE_SLOT}`,
      overdue: 'Overdue',
      shared: 'Shared',
      skipped: 'Skipped',
    })[kind],
);

function entry(overrides: Partial<TeachEntry> = {}): TeachEntry {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    chapter: 'h1',
    keyIdea: 'Choose your response',
    plannedAt: '2026-01-03',
    status: 'planned',
    ...overrides,
  };
}

describe('defaultPlannedAt', () => {
  it('is today plus two days', () => {
    expect(defaultPlannedAt(NOW)).toBe('2026-01-12');
  });
});

describe('entryForChapter', () => {
  it('finds the live entry for a chapter', () => {
    const entries = [entry({ chapter: 'h1' }), entry({ id: 'e2', chapter: 'h2' })];
    expect(entryForChapter(entries, 'h2')?.id).toBe('e2');
  });

  it('ignores a tombstoned entry', () => {
    const entries = [entry({ deletedAt: '2026-01-05T00:00:00.000Z' })];
    expect(entryForChapter(entries, 'h1')).toBeUndefined();
  });

  it('returns undefined when the chapter has no entry', () => {
    expect(entryForChapter([], 'h1')).toBeUndefined();
  });
});

describe('upsertEntry', () => {
  it('creates a new entry for a chapter with none yet, with the default planned date', () => {
    const result = upsertEntry([], 'h1', { keyIdea: 'Choose your response' }, NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      chapter: 'h1',
      keyIdea: 'Choose your response',
      plannedAt: '2026-01-12',
      status: 'planned',
    });
  });

  it("edits a chapter's existing live entry in place, leaving other chapters alone", () => {
    const entries = [entry({ chapter: 'h1' }), entry({ id: 'e2', chapter: 'h2' })];
    const result = upsertEntry(entries, 'h1', { keyIdea: 'Updated' }, NOW);
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.chapter === 'h1')?.keyIdea).toBe('Updated');
    expect(result.find((e) => e.chapter === 'h2')?.keyIdea).toBe('Choose your response');
  });

  it('stamps sharedAt from now the moment status first becomes shared', () => {
    const entries = [entry({ status: 'planned' })];
    const result = upsertEntry(entries, 'h1', { status: 'shared' }, NOW);
    expect(result[0].sharedAt).toBe('2026-01-10');
  });

  it('does not restamp sharedAt on a later edit that leaves status shared', () => {
    const entries = [entry({ status: 'shared', sharedAt: '2026-01-04' })];
    const result = upsertEntry(entries, 'h1', { learned: 'A lot' }, NOW);
    expect(result[0].sharedAt).toBe('2026-01-04');
  });

  it('never creates a second live entry for the same chapter', () => {
    const entries = [entry({ chapter: 'h1' })];
    const result = upsertEntry(entries, 'h1', { keyIdea: 'Again' }, NOW);
    expect(result.filter((e) => e.chapter === 'h1')).toHaveLength(1);
  });

  it('clears sharedAt once status moves away from shared', () => {
    const entries = [entry({ status: 'shared', sharedAt: '2026-01-04' })];
    const result = upsertEntry(entries, 'h1', { status: 'planned' }, NOW);
    expect(result[0].sharedAt).toBeUndefined();
  });

  it('stays clear of sharedAt for an entry that has never been shared', () => {
    const entries = [entry({ status: 'planned' })];
    const result = upsertEntry(entries, 'h1', { status: 'skipped' }, NOW);
    expect(result[0].sharedAt).toBeUndefined();
  });
});

describe('isOverdue', () => {
  it('is overdue once planned and past its planned date', () => {
    expect(isOverdue({ status: 'planned', plannedAt: '2026-01-09' }, NOW)).toBe(true);
  });

  it('is not overdue on or before the planned date', () => {
    expect(isOverdue({ status: 'planned', plannedAt: '2026-01-10' }, NOW)).toBe(false);
  });

  it('is never overdue once shared or skipped', () => {
    expect(isOverdue({ status: 'shared', plannedAt: '2026-01-01' }, NOW)).toBe(false);
    expect(isOverdue({ status: 'skipped', plannedAt: '2026-01-01' }, NOW)).toBe(false);
  });
});

describe('sharedCount and isComplete', () => {
  it('counts only live, shared entries', () => {
    const entries = [
      entry({ id: 'e1', status: 'shared' }),
      entry({ id: 'e2', chapter: 'h2', status: 'planned' }),
      entry({ id: 'e3', chapter: 'h3', status: 'shared', deletedAt: '2026-01-05T00:00:00.000Z' }),
    ];
    expect(sharedCount(entries)).toBe(1);
    expect(isComplete(entries)).toBe(true);
  });

  it('is false with no shared entries', () => {
    expect(isComplete([entry({ status: 'planned' })])).toBe(false);
  });

  it('is true for a shared entry with a blank plannedAt (#52 rule unchanged)', () => {
    expect(isComplete([entry({ status: 'shared', plannedAt: '' })])).toBe(true);
  });
});

const LABELS = checklistLabelsFrom(['Plan', 'Share']);

describe('doneChecklist', () => {
  const met = (entries: TeachEntry[]) => doneChecklist(entries, LABELS).map((item) => item.met);

  it('lists both items, unmet, with no entries', () => {
    expect(doneChecklist([], LABELS)).toEqual([
      { label: 'Plan', met: false },
      { label: 'Share', met: false },
    ]);
  });

  it('meets "plan" once a chapter has a dated entry, "share" once one is shared', () => {
    expect(met([entry({ status: 'planned' })])).toEqual([true, false]);
    expect(met([entry({ status: 'planned' }), entry({ id: 'e2', status: 'shared' })])).toEqual([
      true,
      true,
    ]);
  });

  it('ignores a tombstoned shared entry', () => {
    expect(met([entry({ status: 'shared', deletedAt: '2026-01-05T00:00:00.000Z' })])).toEqual([
      false,
      false,
    ]);
  });

  it('is all met exactly when isComplete is true', () => {
    const cases: TeachEntry[][] = [
      [],
      [entry({ status: 'planned' })],
      [entry({ status: 'skipped' })],
      [entry({ status: 'shared' })],
      [entry({ status: 'shared', plannedAt: '' })],
      [entry({ status: 'planned', plannedAt: '' })],
      [entry({ status: 'shared', deletedAt: '2026-01-05T00:00:00.000Z' })],
    ];
    for (const entries of cases) {
      expect(doneChecklist(entries, LABELS).every((item) => item.met)).toBe(isComplete(entries));
    }
  });

  it("checklistLoaded is false for translateSignal's before-load [''] only", () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(LABELS)).toBe(true);
  });
});

describe('summarize', () => {
  it('counts shared and overdue against the fixed ten-chapter total', () => {
    const entries = [
      entry({ id: 'e1', chapter: 'h1', status: 'shared' }),
      entry({ id: 'e2', chapter: 'h2', status: 'planned', plannedAt: '2026-01-01' }),
    ];
    expect(summarize(entries, NOW)).toEqual({ shared: 1, overdue: 1, total: 10 });
  });
});

describe('labelsFrom', () => {
  it("falls back to an empty string for an index past a cold-load [''] array", () => {
    const labels = labelsFrom(['paradigms', 'h1'], [''], ['']);
    expect(labels.chapter.paradigms).toBe('');
    expect(labels.chapter.h1).toBe('');
    expect(labels.status.overdue).toBe('');
  });

  it('maps each chapter and chapter status to its label, statuses in CHAPTER_STATUS_KINDS order', () => {
    const labels = labelsFrom(['paradigms', 'h1'], ['Paradigms', 'Habit 1'], STATUS_LABELS);
    expect(labels.chapter.h1).toBe('Habit 1');
    expect(labels.status.notPlanned).toBe('Not planned');
    expect(labels.status.planned).toBe(`Planned by ${DATE_SLOT}`);
    expect(labels.status.shared).toBe('Shared');
  });
});

describe('chapterStatus (issue #224)', () => {
  // NOW is 2026-01-10 (local).
  it('is "not planned" for a chapter with no entry', () => {
    expect(chapterStatus(undefined, NOW)).toEqual({ kind: 'notPlanned' });
  });

  it('is "planned by" its date while that date is today or later', () => {
    expect(chapterStatus(entry({ plannedAt: '2026-01-10' }), NOW)).toEqual({
      kind: 'planned',
      plannedAt: '2026-01-10',
    });
    expect(chapterStatus(entry({ plannedAt: '2026-01-22' }), NOW)).toEqual({
      kind: 'planned',
      plannedAt: '2026-01-22',
    });
  });

  it('is "overdue" once the planned date has passed and it is not shared', () => {
    expect(chapterStatus(entry({ plannedAt: '2026-01-09' }), NOW)).toEqual({
      kind: 'overdue',
      plannedAt: '2026-01-09',
    });
  });

  it('is "shared" whatever the date, past or future', () => {
    expect(chapterStatus(entry({ status: 'shared', plannedAt: '2026-01-01' }), NOW)).toEqual({
      kind: 'shared',
    });
    expect(chapterStatus(entry({ status: 'shared', plannedAt: '2026-02-01' }), NOW)).toEqual({
      kind: 'shared',
    });
  });

  it('is "skipped" whatever the date', () => {
    expect(chapterStatus(entry({ status: 'skipped', plannedAt: '2026-01-01' }), NOW)).toEqual({
      kind: 'skipped',
    });
  });

  it('is "not planned" for a planned entry without a valid date (never a permanent "Overdue")', () => {
    expect(chapterStatus(entry({ plannedAt: '' }), NOW)).toEqual({ kind: 'notPlanned' });
    expect(chapterStatus(entry({ plannedAt: '2026-13-01' }), NOW)).toEqual({ kind: 'notPlanned' });
    expect(chapterStatus(entry({ plannedAt: '2026-02-30' }), NOW)).toEqual({ kind: 'notPlanned' });
  });
});

describe('firstLine', () => {
  it('returns the first non-blank line, trimmed', () => {
    expect(firstLine('\n  First idea  \nSecond')).toBe('First idea');
    expect(firstLine('One\r\nTwo')).toBe('One');
  });

  it("returns '' for blank or missing text", () => {
    expect(firstLine('  \n ')).toBe('');
    expect(firstLine(undefined)).toBe('');
  });
});

describe('draftFor', () => {
  it('returns fresh defaults for a chapter with no entry yet', () => {
    expect(draftFor('h2', undefined, NOW)).toEqual({
      chapter: 'h2',
      keyIdea: '',
      plannedAt: '2026-01-12',
      status: 'planned',
    });
  });

  it("returns the chapter's live entry fields, without id or timestamps", () => {
    const draft = draftFor('h1', entry({ keyIdea: 'Mine' }), NOW);
    expect(draft).toEqual({
      chapter: 'h1',
      keyIdea: 'Mine',
      person: undefined,
      plannedAt: '2026-01-03',
      sharedAt: undefined,
      status: 'planned',
      learned: undefined,
    });
  });
});

describe('toListItem', () => {
  const labels = labelsFrom(['h1'], ['Habit 1'], STATUS_LABELS);
  const formatDate = (isoDate: string) => `<${isoDate}>`;

  it('shows the chapter title and a "Not planned" chip for a chapter with no entry — not deletable (issue #203)', () => {
    expect(toListItem('h1', undefined, labels, NOW, formatDate)).toEqual({
      id: 'h1',
      title: 'Habit 1',
      chips: [{ label: 'Not planned', warning: false }],
      done: false,
      warning: false,
      deletable: false,
    });
  });

  it('shows the key idea\'s first line as the subtitle and a dated "Planned by" chip', () => {
    const item = toListItem(
      'h1',
      entry({ keyIdea: 'Choose your response\nnot just react', plannedAt: '2026-01-22' }),
      labels,
      NOW,
      formatDate,
    );
    expect(item.subtitle).toBe('Choose your response');
    expect(item.chips).toEqual([{ label: 'Planned by <2026-01-22>', warning: false }]);
    expect(item.warning).toBe(false);
    expect(item.deletable).toBe(true);
  });

  it('has no subtitle while the key idea is blank', () => {
    const item = toListItem('h1', entry({ keyIdea: '  ' }), labels, NOW, formatDate);
    expect(item.subtitle).toBeUndefined();
  });

  it('shows a "Shared" chip and is done once shared', () => {
    const item = toListItem('h1', entry({ status: 'shared' }), labels, NOW, formatDate);
    expect(item.chips).toEqual([{ label: 'Shared', warning: false }]);
    expect(item.done).toBe(true);
    expect(item.warning).toBe(false);
  });

  it('shows an "Overdue" warning chip — text as well as colour — once planned and past its date', () => {
    const item = toListItem(
      'h1',
      entry({ status: 'planned', plannedAt: '2026-01-01' }),
      labels,
      NOW,
      formatDate,
    );
    expect(item.chips).toEqual([{ label: 'Overdue', warning: true }]);
    expect(item.warning).toBe(true);
    expect(item.done).toBe(false);
  });
});

describe('removeEntry/restoreEntry (issue #203)', () => {
  const LATER = new Date('2026-01-11T00:00:00.000Z');

  it('tombstones the matching entry, leaving others alone', () => {
    const target = entry({ id: 'e1', chapter: 'h1' });
    const other = entry({ id: 'e2', chapter: 'h2' });
    const result = removeEntry([target, other], 'e1', LATER);

    expect(result.find((e) => e.id === 'e1')?.deletedAt).toBe(LATER.toISOString());
    expect(result.find((e) => e.id === 'e2')?.deletedAt).toBeUndefined();
  });

  it('restore clears the tombstone and bumps updatedAt', () => {
    const deleted = entry({ id: 'e1', deletedAt: LATER.toISOString() });
    const result = restoreEntry([deleted], 'e1', LATER);

    expect(result[0].deletedAt).toBeUndefined();
    expect(result[0].updatedAt).toBe(LATER.toISOString());
  });

  it('a chapter can be filled in again after its entry is deleted — upsertEntry creates a fresh one', () => {
    const deleted = entry({ id: 'e1', chapter: 'h1', deletedAt: LATER.toISOString() });
    const result = upsertEntry([deleted], 'h1', { keyIdea: 'New idea' }, LATER);

    expect(result).toHaveLength(2);
    const fresh = result.find((e) => e.id !== 'e1')!;
    expect(fresh.keyIdea).toBe('New idea');
    expect(fresh.deletedAt).toBeUndefined();
  });

  it('restore is a no-op when the chapter already has a different live entry (typed again, then Undo)', () => {
    const deleted = entry({ id: 'e1', chapter: 'h1', deletedAt: LATER.toISOString() });
    const fresh = entry({ id: 'e2', chapter: 'h1', keyIdea: 'New idea' });
    const result = restoreEntry([deleted, fresh], 'e1', LATER);

    expect(result).toEqual([deleted, fresh]);
  });
});

describe('isKeyIdeaValid', () => {
  it('rejects blank or whitespace-only text', () => {
    expect(isKeyIdeaValid('')).toBe(false);
    expect(isKeyIdeaValid('   ')).toBe(false);
  });

  it('accepts text up to the max length and rejects past it', () => {
    expect(isKeyIdeaValid('a'.repeat(KEY_IDEA_MAX_LENGTH))).toBe(true);
    expect(isKeyIdeaValid('a'.repeat(KEY_IDEA_MAX_LENGTH + 1))).toBe(false);
  });
});

describe('isValidPlannedAt', () => {
  it('accepts a full YYYY-MM-DD date', () => {
    expect(isValidPlannedAt('2026-01-12')).toBe(true);
  });

  it('rejects an empty value (a cleared date input)', () => {
    expect(isValidPlannedAt('')).toBe(false);
  });

  it('rejects a partial or malformed value', () => {
    expect(isValidPlannedAt('2026-01')).toBe(false);
    expect(isValidPlannedAt('not-a-date')).toBe(false);
  });

  it('rejects a pattern-valid but impossible date', () => {
    expect(isValidPlannedAt('2026-13-01')).toBe(false);
    expect(isValidPlannedAt('2026-02-30')).toBe(false);
  });
});

describe('isStarted (issue #216)', () => {
  it('is false with no entries at all', () => {
    expect(isStarted([])).toBe(false);
  });

  it('is false when every entry is tombstoned', () => {
    expect(isStarted([entry({ deletedAt: NOW.toISOString() })])).toBe(false);
  });

  it('is true once any live entry exists', () => {
    expect(
      isStarted([entry({ id: 'x1', deletedAt: NOW.toISOString() }), entry({ id: 'x2' })]),
    ).toBe(true);
  });
});

describe('isDraftWorthSaving (issue #217)', () => {
  it('is false while every free-text field is blank, whatever else was edited', () => {
    expect(isDraftWorthSaving({})).toBe(false);
    expect(isDraftWorthSaving({ keyIdea: '   ', person: '', learned: ' ' })).toBe(false);
  });

  it('is true once any free-text field has a non-blank character', () => {
    expect(isDraftWorthSaving({ keyIdea: 'Choose your response' })).toBe(true);
    expect(isDraftWorthSaving({ person: 'Sam' })).toBe(true);
    expect(isDraftWorthSaving({ learned: 'They asked why' })).toBe(true);
  });
});

describe('hubStatus (#219)', () => {
  it('is null until a chapter is shared', () => {
    expect(hubStatus([])).toBeNull();
    expect(hubStatus([entry()])).toBeNull();
  });

  it('counts shared chapters', () => {
    expect(hubStatus([entry({ status: 'shared' })])).toEqual({
      key: 'habits.exercises.paradigms-teach.sharedCount',
      count: 1,
    });
  });
});

describe('samples (issue #232)', () => {
  const sample = (overrides: Partial<TeachEntry> = {}) =>
    entry({ sample: true, status: 'shared', ...overrides });

  it('counts toward nothing while flagged: started, shared count, hub, summary, done gate', () => {
    const entries = [sample({ status: 'planned', plannedAt: '2026-01-01' })];

    expect(isStarted(entries)).toBe(false);
    expect(sharedCount([sample()])).toBe(0);
    expect(hubStatus([sample()])).toBeNull();
    expect(summarize(entries, NOW)).toEqual({ shared: 0, overdue: 0, total: 10 });
    expect(isComplete([sample()])).toBe(false);
  });

  it('shows an "Example" chip before the status chip and never the done check', () => {
    const labels = labelsFrom(['h1'], ['Habit 1'], STATUS_LABELS, 'Example');
    const item = toListItem('h1', sample(), labels, NOW, (date) => date);

    expect(item.chips?.map((chip) => chip.label)).toEqual(['Example', 'Shared']);
    expect(item.done).toBe(false);
    expect(item.deletable).toBe(true);
  });

  it('any edit clears the flag, whichever field changed', () => {
    const [edited] = upsertEntry([sample()], 'h1', { status: 'skipped' }, NOW);

    expect(edited.status).toBe('skipped');
    expect('sample' in edited).toBe(false);
    expect(isStarted([edited])).toBe(true);
  });

  it("addSampleEntry creates the chapter's entry flagged as a sample", () => {
    const [created] = addSampleEntry([], 'paradigms', { keyIdea: 'Idea', status: 'planned' }, NOW);

    expect(created).toMatchObject({
      chapter: 'paradigms',
      keyIdea: 'Idea',
      status: 'planned',
      plannedAt: '2026-01-12',
      sample: true,
    });
  });

  it('addSampleEntry never touches a chapter that already has a live entry', () => {
    const own = entry({ chapter: 'paradigms' });

    expect(addSampleEntry([own], 'paradigms', { keyIdea: 'Idea', status: 'planned' }, NOW)).toEqual(
      [own],
    );
  });
});

describe('teachSampleFromExample (issue #232)', () => {
  const valid = { chapter: 'paradigms', keyIdea: 'Idea', status: 'shared', person: 'Sam' };

  it('maps a valid example to its chapter and fields, keeping only non-blank optional text', () => {
    expect(teachSampleFromExample({ ...valid, learned: ' ' })).toEqual({
      chapter: 'paradigms',
      fields: { keyIdea: 'Idea', status: 'shared', person: 'Sam' },
    });
  });

  it.each([
    ['null', null],
    ['an unknown chapter', { ...valid, chapter: 'h9' }],
    ['a blank key idea', { ...valid, keyIdea: ' ' }],
    ['an unknown status', { ...valid, status: 'done' }],
  ])('rejects %s', (_label, value) => {
    expect(teachSampleFromExample(value)).toBeNull();
  });
});

describe('guideForEntries (issue #232)', () => {
  const guide: ExerciseGuideContent = {
    inShort: 'x',
    howTo: ['y'],
    afterwards: 'z',
    examples: [
      { kind: 'card', title: 'A', fields: [], sample: { chapter: 'paradigms' } },
      { title: 'B', fields: [] },
    ],
  };

  it('keeps "Try this example" while the chapter has no live entry', () => {
    expect(guideForEntries(guide, [entry({ chapter: 'paradigms', deletedAt: 'x' })])).toBe(guide);
    expect(guideForEntries(null, [])).toBeNull();
  });

  it("drops it once the example's chapter has a live entry", () => {
    const result = guideForEntries(guide, [entry({ chapter: 'paradigms' })]);

    expect(result?.examples[0]).toMatchObject({ title: 'A', sample: undefined });
    expect(result?.examples[1]).toBe(guide.examples[1]);
  });
});
