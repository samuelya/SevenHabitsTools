import { LanguageLog, ListeningDay, Phrase } from './language.model';
import {
  CHECKLIST_KEYS,
  checklistLabelsFrom,
  checklistLoaded,
  dayState,
  daySummary,
  doneChecklist,
  editPhrase,
  effectiveEnd,
  endDay,
  hasEnded,
  hoursLeft,
  hubStatus,
  isComplete,
  isDraftWorthSaving,
  isItemComplete,
  isRunning,
  isStarted,
  kindLabelsFrom,
  liveSampleOf,
  perDay,
  phraseEdit,
  phraseFromExample,
  phraseToSave,
  removePhrase,
  restorePhrase,
  runningDay,
  startDay,
  streak,
  toListItem,
} from './language.logic';

/** Local 09:00 on 2026-03-10; the day it starts runs until 09:00 on 2026-03-11. */
const START = new Date(2026, 2, 10, 9, 0, 0);
const HOUR = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(START.getTime() + offsetMs);

function day(fields: Partial<ListeningDay> = {}): ListeningDay {
  return {
    id: 'd1',
    createdAt: START.toISOString(),
    updatedAt: START.toISOString(),
    startedAt: START.toISOString(),
    ...fields,
  };
}

let counter = 0;
function phrase(fields: Partial<Phrase> = {}): Phrase {
  counter += 1;
  return {
    id: `p${counter}`,
    createdAt: START.toISOString(),
    updatedAt: START.toISOString(),
    text: 'I have to',
    kind: 'reactive',
    ...fields,
  };
}

/** A phrase added at local noon on `date` (`YYYY-MM-DD`). */
function phraseOn(date: string, fields: Partial<Phrase> = {}): Phrase {
  const [y, m, d] = date.split('-').map(Number);
  const stamp = new Date(y, m - 1, d, 12).toISOString();
  return phrase({ createdAt: stamp, updatedAt: stamp, ...fields });
}

const log = (phrases: Phrase[] = [], listeningDays: ListeningDay[] = []): LanguageLog => ({
  phrases,
  listeningDays,
});

describe('listening day across the 24-hour boundary', () => {
  it('runs from the start until just before startedAt + 24 h', () => {
    expect(isRunning(day(), START)).toBe(true);
    expect(isRunning(day(), at(24 * HOUR - 1))).toBe(true);
    expect(isRunning(day(), at(24 * HOUR))).toBe(false);
    expect(isRunning(day(), at(30 * HOUR))).toBe(false);
  });

  it('stops running once ended or deleted, and never runs with an unreadable start', () => {
    expect(isRunning(day({ endedAt: at(HOUR).toISOString() }), at(2 * HOUR))).toBe(false);
    expect(isRunning(day({ deletedAt: at(HOUR).toISOString() }), at(2 * HOUR))).toBe(false);
    expect(isRunning(day({ startedAt: 'nonsense' }), START)).toBe(false);
  });

  it('effectiveEnd is endedAt, else the earlier of now and startedAt + 24 h', () => {
    const ended = at(3 * HOUR).toISOString();
    expect(effectiveEnd(day({ endedAt: ended }), at(30 * HOUR)).toISOString()).toBe(ended);
    expect(effectiveEnd(day(), at(5 * HOUR))).toEqual(at(5 * HOUR));
    expect(effectiveEnd(day(), at(30 * HOUR))).toEqual(at(24 * HOUR));
  });

  it('hasEnded flips at the mark without anything stored', () => {
    expect(hasEnded(day(), at(24 * HOUR - 1))).toBe(false);
    expect(hasEnded(day(), at(24 * HOUR))).toBe(true);
    expect(hasEnded(day({ deletedAt: START.toISOString() }), at(25 * HOUR))).toBe(false);
  });

  it('hoursLeft rounds up, never exceeds 24 and never goes below 0', () => {
    expect(hoursLeft(day(), START)).toBe(24);
    expect(hoursLeft(day(), at(-5000))).toBe(24);
    expect(hoursLeft(day(), at(HOUR / 2))).toBe(24);
    expect(hoursLeft(day(), at(HOUR))).toBe(23);
    expect(hoursLeft(day(), at(24 * HOUR - 1000))).toBe(1);
    expect(hoursLeft(day(), at(25 * HOUR))).toBe(0);
  });

  it('dayState: none, running with hours, then ended at the mark', () => {
    expect(dayState([], START)).toEqual({ kind: 'none' });
    expect(dayState([day()], at(2 * HOUR))).toEqual({
      kind: 'running',
      day: day(),
      hoursLeft: 22,
    });
    expect(dayState([day()], at(24 * HOUR))).toEqual({ kind: 'ended', day: day() });
  });

  it('dayState shows the latest live day once none runs', () => {
    const older = day({ id: 'old', startedAt: at(-48 * HOUR).toISOString() });
    const deleted = day({ id: 'gone', startedAt: at(HOUR).toISOString(), deletedAt: 'x' });
    expect(dayState([day(), older, deleted], at(30 * HOUR))).toMatchObject({
      kind: 'ended',
      day: { id: 'd1' },
    });
  });
});

describe('startDay / endDay', () => {
  it('starts a day now, only when none runs', () => {
    const started = startDay(log(), START);
    expect(started.listeningDays).toHaveLength(1);
    expect(started.listeningDays[0].startedAt).toBe(START.toISOString());
    expect(started.listeningDays[0].endedAt).toBeUndefined();
    expect(startDay(started, at(HOUR))).toBe(started);

    const next = startDay(started, at(24 * HOUR));
    expect(next.listeningDays).toHaveLength(2);
    expect(runningDay(next.listeningDays, at(24 * HOUR))?.id).toBe(next.listeningDays[1].id);
  });

  it('ends only the running day it names', () => {
    const ended = endDay(log([], [day()]), 'd1', at(3 * HOUR));
    expect(ended.listeningDays[0].endedAt).toBe(at(3 * HOUR).toISOString());
    expect(ended.listeningDays[0].updatedAt).toBe(at(3 * HOUR).toISOString());
    // Already over at the mark: nothing to end.
    expect(endDay(log([], [day()]), 'd1', at(25 * HOUR)).listeningDays[0].endedAt).toBeUndefined();
    expect(endDay(log([], [day()]), 'other', at(3 * HOUR)).listeningDays[0]).toEqual(day());
  });
});

describe('daySummary', () => {
  it('counts the counted phrases logged in that day by kind, and the rewrites', () => {
    const phrases = [
      phrase({ listeningDayId: 'd1', reframe: 'I choose' }),
      phrase({ listeningDayId: 'd1' }),
      phrase({ listeningDayId: 'd1', kind: 'proactive' }),
      phrase({ listeningDayId: 'd1', deletedAt: 'x' }),
      phrase({ listeningDayId: 'd1', sample: true }),
      phrase({ listeningDayId: 'd2', reframe: 'I will' }),
      phrase(),
    ];
    expect(daySummary(phrases, 'd1')).toEqual({ reactive: 2, proactive: 1, rewritten: 1 });
  });
});

describe('item and exercise rules', () => {
  it('isItemComplete: written, and proactive or rewritten', () => {
    expect(isItemComplete({ text: 'x', kind: 'proactive' })).toBe(true);
    expect(isItemComplete({ text: 'x', kind: 'reactive', reframe: 'y' })).toBe(true);
    expect(isItemComplete({ text: 'x', kind: 'reactive', reframe: ' ' })).toBe(false);
    expect(isItemComplete({ text: ' ', kind: 'proactive' })).toBe(false);
  });

  it('isStarted: a counted phrase or any live day; a sample alone does not start it', () => {
    expect(isStarted(log())).toBe(false);
    expect(isStarted(log([phrase({ sample: true })]))).toBe(false);
    expect(isStarted(log([phrase({ deletedAt: 'x' })]))).toBe(false);
    expect(isStarted(log([phrase()]))).toBe(true);
    expect(isStarted(log([], [day()]))).toBe(true);
  });

  it('hubStatus counts counted phrases, null with none', () => {
    expect(hubStatus(log([], [day()]))).toBeNull();
    expect(hubStatus(log([phrase(), phrase(), phrase({ sample: true })]))).toEqual({
      key: 'habits.exercises.h1-language.phraseCount',
      count: 2,
    });
  });

  it('isComplete needs an ended day and a counted reactive phrase with a rewrite', () => {
    const rewritten = phrase({ reframe: 'I choose' });
    expect(isComplete(log([rewritten], [day()]), at(HOUR))).toBe(false);
    expect(isComplete(log([rewritten], [day()]), at(24 * HOUR))).toBe(true);
    expect(isComplete(log([rewritten], [day({ endedAt: at(HOUR).toISOString() })]), at(HOUR))).toBe(
      true,
    );
    expect(isComplete(log([phrase()], [day()]), at(24 * HOUR))).toBe(false);
    expect(isComplete(log([{ ...rewritten, sample: true }], [day()]), at(24 * HOUR))).toBe(false);
    // A proactive phrase with a leftover rewrite doesn't count.
    expect(isComplete(log([{ ...rewritten, kind: 'proactive' }], [day()]), at(24 * HOUR))).toBe(
      false,
    );
  });

  it('doneChecklist reports each of the three items and matches isComplete', () => {
    const labels = checklistLabelsFrom(['Day', 'Phrase', 'Rewrite']);
    expect(checklistLoaded(labels)).toBe(true);
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(doneChecklist(log([phrase()], [day()]), at(HOUR), labels)).toEqual([
      { label: 'Day', met: false },
      { label: 'Phrase', met: true },
      { label: 'Rewrite', met: false },
    ]);
    const done = log([phrase({ reframe: 'I choose' })], [day()]);
    expect(doneChecklist(done, at(25 * HOUR), labels).every((item) => item.met)).toBe(true);
    expect(CHECKLIST_KEYS).toEqual(['day', 'phrase', 'rewrite']);
  });
});

describe('perDay and streak', () => {
  it('perDay: 7 rows ending today, oldest first, counted phrases by kind', () => {
    const phrases = [
      phraseOn('2026-03-10'),
      phraseOn('2026-03-10', { kind: 'proactive' }),
      phraseOn('2026-03-04'),
      phraseOn('2026-03-03'),
      phraseOn('2026-03-09', { sample: true }),
      phraseOn('2026-03-09', { deletedAt: 'x' }),
    ];
    const rows = perDay(phrases, '2026-03-10');
    expect(rows.map((row) => row.date)).toEqual([
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ]);
    expect(rows[0]).toEqual({ date: '2026-03-04', reactive: 1, proactive: 0 });
    expect(rows[5]).toEqual({ date: '2026-03-09', reactive: 0, proactive: 0 });
    expect(rows[6]).toEqual({ date: '2026-03-10', reactive: 1, proactive: 1 });
  });

  it('perDay uses the local date of createdAt across midnight', () => {
    const late = new Date(2026, 2, 9, 23, 59).toISOString();
    const early = new Date(2026, 2, 10, 0, 1).toISOString();
    const rows = perDay([phrase({ createdAt: late }), phrase({ createdAt: early })], '2026-03-10');
    expect(rows[5].reactive).toBe(1);
    expect(rows[6].reactive).toBe(1);
  });

  it('streak counts consecutive days ending today', () => {
    const phrases = ['2026-03-10', '2026-03-09', '2026-03-08', '2026-03-06'].map((d) =>
      phraseOn(d),
    );
    expect(streak(phrases, '2026-03-10')).toBe(3);
  });

  it('streak may end yesterday while today has none yet, and is 0 after a gap', () => {
    const phrases = [phraseOn('2026-03-09'), phraseOn('2026-03-08')];
    expect(streak(phrases, '2026-03-10')).toBe(2);
    expect(streak(phrases, '2026-03-11')).toBe(0);
    expect(streak([], '2026-03-10')).toBe(0);
  });

  it('streak ignores samples and deleted phrases', () => {
    const phrases = [
      phraseOn('2026-03-10'),
      phraseOn('2026-03-09', { sample: true }),
      phraseOn('2026-03-08', { deletedAt: 'x' }),
    ];
    expect(streak(phrases, '2026-03-10')).toBe(1);
  });
});

describe('list rows', () => {
  const labels = {
    kind: kindLabelsFrom(['Giving away', 'Owning']),
    example: 'Example',
    formatTime: () => '10 Mar, 09:00',
  };

  it('kindLabelsFrom falls back to empty strings before the scope loads', () => {
    expect(kindLabelsFrom([''])).toEqual({ reactive: '', proactive: '' });
  });

  it('shows the text, the kind and the time, and the done check', () => {
    expect(toListItem(phrase({ id: 'a', reframe: 'I choose' }), labels)).toEqual({
      id: 'a',
      title: 'I have to',
      subtitle: 'Giving away · 10 Mar, 09:00',
      done: true,
    });
    expect(
      toListItem(phrase({ text: '', kind: 'proactive', context: 'Kitchen' }), labels),
    ).toMatchObject({
      title: 'Kitchen',
      subtitle: 'Owning · 10 Mar, 09:00',
      done: false,
    });
  });

  it('a sample gets the Example chip and never the done check', () => {
    expect(toListItem(phrase({ sample: true, reframe: 'x' }), labels)).toMatchObject({
      chips: [{ label: 'Example' }],
      done: false,
    });
  });
});

describe('drafts and edits', () => {
  it('a draft is worth saving once "What you said" has text', () => {
    expect(isDraftWorthSaving({ text: '' })).toBe(false);
    expect(isDraftWorthSaving({ text: '  ' })).toBe(false);
    expect(isDraftWorthSaving({ text: 'I' })).toBe(true);
  });

  it('phraseEdit turns an emptied optional field into undefined', () => {
    expect(phraseEdit({ reframe: '', context: 'x' })).toEqual({ reframe: undefined, context: 'x' });
    expect(phraseEdit({ text: '' })).toEqual({ text: '' });
    const fields = { kind: 'proactive' as const };
    expect(phraseEdit(fields)).toBe(fields);
  });

  it('phraseToSave drops emptied fields and stamps the running day', () => {
    const draft = { ...phrase({ id: 'n' }), reframe: undefined, context: '' };
    const saved = phraseToSave(draft, day());
    expect(saved).not.toHaveProperty('reframe');
    expect(saved).not.toHaveProperty('context');
    expect(saved.listeningDayId).toBe('d1');
    expect(phraseToSave(draft, null)).not.toHaveProperty('listeningDayId');
  });

  it('editPhrase edits only the live phrase, clears emptied fields and drops the sample flag', () => {
    const a = phrase({ id: 'a', reframe: 'x', sample: true });
    const b = phrase({ id: 'b' });
    const [editedA, editedB] = editPhrase([a, b], 'a', { reframe: '' });
    expect(editedA).not.toHaveProperty('reframe');
    expect(editedA).not.toHaveProperty('sample');
    expect(editedB).toBe(b);
    const deleted = phrase({ id: 'c', deletedAt: 'x' });
    expect(editPhrase([deleted], 'c', { text: 'y' })[0]).toBe(deleted);
  });

  it('removes with a tombstone and restores', () => {
    const removed = removePhrase([phrase({ id: 'a' })], 'a', at(HOUR));
    expect(removed[0].deletedAt).toBe(at(HOUR).toISOString());
    expect(restorePhrase(removed, 'a', at(2 * HOUR))[0].deletedAt).toBeUndefined();
  });
});

describe('guide samples', () => {
  it('reads a valid example and rejects an invalid one', () => {
    expect(
      phraseFromExample({ text: 'I have to', kind: 'reactive', reframe: 'I will', context: '' }),
    ).toEqual({ text: 'I have to', kind: 'reactive', reframe: 'I will' });
    expect(phraseFromExample({ text: 'x', kind: 'other' })).toBeNull();
    expect(phraseFromExample({ kind: 'reactive' })).toBeNull();
    expect(phraseFromExample(null)).toBeNull();
  });

  it('finds the live, still-flagged sample made from the same example', () => {
    const fields = { text: 'I have to', kind: 'reactive' as const };
    const sample = phrase({ ...fields, sample: true });
    expect(liveSampleOf([sample], fields)).toBe(sample);
    expect(liveSampleOf([{ ...sample, sample: undefined }], fields)).toBeUndefined();
    expect(liveSampleOf([{ ...sample, deletedAt: 'x' }], fields)).toBeUndefined();
  });
});
