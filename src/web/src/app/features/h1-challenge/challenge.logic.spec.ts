import type { Commitment } from '../../shared/commitments/commitments.model';
import {
  activeChallenge,
  anchorDate,
  canCheckIn,
  canFinish,
  canSkip,
  canWriteMid,
  checkedInCount,
  checklistLabelsFrom,
  checklistLoaded,
  dayNumber,
  dayStates,
  daysBetween,
  displayDay,
  doneChecklist,
  finishChallenge,
  hasCounts,
  hubStatus,
  isComplete,
  isStarted,
  lastDay,
  newChallengeFields,
  pastChallenges,
  promiseTally,
  referenceDate,
  stopChallenge,
  streak,
  summarize,
  withCheckIn,
  withNote,
  withSkip,
} from './challenge.logic';
import type { Challenge, CheckIn, CheckInAnswers } from './challenge.model';

const NOW = new Date(2026, 1, 26, 12);
const START = '2026-03-01';
const DAY_1 = START;
const DAY_15 = '2026-03-15';
const DAY_30 = '2026-03-30';
const DAY_31 = '2026-03-31';
const ALL_YES: CheckInAnswers = { influence: true, promise: true, response: true, noBlame: true };

function challenge(fields: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-01T08:00:00.000Z',
    startDate: START,
    status: 'active',
    checkins: [],
    ...fields,
  };
}

const answered = (date: string): CheckIn => ({ date, answers: ALL_YES });
const skipped = (date: string): CheckIn => ({ date, skipped: true });

function promise(fields: Partial<Commitment>): Commitment {
  return {
    id: 'p1',
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-01T08:00:00.000Z',
    text: 'Call Mum',
    toWhom: 'self',
    status: 'open',
    ...fields,
  };
}

describe('challenge.logic', () => {
  describe('days', () => {
    it('counts calendar days across a daylight-saving change', () => {
      expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
      expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
      expect(daysBetween('2026-03-02', '2026-03-01')).toBe(-1);
    });

    it('numbers the days 1, 15, 30 and 31 once the window has passed', () => {
      const c = challenge();
      expect(dayNumber(c, DAY_1)).toBe(1);
      expect(dayNumber(c, DAY_15)).toBe(15);
      expect(dayNumber(c, DAY_30)).toBe(30);
      expect(dayNumber(c, DAY_31)).toBe(31);
      expect(displayDay(31)).toBe(30);
      expect(lastDay(c)).toBe(DAY_30);
    });

    it('never numbers a day below 1 (a start date after today, from an import)', () => {
      expect(dayNumber(challenge(), '2026-02-20')).toBe(1);
    });

    it('opens the halfway note on day 15 and Finish on day 30', () => {
      const c = challenge();
      expect(canWriteMid(c, '2026-03-14')).toBe(false);
      expect(canWriteMid(c, DAY_15)).toBe(true);
      expect(canFinish(c, '2026-03-29')).toBe(false);
      expect(canFinish(c, DAY_30)).toBe(true);
      expect(canFinish(c, DAY_31)).toBe(true);
    });

    it('rests the tab stop on today, held inside the window, and on day 30 once ended', () => {
      const c = challenge();
      expect(anchorDate(c, DAY_15)).toBe(DAY_15);
      expect(anchorDate(c, '2026-02-20')).toBe(DAY_1);
      expect(anchorDate(c, DAY_31)).toBe(DAY_30);
      expect(anchorDate(challenge({ status: 'stopped', endedOn: '2026-03-05' }), DAY_15)).toBe(
        DAY_30,
      );
    });

    it('takes counts at today, the end date, or day 30, whichever is first', () => {
      expect(referenceDate(challenge(), DAY_15)).toBe(DAY_15);
      expect(referenceDate(challenge(), DAY_31)).toBe(DAY_30);
      const stopped = challenge({ status: 'stopped', endedOn: '2026-03-05' });
      expect(referenceDate(stopped, DAY_31)).toBe('2026-03-05');
    });
  });

  describe('dayStates()', () => {
    it('gives each of the 30 cells one state on day 15', () => {
      const c = challenge({
        checkins: [answered('2026-03-13'), skipped('2026-03-14'), answered(DAY_15)],
      });
      const cells = dayStates(c, DAY_15);
      expect(cells).toHaveLength(30);
      expect(cells[0]).toEqual({ day: 1, date: DAY_1, state: 'missed', isToday: false });
      expect(cells[12].state).toBe('checkedIn');
      expect(cells[13].state).toBe('skipped');
      expect(cells[14]).toEqual({ day: 15, date: DAY_15, state: 'checkedIn', isToday: true });
      expect(cells[15].state).toBe('future');
      expect(cells[29]).toMatchObject({ day: 30, date: DAY_30, state: 'future' });
    });

    it('shows today as today until it is checked in', () => {
      expect(dayStates(challenge(), DAY_1)[0]).toMatchObject({ state: 'today', isToday: true });
    });

    it('has no today and no future day on day 31', () => {
      const cells = dayStates(challenge(), DAY_31);
      expect(cells.every((cell) => cell.state === 'missed' && !cell.isToday)).toBe(true);
    });

    it('reads an ended test as past: every unrecorded day is missed', () => {
      const stopped = challenge({ status: 'stopped', endedOn: '2026-03-03' });
      const cells = dayStates(stopped, '2026-03-03');
      expect(cells.every((cell) => cell.state === 'missed' && !cell.isToday)).toBe(true);
    });
  });

  describe('streak()', () => {
    it('counts consecutive check-ins ending today', () => {
      const c = challenge({
        checkins: [answered('2026-03-13'), answered('2026-03-14'), answered(DAY_15)],
      });
      expect(streak(c, DAY_15)).toBe(3);
    });

    it('counts a streak ending yesterday while today is still to come', () => {
      const c = challenge({ checkins: [answered('2026-03-13'), answered('2026-03-14')] });
      expect(streak(c, DAY_15)).toBe(2);
    });

    it('is broken by a skipped or a missed day', () => {
      expect(
        streak(
          challenge({
            checkins: [answered('2026-03-12'), skipped('2026-03-13'), answered('2026-03-14')],
          }),
          DAY_15,
        ),
      ).toBe(1);
      expect(streak(challenge({ checkins: [answered('2026-03-12')] }), DAY_15)).toBe(0);
    });

    it('stops at the start date and counts up to day 30 at most', () => {
      const all = Array.from({ length: 30 }, (_, i) =>
        answered(`2026-03-${String(i + 1).padStart(2, '0')}`),
      );
      expect(streak(challenge({ checkins: all }), DAY_30)).toBe(30);
      expect(streak(challenge({ checkins: all }), DAY_31)).toBe(30);
      expect(streak(challenge({ checkins: all }), '2026-04-10')).toBe(30);
      expect(streak(challenge({ checkins: [answered(DAY_1)] }), DAY_1)).toBe(1);
    });

    it('counts an ended test up to its end date', () => {
      const stopped = challenge({
        status: 'stopped',
        endedOn: '2026-03-03',
        checkins: [answered('2026-03-02'), answered('2026-03-03')],
      });
      expect(streak(stopped, DAY_31)).toBe(2);
    });
  });

  it('counts check-ins inside the window only, never skipped days', () => {
    const c = challenge({
      checkins: [answered(DAY_1), skipped('2026-03-02'), answered(DAY_30), answered(DAY_31)],
    });
    expect(checkedInCount(c)).toBe(2);
  });

  describe('check-ins', () => {
    it('records today once, and replaces it on a second save', () => {
      const first = withCheckIn(challenge(), DAY_15, ALL_YES, 'Asked what we could change.', NOW);
      expect(first?.checkins).toEqual([
        { date: DAY_15, answers: ALL_YES, note: 'Asked what we could change.' },
      ]);
      expect(first?.updatedAt).toBe(NOW.toISOString());
      const second = withCheckIn(first!, DAY_15, { ...ALL_YES, noBlame: false }, '  ', NOW);
      expect(second?.checkins).toEqual([{ date: DAY_15, answers: { ...ALL_YES, noBlame: false } }]);
    });

    it('refuses a check-in outside the window, on an ended test or on a skipped today', () => {
      expect(withCheckIn(challenge(), DAY_31, ALL_YES, '', NOW)).toBeNull();
      expect(withCheckIn(challenge(), '2026-02-28', ALL_YES, '', NOW)).toBeNull();
      expect(withCheckIn(challenge({ status: 'stopped' }), DAY_15, ALL_YES, '', NOW)).toBeNull();
      expect(canCheckIn(challenge({ checkins: [skipped(DAY_15)] }), DAY_15)).toBe(false);
    });

    it('marks a missed past day skipped, with or without a reason, in date order', () => {
      const c = challenge({ checkins: [answered('2026-03-10')] });
      expect(withSkip(c, '2026-03-09', 'Ill in bed all day.', DAY_15, NOW)?.checkins).toEqual([
        { date: '2026-03-09', skipped: true, skipReason: 'Ill in bed all day.' },
        answered('2026-03-10'),
      ]);
      expect(withSkip(c, '2026-03-09', '', DAY_15, NOW)?.checkins[0]).toEqual({
        date: '2026-03-09',
        skipped: true,
      });
    });

    it('refuses to skip today, a future day, a recorded day or an invalid date', () => {
      const c = challenge({ checkins: [answered('2026-03-10')] });
      expect(canSkip(c, DAY_15, DAY_15)).toBe(false);
      expect(canSkip(c, '2026-03-16', DAY_15)).toBe(false);
      expect(canSkip(c, '2026-03-10', DAY_15)).toBe(false);
      expect(canSkip(c, '', DAY_15)).toBe(false);
      expect(canSkip(c, '2026-02-30', DAY_15)).toBe(false);
      expect(canSkip(c, '2026-02-28', DAY_15)).toBe(false);
      expect(withSkip(c, DAY_15, '', DAY_15, NOW)).toBeNull();
    });
  });

  describe('notes, finish and stop', () => {
    it('sets a note and removes an emptied one', () => {
      const withMid = withNote(challenge(), 'midNote', 'I catch myself faster.', NOW);
      expect(withMid.midNote).toBe('I catch myself faster.');
      expect('midNote' in withNote(withMid, 'midNote', '   ', NOW)).toBe(false);
    });

    it('finishes from day 30 with a final note only', () => {
      const noted = challenge({ finalNote: 'Fewer arguments.' });
      expect(finishChallenge(challenge({ finalNote: 'x' }), '2026-03-29', NOW)).toBeNull();
      expect(finishChallenge(challenge(), DAY_30, NOW)).toBeNull();
      expect(finishChallenge(noted, DAY_31, NOW)).toMatchObject({
        status: 'completed',
        endedOn: DAY_31,
      });
      expect(finishChallenge({ ...noted, status: 'stopped' }, DAY_30, NOW)).toBeNull();
    });

    it('stops a running test on today, and only a running one', () => {
      expect(stopChallenge(challenge(), '2026-03-05', NOW)).toMatchObject({
        status: 'stopped',
        endedOn: '2026-03-05',
      });
      expect(stopChallenge(challenge({ status: 'completed' }), DAY_31, NOW)).toBeNull();
    });
  });

  describe('newChallengeFields()', () => {
    it('keeps a valid past start date and a typed focus', () => {
      expect(newChallengeFields('2026-02-20', 'My teenager', '2026-02-26')).toEqual({
        startDate: '2026-02-20',
        status: 'active',
        checkins: [],
        focus: 'My teenager',
      });
    });

    it('starts today on an empty, invalid or future date, and drops a blank focus', () => {
      for (const date of ['', '2026-02-30', '26/02/2026', '2026-03-01']) {
        expect(newChallengeFields(date, '  ', '2026-02-26')).toEqual({
          startDate: '2026-02-26',
          status: 'active',
          checkins: [],
        });
      }
    });
  });

  describe('lists', () => {
    const running = challenge({ id: 'run' });
    const done = challenge({ id: 'done', startDate: '2026-01-01', status: 'completed' });
    const stopped = challenge({ id: 'stop', startDate: '2026-02-01', status: 'stopped' });
    const deleted = challenge({ id: 'gone', status: 'completed', deletedAt: NOW.toISOString() });

    it('finds the running test and lists past ones latest first, ignoring tombstones', () => {
      expect(activeChallenge([done, running])?.id).toBe('run');
      expect(activeChallenge([done, { ...running, deletedAt: 'x' }])).toBeNull();
      expect(pastChallenges([done, running, stopped, deleted]).map((c) => c.id)).toEqual([
        'stop',
        'done',
      ]);
    });

    it('is started once any live test exists', () => {
      expect(isStarted([])).toBe(false);
      expect(isStarted([deleted])).toBe(false);
      expect(isStarted([stopped])).toBe(true);
    });
  });

  describe('hubStatus()', () => {
    it('shows the day and streak while running, the day alone with no streak', () => {
      const c = challenge({ checkins: [answered('2026-03-11'), answered('2026-03-12')] });
      expect(hubStatus([c], '2026-03-12')).toEqual({
        key: 'habits.exercises.h1-challenge.dayStreak',
        count: 2,
        params: { day: 12 },
      });
      expect(hubStatus([challenge()], DAY_15)).toEqual({
        key: 'habits.exercises.h1-challenge.dayNumber',
        count: 15,
      });
      expect(hubStatus([challenge()], DAY_31)).toMatchObject({ count: 30 });
    });

    it('counts completed tests with none running, and is null with none', () => {
      const done = challenge({ status: 'completed' });
      expect(hubStatus([done, done], DAY_31)).toEqual({
        key: 'habits.exercises.h1-challenge.completedCount',
        count: 2,
      });
      expect(hubStatus([challenge({ status: 'stopped' })], DAY_31)).toBeNull();
      expect(hubStatus([], DAY_31)).toBeNull();
    });
  });

  describe('summary', () => {
    const commitments = [
      promise({ id: 'a', status: 'kept', resolvedOn: '2026-03-05' }),
      promise({ id: 'b', status: 'broken', resolvedOn: '2026-03-06' }),
      promise({ id: 'c', status: 'withdrawn', resolvedOn: '2026-03-07' }),
      promise({ id: 'd', status: 'kept', resolvedOn: '2026-02-20' }),
      promise({ id: 'e', status: 'kept', resolvedOn: '2026-03-08', sample: true }),
    ];

    it('tallies kept of kept + broken promises resolved during the test', () => {
      expect(promiseTally(challenge(), commitments, DAY_15)).toEqual({ kept: 1, count: 2 });
      expect(promiseTally(challenge(), commitments, '2026-03-05')).toEqual({ kept: 1, count: 1 });
    });

    it('omits the promise line with nothing kept or broken', () => {
      expect(promiseTally(challenge(), [], DAY_15)).toBeNull();
      expect(promiseTally(challenge(), [commitments[2]], DAY_15)).toBeNull();
    });

    it('has no counts to show on a fresh test', () => {
      expect(hasCounts(summarize(challenge(), [], DAY_1))).toBe(false);
      expect(summarize(challenge({ checkins: [answered(DAY_1)] }), [], DAY_1)).toEqual({
        checkedIn: 1,
        streak: 1,
        promises: null,
      });
    });
  });

  describe('done gate', () => {
    const labels = checklistLabelsFrom(['Start', 'Day 30', 'Final']);

    it('lists every item unmet with no test, and waits for its labels', () => {
      expect(doneChecklist([], DAY_1, labels).map((item) => item.met)).toEqual([
        false,
        false,
        false,
      ]);
      expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
      expect(checklistLoaded(labels)).toBe(true);
    });

    it('steps through day 1, day 30 and Finish', () => {
      const running = challenge({ finalNote: 'Fewer arguments.' });
      expect(doneChecklist([running], DAY_1, labels).map((item) => item.met)).toEqual([
        true,
        false,
        false,
      ]);
      expect(doneChecklist([running], DAY_30, labels).map((item) => item.met)).toEqual([
        true,
        true,
        false,
      ]);
      expect(isComplete([running])).toBe(false);
      const finished = finishChallenge(running, DAY_30, NOW)!;
      expect(doneChecklist([finished], DAY_31, labels).every((item) => item.met)).toBe(true);
      expect(isComplete([finished])).toBe(true);
    });

    it('never counts a stopped or deleted test', () => {
      const stopped = challenge({ status: 'stopped', endedOn: DAY_31, finalNote: 'x' });
      expect(isComplete([stopped])).toBe(false);
      expect(doneChecklist([stopped], DAY_31, labels).some((item) => item.met)).toBe(false);
      expect(isComplete([challenge({ status: 'completed', deletedAt: 'x' })])).toBe(false);
    });
  });
});
