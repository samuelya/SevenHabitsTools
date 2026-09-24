import { SCRIPT_EFFECTS, SCRIPT_SOURCES, Script } from './transition.model';
import {
  isDraftWorthSaving,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editScript,
  isComplete,
  isItemComplete,
  labelsFrom,
  removeScript,
  requiresNewScript,
  restoreScript,
  summarize,
  toListItem,
  isStarted,
} from './transition.logic';
import { hubStatus } from './transition.logic';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function script(overrides: Partial<Script> = {}): Script {
  return {
    id: 's1',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    text: 'Conflict means someone has to lose',
    source: 'family',
    effect: 'harms',
    decision: 'keep',
    ...overrides,
  };
}

describe('isItemComplete', () => {
  it('is false when the text is empty or blank', () => {
    expect(isItemComplete(script({ text: '' }))).toBe(false);
    expect(isItemComplete(script({ text: '   ' }))).toBe(false);
  });

  it('is true for a kept script once it has text, regardless of newScript/situation', () => {
    expect(isItemComplete(script({ decision: 'keep' }))).toBe(true);
  });

  it.each(['rewrite', 'stop'] as const)(
    'requires both newScript and situation when decision is %s',
    (decision) => {
      expect(isItemComplete(script({ decision }))).toBe(false);
      expect(isItemComplete(script({ decision, newScript: 'New script' }))).toBe(false);
      expect(isItemComplete(script({ decision, situation: 'This week' }))).toBe(false);
      expect(
        isItemComplete(script({ decision, newScript: 'New script', situation: 'This week' })),
      ).toBe(true);
    },
  );

  it('treats blank newScript/situation as missing', () => {
    expect(isItemComplete(script({ decision: 'stop', newScript: '  ', situation: '  ' }))).toBe(
      false,
    );
  });
});

describe('isComplete', () => {
  it('is false with no scripts', () => {
    expect(isComplete([])).toBe(false);
  });

  it('is false when no live script is complete', () => {
    const incomplete = script({ decision: 'stop' });
    expect(isComplete([incomplete])).toBe(false);
  });

  it('is true once at least one live script is complete', () => {
    const complete = script({ decision: 'keep' });
    const incomplete = script({ id: 's2', decision: 'stop' });
    expect(isComplete([incomplete, complete])).toBe(true);
  });

  it('ignores a tombstoned complete script', () => {
    const deleted = script({ decision: 'keep', deletedAt: NOW.toISOString() });
    expect(isComplete([deleted])).toBe(false);
  });
});

const LABELS = checklistLabelsFrom(['Pattern', 'Decide', 'Instead', 'Situation']);

describe('doneChecklist', () => {
  const met = (scripts: Script[]) => doneChecklist(scripts, LABELS).map((item) => item.met);

  it('lists the four items, all unmet, with no scripts', () => {
    expect(doneChecklist([], LABELS)).toEqual([
      { label: 'Pattern', met: false },
      { label: 'Decide', met: false },
      { label: 'Instead', met: false },
      { label: 'Situation', met: false },
    ]);
  });

  it('leaves everything unmet for a script with no pattern text yet', () => {
    expect(met([script({ text: '  ' })])).toEqual([false, false, false, false]);
  });

  it('meets every item for a named Keep script', () => {
    expect(met([script({ decision: 'keep' })])).toEqual([true, true, true, true]);
  });

  it('asks for the new script and the situation for Rewrite/Stop', () => {
    expect(met([script({ decision: 'stop' })])).toEqual([true, true, false, false]);
    expect(met([script({ decision: 'rewrite', newScript: 'Talk it through' })])).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('describes the live script closest to complete, ignoring tombstones', () => {
    const scripts = [
      script({ id: 's1', decision: 'stop' }),
      script({ id: 's2', decision: 'stop', newScript: 'Pause first' }),
      script({ id: 's3', decision: 'keep', deletedAt: NOW.toISOString() }),
    ];
    expect(met(scripts)).toEqual([true, true, true, false]);
  });

  it('is all met exactly when isComplete is true', () => {
    const cases: Script[][] = [
      [],
      [script({ decision: 'stop' })],
      [script({ decision: 'keep' })],
      [script({ decision: 'rewrite', newScript: 'x', situation: 'y' })],
      [script({ decision: 'keep', deletedAt: NOW.toISOString() })],
    ];
    for (const scripts of cases) {
      expect(doneChecklist(scripts, LABELS).every((item) => item.met)).toBe(isComplete(scripts));
    }
  });
});

describe('checklistLoaded', () => {
  it("is false for translateSignal's before-load [''] and true once labels arrive", () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(LABELS)).toBe(true);
  });
});

describe('summarize', () => {
  it('counts only live scripts, by decision', () => {
    const scripts: Script[] = [
      script({ id: 's1', decision: 'stop' }),
      script({ id: 's2', decision: 'rewrite' }),
      script({ id: 's3', decision: 'keep' }),
      script({ id: 's4', decision: 'stop', deletedAt: NOW.toISOString() }),
    ];

    expect(summarize(scripts)).toEqual({ stopped: 1, rewritten: 1, total: 3 });
  });

  it('is all zero with no scripts', () => {
    expect(summarize([])).toEqual({ stopped: 0, rewritten: 0, total: 0 });
  });
});

describe('labelsFrom', () => {
  it('falls back to an empty string for every label past index 0 before the scope has loaded', () => {
    // `translateSignal` with an array key starts at `['']` (one placeholder, not one per key)
    // until the scope's HTTP request resolves, so every index past 0 reads as `undefined`.
    const labels = labelsFrom(SCRIPT_SOURCES, [''], SCRIPT_EFFECTS, ['']);

    expect(labels).toEqual({
      source: { family: '', culture: '', work: '', other: '' },
      effect: { helps: '', harms: '', mixed: '' },
    });
  });

  it('maps each translated label to its enum value once the scope has loaded', () => {
    const labels = labelsFrom(
      SCRIPT_SOURCES,
      ['Family', 'Culture', 'Work', 'Other'],
      SCRIPT_EFFECTS,
      ['Helps', 'Harms', 'Mixed'],
    );

    expect(labels).toEqual({
      source: { family: 'Family', culture: 'Culture', work: 'Work', other: 'Other' },
      effect: { helps: 'Helps', harms: 'Harms', mixed: 'Mixed' },
    });
  });
});

describe('toListItem', () => {
  const labels = {
    source: { family: 'Family', culture: 'Culture', work: 'Work', other: 'Other' },
    effect: { helps: 'Helps', harms: 'Harms', mixed: 'Mixed' },
  };

  it('maps text, a translated source/effect subtitle and completeness', () => {
    const item = toListItem(script({ decision: 'stop' }), labels);
    expect(item).toEqual({
      id: 's1',
      title: 'Conflict means someone has to lose',
      subtitle: 'Family · Harms',
      done: false,
    });
  });

  it('titles a script with no text by its new script, then its situation, else blank (issue #217)', () => {
    const title = (overrides: Partial<Script>) => toListItem(script(overrides), labels).title;
    expect(title({ text: ' ', newScript: 'Both can win', situation: 'At work' })).toBe(
      'Both can win',
    );
    expect(title({ text: '', newScript: '  ', situation: 'At work' })).toBe('At work');
    expect(title({ text: '', newScript: undefined, situation: ' ' })).toBe('');
  });
});

describe('isDraftWorthSaving (issue #217)', () => {
  it('is false while every free-text field is blank or whitespace-only', () => {
    expect(isDraftWorthSaving({ text: '' })).toBe(false);
    expect(isDraftWorthSaving({ text: '  \n ', newScript: ' ', situation: '' })).toBe(false);
  });

  it('is true once any free-text field has a non-blank character', () => {
    expect(isDraftWorthSaving({ text: 'a' })).toBe(true);
    expect(isDraftWorthSaving({ text: '', newScript: 'b' })).toBe(true);
    expect(isDraftWorthSaving({ text: '', situation: 'c' })).toBe(true);
  });
});

describe('editScript', () => {
  it('merges fields into the matching live script only', () => {
    const other = script({ id: 's2', text: 'other' });
    const target = script({ id: 's1', text: 'old' });

    const result = editScript([target, other], 's1', { text: 'new' });

    expect(result.find((s) => s.id === 's1')?.text).toBe('new');
    expect(result.find((s) => s.id === 's2')?.text).toBe('other');
  });

  it('leaves a tombstoned script unchanged', () => {
    const deleted = script({ id: 's1', text: 'old', deletedAt: NOW.toISOString() });

    const result = editScript([deleted], 's1', { text: 'new' });

    expect(result[0].text).toBe('old');
  });

  it('is a no-op copy when the id is not found', () => {
    const target = script({ id: 's1' });
    expect(editScript([target], 'missing', { text: 'new' })).toEqual([target]);
  });
});

describe('removeScript', () => {
  it('tombstones the matching script, never removing it', () => {
    const target = script({ id: 's1' });
    const result = removeScript([target], 's1', NOW);

    expect(result).toHaveLength(1);
    expect(result[0].deletedAt).toBe(NOW.toISOString());
  });

  it('leaves other scripts alone', () => {
    const target = script({ id: 's1' });
    const other = script({ id: 's2' });
    const result = removeScript([target, other], 's1', NOW);

    expect(result.find((s) => s.id === 's2')?.deletedAt).toBeUndefined();
  });
});

describe('restoreScript', () => {
  const RESTORE_AT = new Date('2026-01-02T00:00:00.000Z');

  it('clears the tombstone and bumps updatedAt', () => {
    const deleted = script({ id: 's1', deletedAt: NOW.toISOString() });

    const result = restoreScript([deleted], 's1', RESTORE_AT);

    expect(result[0].deletedAt).toBeUndefined();
    expect(result[0].updatedAt).toBe(RESTORE_AT.toISOString());
  });

  it('leaves other scripts alone', () => {
    const deleted = script({ id: 's1', deletedAt: NOW.toISOString() });
    const other = script({ id: 's2' });

    const result = restoreScript([deleted, other], 's1', RESTORE_AT);

    expect(result.find((s) => s.id === 's2')).toEqual(other);
  });

  it('is a no-op copy when the id is not found or was never deleted', () => {
    const live = script({ id: 's1' });
    expect(restoreScript([live], 's1', RESTORE_AT)).toEqual([live]);
    expect(restoreScript([live], 'missing', RESTORE_AT)).toEqual([live]);
  });
});

describe('requiresNewScript', () => {
  it('is false only for keep', () => {
    expect(requiresNewScript('keep')).toBe(false);
    expect(requiresNewScript('rewrite')).toBe(true);
    expect(requiresNewScript('stop')).toBe(true);
  });
});

describe('isStarted (issue #216)', () => {
  it('is false with no scripts at all', () => {
    expect(isStarted([])).toBe(false);
  });

  it('is false when every script is tombstoned', () => {
    expect(isStarted([script({ deletedAt: NOW.toISOString() })])).toBe(false);
  });

  it('is true once any live script exists', () => {
    expect(
      isStarted([script({ id: 'x1', deletedAt: NOW.toISOString() }), script({ id: 'x2' })]),
    ).toBe(true);
  });
});

describe('hubStatus (#219)', () => {
  it('is null with no live script', () => {
    expect(hubStatus([])).toBeNull();
    expect(hubStatus([script({ deletedAt: NOW.toISOString() })])).toBeNull();
  });

  it('counts live scripts as patterns', () => {
    expect(
      hubStatus([script({ id: 'a' }), script({ id: 'b' }), script({ id: 'c', deletedAt: 'x' })]),
    ).toEqual({ key: 'habits.exercises.paradigms-transition.patternCount', count: 2 });
  });
});
