import {
  CENTRE_KEYS,
  PRINCIPLE_KEYS,
  addPrincipleKey,
  addPrincipleName,
  canMarkDone,
  checklistLabelsFrom,
  checklistLoaded,
  deltas,
  doneChecklist,
  editAssessment,
  historyItems,
  hubStatus,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  labelsByKey,
  latestPrinciples,
  newAssessmentFields,
  principleLabels,
  ranked,
  ratingOf,
  removeAssessment,
  removePrinciple,
  restoreAssessment,
  topCentre,
  withFactor,
  withRating,
} from './centres.logic';
import { CentreAssessment, CentrePrinciple } from './centres.model';

const NOW = new Date('2026-09-26T09:00:00.000Z');

function assessment(fields: Partial<CentreAssessment> = {}, id = 'a'): CentreAssessment {
  return {
    id,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    ...newAssessmentFields('2026-09-01'),
    ...fields,
  };
}

const FACTORS = { security: 'a', guidance: 'b', wisdom: 'c', power: 'd' };
const COMPLETE = assessment({
  ratings: { work: 3, money: 2 },
  factors: FACTORS,
  principles: [{ key: 'integrity' }],
});
const LABELS = labelsByKey(
  PRINCIPLE_KEYS,
  PRINCIPLE_KEYS.map((key) => key[0].toUpperCase() + key.slice(1)),
);

describe('centres logic (issue #60)', () => {
  it('reads an unrated centre as 0 and clamps an imported out-of-range rating', () => {
    expect(ratingOf(assessment(), 'work')).toBe(0);
    expect(ratingOf(assessment({ ratings: { work: 7 as never } }), 'work')).toBe(3);
    expect(ratingOf(assessment({ ratings: { work: -1 as never } }), 'work')).toBe(0);
  });

  it('ranks by rating, ties in card order', () => {
    const order = ranked(assessment({ ratings: { self: 2, family: 2, work: 3 } })).map(
      (entry) => entry.centre,
    );
    expect(order.slice(0, 3)).toEqual(['work', 'family', 'self']);
    expect(order).toHaveLength(CENTRE_KEYS.length);
  });

  it('names the top centre, the first in card order on a tie, and none when all are 0', () => {
    expect(topCentre(assessment({ ratings: { money: 2, partner: 2 } }))).toBe('partner');
    expect(topCentre(assessment({ ratings: { work: 0 } }))).toBeNull();
    expect(topCentre(assessment())).toBeNull();
  });

  it('merges a rating and a factor without touching the others', () => {
    const a = assessment({ ratings: { work: 1 }, factors: { power: 'x' } });
    expect(withRating(a, 'money', 2)).toEqual({ work: 1, money: 2 });
    expect(withFactor(a, 'security', 'y')).toEqual({ power: 'x', security: 'y' });
  });

  it('adds a suggested key up to five and refuses the sixth', () => {
    const four: CentrePrinciple[] = [
      { key: 'fairness' },
      { key: 'honesty' },
      { key: 'dignity' },
      { name: 'x' },
    ];
    const five = addPrincipleKey(four, 'growth');
    expect(five).toHaveLength(5);
    expect(addPrincipleKey(five!, 'courage')).toBeNull();
    expect(addPrincipleKey(five!, 'growth')).toBe(five);
  });

  it('adds typed words trimmed, maps a suggestion label to its key, ignores repeats', () => {
    expect(addPrincipleName([], '  keeping my word ', LABELS)).toEqual({
      principles: [{ name: 'keeping my word' }],
    });
    expect(addPrincipleName([], 'honesty', LABELS)).toEqual({ principles: [{ key: 'honesty' }] });
    const list: CentrePrinciple[] = [{ key: 'honesty' }, { name: 'Keeping my word' }];
    expect(addPrincipleName(list, 'Honesty', LABELS)).toEqual({ principles: list });
    expect(addPrincipleName(list, 'keeping MY word', LABELS)).toEqual({ principles: list });
    expect(addPrincipleName(list, '   ', LABELS)).toEqual({ principles: list });
  });

  it('refuses a sixth typed principle', () => {
    const five: CentrePrinciple[] = ['a', 'b', 'c', 'd', 'e'].map((name) => ({ name }));
    expect(addPrincipleName(five, 'f', LABELS)).toEqual({ refused: 'max' });
  });

  it('removes a principle by key or by name', () => {
    const list: CentrePrinciple[] = [{ key: 'honesty' }, { name: 'x' }];
    expect(removePrinciple(list, { key: 'honesty' })).toEqual([{ name: 'x' }]);
    expect(removePrinciple(list, { name: 'x' })).toEqual([{ key: 'honesty' }]);
  });

  it('labels principles: keys translated, names as typed, malformed ones skipped', () => {
    const a = assessment({
      principles: [
        { key: 'service' },
        { name: 'keeping my word' },
        {},
        { key: 'honesty', name: 'x' },
      ],
    });
    expect(principleLabels(a, LABELS)).toEqual(['Service', 'keeping my word']);
  });

  it('a draft is worth saving on a rating (even 0), typed factor text or a principle', () => {
    expect(isDraftWorthSaving(assessment())).toBe(false);
    expect(isDraftWorthSaving(assessment({ factors: { power: '  ' } }))).toBe(false);
    expect(isDraftWorthSaving(assessment({ ratings: { work: 0 } }))).toBe(true);
    expect(isDraftWorthSaving(assessment({ factors: { power: 'x' } }))).toBe(true);
    expect(isDraftWorthSaving(assessment({ principles: [{ key: 'growth' }] }))).toBe(true);
  });

  it('is complete with a rating above 0, all four factors and a principle', () => {
    expect(isComplete(COMPLETE)).toBe(true);
    expect(isComplete({ ...COMPLETE, ratings: { work: 0 } })).toBe(false);
    expect(isComplete({ ...COMPLETE, factors: { ...FACTORS, wisdom: ' ' } })).toBe(false);
    expect(isComplete({ ...COMPLETE, principles: [] })).toBe(false);
  });

  it('enables Mark done on one complete live assessment only', () => {
    expect(canMarkDone([])).toBe(false);
    expect(canMarkDone([COMPLETE])).toBe(true);
    expect(canMarkDone([{ ...COMPLETE, deletedAt: NOW.toISOString() }])).toBe(false);
    expect(isStarted([{ ...COMPLETE, deletedAt: NOW.toISOString() }])).toBe(false);
    expect(isStarted([COMPLETE])).toBe(true);
  });

  it('builds the checklist from the assessment closest to passing, once labels load', () => {
    const labels = checklistLabelsFrom(['Rate', 'Say', 'Pick']);
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(labels)).toBe(true);
    const partial = assessment({ ratings: { work: 2 } }, 'p');
    expect(doneChecklist([partial], labels)).toEqual([
      { label: 'Rate', met: true },
      { label: 'Say', met: false },
      { label: 'Pick', met: false },
    ]);
    expect(doneChecklist([], labels).every((item) => !item.met)).toBe(true);
  });

  it('lists the centres whose rating changed, in card order', () => {
    const previous = assessment({ ratings: { work: 3, money: 1 } });
    const latest = assessment({ ratings: { work: 2, money: 1, family: 1 } });
    expect(deltas(latest, previous)).toEqual([
      { centre: 'family', from: 0, to: 1 },
      { centre: 'work', from: 3, to: 2 },
    ]);
    expect(deltas(previous, previous)).toEqual([]);
  });

  it("offers the latest live assessment's principles as mission inputs", () => {
    const older = assessment({ date: '2026-08-01', principles: [{ key: 'growth' }] }, 'old');
    const latest = assessment(
      { date: '2026-09-01', principles: [{ key: 'integrity' }, { name: ' Keeping my word ' }] },
      'new',
    );
    expect(latestPrinciples([older, latest])).toEqual([
      { id: 'integrity', text: 'integrity' },
      { id: 'name:keeping my word', text: 'Keeping my word' },
    ]);
    expect(latestPrinciples([older, { ...latest, deletedAt: NOW.toISOString() }])).toEqual([
      { id: 'growth', text: 'growth' },
    ]);
    expect(latestPrinciples([])).toEqual([]);
  });

  it("gives the hub the latest assessment's top centre, null without one", () => {
    expect(hubStatus([])).toBeNull();
    expect(hubStatus([assessment({ ratings: { work: 0 } })])).toBeNull();
    const older = assessment({ date: '2026-08-01', ratings: { money: 3 } }, 'old');
    const latest = assessment({ date: '2026-09-01', ratings: { work: 2 } }, 'new');
    expect(hubStatus([latest, older])).toEqual({
      key: 'habits.exercises.h2-centres.topCentre.work',
      count: 1,
    });
  });

  it('builds history rows with the top centre label and the principle count', () => {
    const labels = labelsByKey(
      CENTRE_KEYS,
      CENTRE_KEYS.map((centre) => `Centre: ${centre}`),
    );
    expect(historyItems([COMPLETE, assessment({}, 'b')], labels)).toEqual([
      {
        id: 'a',
        date: '2026-09-01',
        label: 'Centre: work',
        summary: { key: 'h2Centres.list.principleCountText', count: 1 },
      },
      {
        id: 'b',
        date: '2026-09-01',
        label: '',
        summary: { key: 'h2Centres.list.principleCountText', count: 0 },
      },
    ]);
  });

  it("falls back to '' per label before the scope loads", () => {
    expect(labelsByKey(['a', 'b'], [''])).toEqual({ a: '', b: '' });
  });

  it('edits, tombstones and restores by id', () => {
    const list = [COMPLETE, assessment({}, 'b')];
    const edited = editAssessment(list, 'b', { ratings: { work: 1 } }, NOW);
    expect(edited[1].ratings).toEqual({ work: 1 });
    expect(edited[1].updatedAt).toBe(NOW.toISOString());
    expect(edited[0]).toBe(COMPLETE);
    const removed = removeAssessment(list, 'a', NOW);
    expect(removed[0].deletedAt).toBe(NOW.toISOString());
    expect(editAssessment(removed, 'a', { ratings: {} }, NOW)[0]).toBe(removed[0]);
    expect(restoreAssessment(removed, 'a', NOW)[0].deletedAt).toBeUndefined();
  });
});
