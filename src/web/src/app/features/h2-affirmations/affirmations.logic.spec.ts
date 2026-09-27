import {
  AffirmationLabels,
  DATE_TOKEN,
  ITEM_TOKEN,
  N_TOKEN,
  TOTAL_TOKEN,
  activeAffirmations,
  affirmationFromExample,
  allChecksTicked,
  archivedAffirmations,
  canPractise,
  checkCount,
  checklistLabelsFrom,
  checklistLoaded,
  clockParts,
  doneChecklist,
  editAffirmation,
  editFields,
  hubStatus,
  isComplete,
  isDraftWorthSaving,
  isItemComplete,
  isLoggable,
  isPracticeResult,
  isStarted,
  lastPractised,
  liveSampleOf,
  logPractice,
  practiceAnnouncement,
  practiceDays,
  practiceLength,
  practisedOn,
  remainingSeconds,
  removeAffirmation,
  restoreAffirmation,
  rowSubtitle,
  secondsSpent,
  streak,
  summarize,
  toListItem,
} from './affirmations.logic';
import { Affirmation, AffirmationChecks } from './affirmations.model';

const T0 = '2026-09-01T00:00:00.000Z';
const ALL: AffirmationChecks = {
  personal: true,
  positive: true,
  present: true,
  visual: true,
  emotional: true,
};

function affirmation(id: string, fields: Partial<Affirmation> = {}): Affirmation {
  return {
    id,
    createdAt: T0,
    updatedAt: T0,
    text: `I stay calm ${id}`,
    checks: ALL,
    practice: [],
    ...fields,
  };
}

const practised = (id: string, ...dates: string[]): Affirmation =>
  affirmation(id, { practice: dates.map((date) => ({ date, seconds: 60 })) });

const LABELS: AffirmationLabels = {
  example: 'Example',
  practise: 'Practise',
  practiseAriaTemplate: `Practise: ${ITEM_TOKEN}`,
  practisedToday: 'Practised today',
  checksTemplate: `${N_TOKEN} of ${TOTAL_TOKEN}`,
  lastPractisedTemplate: `Last practised ${DATE_TOKEN}`,
  formatNumber: (value) => String(value),
  formatDate: (date) => `[${date}]`,
};

describe('one affirmation', () => {
  it('counts ticked checks and is complete only with the text and all five', () => {
    expect(
      checkCount(affirmation('a', { checks: { ...ALL, visual: false, emotional: false } })),
    ).toBe(3);
    expect(isItemComplete(affirmation('a'))).toBe(true);
    expect(isItemComplete(affirmation('a', { checks: { ...ALL, present: false } }))).toBe(false);
    expect(isItemComplete(affirmation('a', { text: '   ' }))).toBe(false);
    expect(allChecksTicked(affirmation('a', { text: '' }))).toBe(true);
    expect(allChecksTicked(affirmation('a', { checks: { ...ALL, personal: false } }))).toBe(false);
  });

  it('can be practised only when live, complete and not archived', () => {
    expect(canPractise(affirmation('a'))).toBe(true);
    expect(canPractise(affirmation('a', { archived: true }))).toBe(false);
    expect(canPractise(affirmation('a', { deletedAt: T0 }))).toBe(false);
    expect(canPractise(affirmation('a', { checks: { ...ALL, emotional: false } }))).toBe(false);
  });

  it('reads the stored length only when it is an offered one', () => {
    expect(practiceLength(affirmation('a'))).toBe(60);
    expect(practiceLength(affirmation('a', { practiceSeconds: 120 }))).toBe(120);
    expect(practiceLength(affirmation('a', { practiceSeconds: 45 }))).toBe(60);
  });

  it('finds the latest practice date whatever the log order', () => {
    expect(lastPractised(affirmation('a'))).toBeNull();
    expect(lastPractised(practised('a', '2026-09-03', '2026-09-05', '2026-09-04'))).toBe(
      '2026-09-05',
    );
  });
});

describe('the practice result', () => {
  it('logs 5 seconds or more, never less', () => {
    expect(isLoggable(4)).toBe(false);
    expect(isLoggable(5)).toBe(true);
  });

  it('accepts only a well-formed, loggable dialog result', () => {
    expect(isPracticeResult({ seconds: 12, length: 30 })).toBe(true);
    expect(isPracticeResult({ seconds: 5, length: 60 })).toBe(true);
    expect(isPracticeResult({ seconds: 120, length: 120 })).toBe(true);
    for (const value of [
      undefined,
      null,
      '',
      true,
      {},
      { seconds: 4, length: 30 },
      { seconds: 0, length: 30 },
      { seconds: 31, length: 30 },
      { seconds: 12.5, length: 30 },
      { seconds: Number.NaN, length: 30 },
      { seconds: Number.POSITIVE_INFINITY, length: 30 },
      { seconds: '12', length: 30 },
      { seconds: 12, length: 45 },
      { seconds: 12 },
    ]) {
      expect(isPracticeResult(value)).toBe(false);
    }
  });
});

describe('the practice timer', () => {
  const start = Date.UTC(2026, 8, 10, 10, 0, 0);

  it('computes the remaining time from the clock, never below zero', () => {
    expect(remainingSeconds(start, start, 60)).toBe(60);
    expect(remainingSeconds(start, start + 999, 60)).toBe(60);
    expect(remainingSeconds(start, start + 18_000, 60)).toBe(42);
    expect(remainingSeconds(start, start + 60_000, 60)).toBe(0);
    // A device asleep for three minutes: the first reading after it wakes is zero, not 59.
    expect(remainingSeconds(start, start + 180_000, 60)).toBe(0);
    // A clock set backwards reads as no time elapsed.
    expect(remainingSeconds(start, start - 5_000, 30)).toBe(30);
  });

  it('logs the seconds actually spent, capped at the chosen length', () => {
    expect(secondsSpent(start, start + 12_400, 30)).toBe(12);
    expect(secondsSpent(start, start + 30_000, 30)).toBe(30);
    expect(secondsSpent(start, start + 600_000, 120)).toBe(120);
    expect(secondsSpent(start, start + 300, 60)).toBe(0);
  });

  it('announces only at halfway and at zero', () => {
    expect(practiceAnnouncement(60, 60)).toBeNull();
    expect(practiceAnnouncement(31, 60)).toBeNull();
    expect(practiceAnnouncement(30, 60)).toBe('halfway');
    expect(practiceAnnouncement(1, 60)).toBe('halfway');
    expect(practiceAnnouncement(0, 60)).toBe('finished');
    expect(practiceAnnouncement(15, 30)).toBe('halfway');
  });

  it('splits seconds into minutes and seconds', () => {
    expect(clockParts(42)).toEqual({ minutes: 0, seconds: 42 });
    expect(clockParts(120)).toEqual({ minutes: 2, seconds: 0 });
    expect(clockParts(61)).toEqual({ minutes: 1, seconds: 1 });
  });
});

describe('practice across the list', () => {
  it('lists distinct practice days, newest first, leaving out samples and deleted ones', () => {
    const list = [
      practised('a', '2026-09-03', '2026-09-01'),
      practised('b', '2026-09-03', '2026-09-02'),
      { ...practised('c', '2026-09-09'), sample: true },
      { ...practised('d', '2026-09-08'), deletedAt: T0 },
      { ...practised('e', '2026-09-04'), archived: true },
    ];
    expect(practiceDays(list)).toEqual(['2026-09-04', '2026-09-03', '2026-09-02', '2026-09-01']);
    expect(practisedOn(list, '2026-09-02')).toBe(true);
    expect(practisedOn(list, '2026-09-09')).toBe(false);
  });

  it('counts a streak ending today or yesterday, across a month end', () => {
    const list = [practised('a', '2026-08-30', '2026-08-31'), practised('b', '2026-09-01')];
    expect(streak(list, '2026-09-01')).toBe(3);
    // Nothing yet today: yesterday's run still stands.
    expect(streak(list, '2026-09-02')).toBe(3);
    // A whole day missed: broken.
    expect(streak(list, '2026-09-03')).toBe(0);
  });

  it('stops at a gap and counts across practices on different affirmations', () => {
    const list = [
      practised('a', '2026-09-10', '2026-09-08'),
      practised('b', '2026-09-09', '2026-09-06'),
    ];
    expect(streak(list, '2026-09-10')).toBe(3);
    expect(streak([], '2026-09-10')).toBe(0);
  });

  it('counts across a daylight-saving change (local dates, not 24-hour steps)', () => {
    // Local dates only: whatever the runner's time zone, three consecutive dates are three days.
    const list = [practised('a', '2026-03-28', '2026-03-29', '2026-03-30')];
    expect(streak(list, '2026-03-30')).toBe(3);
    const autumn = [practised('a', '2026-10-24', '2026-10-25', '2026-10-26')];
    expect(streak(autumn, '2026-10-26')).toBe(3);
  });

  it('summarises days and the streak only once a practice exists', () => {
    expect(summarize([affirmation('a')], '2026-09-10')).toBeNull();
    expect(summarize([practised('a', '2026-09-01', '2026-09-10')], '2026-09-10')).toEqual({
      days: 2,
      streak: 1,
    });
  });

  it('gives the hub "Practised today", else the practisable count, else null', () => {
    const today = '2026-09-10';
    expect(hubStatus([], today)).toBeNull();
    expect(hubStatus([affirmation('a', { checks: { ...ALL, visual: false } })], today)).toBeNull();
    expect(
      hubStatus([affirmation('a'), affirmation('b'), affirmation('c', { archived: true })], today),
    ).toEqual({ key: 'habits.exercises.h2-affirmations.affirmationCount', count: 2 });
    expect(hubStatus([practised('a', today)], today)).toEqual({
      key: 'habits.exercises.h2-affirmations.practisedToday',
      count: 1,
    });
    expect(hubStatus([{ ...affirmation('a'), sample: true }], today)).toBeNull();
  });

  it('is started by a counted affirmation with text, not by a sample', () => {
    expect(isStarted([])).toBe(false);
    expect(isStarted([{ ...affirmation('a'), sample: true }])).toBe(false);
    expect(isStarted([affirmation('a', { text: '' })])).toBe(false);
    expect(isStarted([affirmation('a')])).toBe(true);
  });
});

describe('the done gate', () => {
  const labels = checklistLabelsFrom(['Write', 'Tick', 'Practise']);
  const met = (list: readonly Affirmation[]) => doneChecklist(list, labels).map((item) => item.met);

  it('needs one counted affirmation that is complete and practised', () => {
    expect(met([])).toEqual([false, false, false]);
    expect(met([affirmation('a', { checks: { ...ALL, visual: false } })])).toEqual([
      true,
      false,
      false,
    ]);
    expect(met([affirmation('a')])).toEqual([true, true, false]);
    expect(isComplete([affirmation('a')])).toBe(false);
    expect(isComplete([practised('a', '2026-09-01')])).toBe(true);
    expect(isComplete([{ ...practised('a', '2026-09-01'), sample: true }])).toBe(false);
  });

  it('gates the checklist on loaded labels', () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(labels)).toBe(true);
  });
});

describe('rows', () => {
  const today = '2026-09-10';

  it('says "n of 5" until complete, then practised today or the last date', () => {
    const three = affirmation('a', { checks: { ...ALL, visual: false, emotional: false } });
    expect(rowSubtitle(three, today, LABELS)).toBe('3 of 5');
    expect(rowSubtitle(affirmation('a'), today, LABELS)).toBe('');
    expect(rowSubtitle(practised('a', today), today, LABELS)).toBe('Practised today');
    expect(rowSubtitle(practised('a', '2026-09-08'), today, LABELS)).toBe(
      'Last practised [2026-09-08]',
    );
  });

  it('formats both numbers of "n of 5" in the active numerals', () => {
    const arabic = new Intl.NumberFormat('ar-EG-u-nu-arab');
    const labels = {
      ...LABELS,
      checksTemplate: `${N_TOKEN} من ${TOTAL_TOKEN}`,
      formatNumber: (value: number) => arabic.format(value),
    };
    const two = affirmation('a', {
      checks: { personal: true, positive: true, present: false, visual: false, emotional: false },
    });
    expect(rowSubtitle(two, today, labels)).toBe('٢ من ٥');
  });

  it('puts a named Practise action only on a practisable row and marks samples', () => {
    const row = toListItem(affirmation('a', { text: '  I   breathe out ' }), today, LABELS);
    expect(row.title).toBe('I breathe out');
    expect(row.done).toBe(true);
    expect(row.action).toEqual({
      icon: 'self_improvement',
      label: 'Practise: I breathe out',
      hint: 'Practise',
    });
    expect(toListItem(affirmation('a', { archived: true }), today, LABELS).action).toBeUndefined();
    const sample = toListItem({ ...affirmation('a'), sample: true }, today, LABELS);
    expect(sample.chips).toEqual([{ label: 'Example' }]);
    expect(sample.done).toBe(false);
  });

  it("takes the text literally in the aria name and the subtitle ($' and $& included)", () => {
    const text = "I say $' and $& calmly";
    const row = toListItem(affirmation('a', { text }), today, LABELS);
    expect(row.action?.label).toBe(`Practise: ${text}`);
    const labels = { ...LABELS, formatDate: () => "$'$&" };
    expect(rowSubtitle(practised('a', '2026-09-08'), today, labels)).toBe("Last practised $'$&");
  });

  it('splits live affirmations into active and archived', () => {
    const list = [
      affirmation('a'),
      affirmation('b', { archived: true }),
      affirmation('c', { deletedAt: T0 }),
    ];
    expect(activeAffirmations(list).map((item) => item.id)).toEqual(['a']);
    expect(archivedAffirmations(list).map((item) => item.id)).toEqual(['b']);
  });
});

describe('edits', () => {
  it('creates a record on typed text in the affirmation or the scene, not on a tick', () => {
    expect(isDraftWorthSaving({ text: '', scene: undefined })).toBe(false);
    expect(isDraftWorthSaving({ text: '  ' })).toBe(false);
    expect(isDraftWorthSaving({ text: 'I' })).toBe(true);
    expect(isDraftWorthSaving({ text: '', scene: 'The hallway' })).toBe(true);
  });

  it('drops an emptied scene and an unset archive flag', () => {
    expect(editFields({ scene: ' ' })).toEqual({ scene: undefined });
    expect(editFields({ archived: false })).toEqual({ archived: undefined });
    expect(editFields({ archived: true })).toEqual({ archived: true });
  });

  it('merges an edit, makes a sample the user own, and returns the same array for a no-op', () => {
    const list = [{ ...affirmation('a', { scene: 'x' }), sample: true }];
    expect(editAffirmation(list, 'a', { text: list[0].text })).toBe(list);
    expect(editAffirmation(list, 'a', { checks: { ...ALL } })).toBe(list);
    expect(editAffirmation(list, 'missing', { text: 'y' })).toBe(list);
    const next = editAffirmation(list, 'a', editFields({ scene: '' }));
    expect(next[0].scene).toBeUndefined();
    expect('scene' in next[0]).toBe(false);
    expect(next[0].sample).toBeUndefined();
  });

  it('logs a practice with the length on a practisable affirmation only', () => {
    const entry = { date: '2026-09-10', seconds: 12 };
    const list = [affirmation('a'), affirmation('b', { archived: true })];
    const next = logPractice(list, 'a', entry, 30);
    expect(next[0].practice).toEqual([entry]);
    expect(next[0].practiceSeconds).toBe(30);
    expect(logPractice(list, 'b', entry, 30)).toBe(list);
    expect(logPractice(list, 'missing', entry, 30)).toBe(list);
    const sample = [{ ...affirmation('s'), sample: true }];
    expect(logPractice(sample, 's', entry, 60)[0].sample).toBeUndefined();
  });

  it('refuses an entry under 5 seconds, over the length, fractional or on a bad date', () => {
    const list = [affirmation('a')];
    expect(logPractice(list, 'a', { date: '2026-09-10', seconds: 4 }, 30)).toBe(list);
    expect(logPractice(list, 'a', { date: '2026-09-10', seconds: 31 }, 30)).toBe(list);
    expect(logPractice(list, 'a', { date: '2026-09-10', seconds: 6.5 }, 30)).toBe(list);
    expect(logPractice(list, 'a', { date: '2026-02-30', seconds: 10 }, 30)).toBe(list);
    expect(logPractice(list, 'a', { date: '', seconds: 10 }, 30)).toBe(list);
    expect(logPractice(list, 'a', { date: '2026-09-10', seconds: 5 }, 30)[0].practice).toHaveLength(
      1,
    );
  });

  it('tombstones and restores', () => {
    const now = new Date(2026, 8, 10);
    const list = [affirmation('a')];
    const removed = removeAffirmation(list, 'a', now);
    expect(removed[0].deletedAt).toBeDefined();
    expect(removeAffirmation(removed, 'a', now)).toBe(removed);
    const restored = restoreAffirmation(removed, 'a', now);
    expect('deletedAt' in restored[0]).toBe(false);
    expect(restoreAffirmation(list, 'a', now)).toBe(list);
  });
});

describe('samples', () => {
  it('reads a guide example as fields with no practice log', () => {
    expect(
      affirmationFromExample({
        text: 'I let her finish.',
        checks: { ...ALL, emotional: false },
        scene: 'Room',
      }),
    ).toEqual({
      text: 'I let her finish.',
      checks: { ...ALL, emotional: false },
      scene: 'Room',
      practice: [],
    });
    expect(affirmationFromExample({ text: 'x', checks: { personal: 'yes' } })?.checks).toEqual({
      personal: false,
      positive: false,
      present: false,
      visual: false,
      emotional: false,
    });
    expect(affirmationFromExample({ text: '', checks: ALL })).toBeNull();
    expect(affirmationFromExample({ text: 'x' })).toBeNull();
    expect(affirmationFromExample(null)).toBeNull();
  });

  it('finds the untouched live sample of an example', () => {
    const sample = { ...affirmation('s', { text: 'I let her finish.' }), sample: true };
    expect(liveSampleOf([sample], { text: 'I let her finish.' })).toBe(sample);
    expect(
      liveSampleOf([{ ...sample, sample: undefined }], { text: 'I let her finish.' }),
    ).toBeUndefined();
  });
});
