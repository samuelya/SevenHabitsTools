import { TeachEntry } from './teach.model';
import {
  isDraftWorthSaving,
  KEY_IDEA_MAX_LENGTH,
  checklistLabelsFrom,
  checklistLoaded,
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
} from './teach.logic';

const NOW = new Date('2026-01-10T00:00:00.000Z');

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
    const labels = labelsFrom(['paradigms', 'h1'], [''], ['planned', 'shared'], [''], undefined);
    expect(labels.chapter.paradigms).toBe('');
    expect(labels.chapter.h1).toBe('');
    expect(labels.overdue).toBe('');
  });

  it('maps each chapter and status to its label', () => {
    const labels = labelsFrom(
      ['paradigms', 'h1'],
      ['Paradigms', 'Habit 1'],
      ['planned', 'shared'],
      ['Planned', 'Shared'],
      'Overdue',
    );
    expect(labels.chapter.h1).toBe('Habit 1');
    expect(labels.status.shared).toBe('Shared');
    expect(labels.overdue).toBe('Overdue');
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
  const labels = labelsFrom(
    ['h1'],
    ['Habit 1'],
    ['planned', 'shared', 'skipped'],
    ['Planned', 'Shared', 'Skipped'],
    'Overdue',
  );

  it('shows just the chapter title, not done, for a chapter with no entry — and not deletable (issue #203)', () => {
    expect(toListItem('h1', undefined, labels, NOW)).toEqual({
      id: 'h1',
      title: 'Habit 1',
      done: false,
      deletable: false,
    });
  });

  it('shows the status as the subtitle, done once shared, and deletable once there is an entry', () => {
    const item = toListItem('h1', entry({ status: 'shared' }), labels, NOW);
    expect(item.subtitle).toBe('Shared');
    expect(item.warning).toBe(false);
    expect(item.done).toBe(true);
    expect(item.deletable).toBe(true);
  });

  it('appends the overdue label once planned and past its date', () => {
    const item = toListItem(
      'h1',
      entry({ status: 'planned', plannedAt: '2026-01-01' }),
      labels,
      NOW,
    );
    expect(item.subtitle).toBe('Planned · Overdue');
    expect(item.warning).toBe(true);
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
  it('is false without a non-blank key idea, whatever else was edited', () => {
    expect(isDraftWorthSaving({})).toBe(false);
    expect(isDraftWorthSaving({ keyIdea: '   ' })).toBe(false);
  });

  it('is true once the key idea has a non-blank character', () => {
    expect(isDraftWorthSaving({ keyIdea: 'Choose your response' })).toBe(true);
  });
});
