import {
  CHECKLIST_KEYS,
  InspirationFilter,
  addTag,
  allTags,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editFields,
  editInspiration,
  filtered,
  forMission,
  hubStatus,
  inspirationFromExample,
  isComplete,
  isDraftWorthSaving,
  isDuplicateTag,
  isItemComplete,
  isStarted,
  itemTags,
  keptTagFilter,
  labelsFrom,
  liveSampleOf,
  normaliseTag,
  normaliseTags,
  removeInspiration,
  removeTag,
  restoreInspiration,
  summarize,
  tagSuggestions,
  toListItem,
} from './inspiration.logic';
import { Inspiration } from './inspiration.model';

const T0 = '2026-09-01T00:00:00.000Z';
const NOW = new Date('2026-09-10T10:00:00.000Z');

function item(id: string, fields: Partial<Inspiration> = {}): Inspiration {
  return {
    id,
    createdAt: T0,
    updatedAt: T0,
    text: `Line ${id}`,
    kind: 'saying',
    tags: [],
    ...fields,
  };
}

const LABELS = labelsFrom(['Heard', 'Mine', 'To try'], 'Example', 'Favourite', 'Remove favourite');
const CHECK_LABELS = checklistLabelsFrom(['Three', 'Tag']);

describe('tags', () => {
  it('normalises one rule: trimmed, whitespace collapsed, lowercased', () => {
    expect(normaliseTag('  Hard   Work ')).toBe('hard work');
    expect(normaliseTags(['Time', ' time', '', 'Work'])).toEqual(['time', 'work']);
    expect(itemTags(item('a', { tags: [' Family ', 'family'] }))).toEqual(['family']);
  });

  it('adds a normalised tag, returning the same array for a blank or duplicate one', () => {
    const tags = ['time'];
    expect(addTag(tags, ' Work ')).toEqual(['time', 'work']);
    expect(addTag(tags, '   ')).toBe(tags);
    expect(addTag(tags, 'TIME')).toBe(tags);
    expect(isDuplicateTag(tags, ' Time')).toBe(true);
    expect(isDuplicateTag(tags, '')).toBe(false);
  });

  it('removes a tag, returning the same array when it is not there', () => {
    const tags = ['time', 'work'];
    expect(removeTag(tags, 'Time')).toEqual(['work']);
    expect(removeTag(tags, 'family')).toBe(tags);
  });

  it('lists the distinct tags of live items, sorted', () => {
    const list = [
      item('a', { tags: ['work', 'Time'] }),
      item('b', { tags: ['family', 'time'] }),
      item('c', { tags: ['gone'], deletedAt: T0 }),
    ];
    expect(allTags(list)).toEqual(['family', 'time', 'work']);
    expect(allTags([])).toEqual([]);
  });

  it("suggests used tags minus the item's own, matching what is typed", () => {
    const used = ['family', 'time', 'work'];
    expect(tagSuggestions(used, ['time'], '')).toEqual(['family', 'work']);
    expect(tagSuggestions(used, [], 'WO')).toEqual(['work']);
    expect(tagSuggestions(used, ['Work'], 'wo')).toEqual([]);
  });
});

describe('counting, hub and gate', () => {
  it('starts, counts and reports status from live non-sample items only', () => {
    const sample = item('s', { sample: true });
    const deleted = item('d', { deletedAt: T0 });
    expect(isStarted([sample, deleted])).toBe(false);
    expect(hubStatus([sample, deleted])).toBeNull();
    expect(isStarted([item('a')])).toBe(true);
    expect(hubStatus([item('a'), item('b'), sample])).toEqual({
      key: 'habits.exercises.h2-inspiration.collectedCount',
      count: 2,
    });
  });

  it('counts only items with a non-blank line: gate, hub status, summary and mission input', () => {
    const lineless = item('x', { text: '  ', source: 'Uncle', tags: ['time'], favourite: true });
    expect(isStarted([lineless])).toBe(false);
    expect(hubStatus([lineless])).toBeNull();
    expect(summarize([lineless])).toBeNull();
    expect(forMission([lineless])).toEqual([]);
    expect(isComplete([lineless, item('a', { tags: ['time'] }), item('b')])).toBe(false);
    expect(hubStatus([lineless, item('a')])?.count).toBe(1);
    expect(summarize([lineless, item('a')])).toEqual({ count: 1, favourites: 0 });
  });

  it('calls an item complete with its line and a tag', () => {
    expect(isItemComplete(item('a', { tags: ['time'] }))).toBe(true);
    expect(isItemComplete(item('a', { text: '  ', tags: ['time'] }))).toBe(false);
    expect(isItemComplete(item('a', { tags: [' '] }))).toBe(false);
  });

  it('saves a draft on typed text in the line or the source only', () => {
    expect(isDraftWorthSaving({ text: '', source: undefined })).toBe(false);
    expect(isDraftWorthSaving({ text: '  ', source: ' ' })).toBe(false);
    expect(isDraftWorthSaving({ text: 'a', source: undefined })).toBe(true);
    expect(isDraftWorthSaving({ text: '', source: 'Uncle' })).toBe(true);
  });

  it('enables Mark done with three items that have a line, at least one of them tagged', () => {
    const tagged = item('a', { tags: ['time'] });
    expect(isComplete([tagged, item('b')])).toBe(false);
    expect(isComplete([tagged, item('b'), item('c', { sample: true })])).toBe(false);
    expect(isComplete([tagged, item('b'), item('c')])).toBe(true);
    expect(isComplete([item('a'), item('b'), item('c')])).toBe(false);
    expect(isComplete([])).toBe(false);
  });

  it('needs no source: three tagged items without one are complete', () => {
    const list = [
      item('a', { tags: ['time'] }),
      item('b', { tags: ['work'] }),
      item('c', { tags: ['family'] }),
    ];
    expect(list.every((entry) => entry.source === undefined)).toBe(true);
    expect(isComplete(list)).toBe(true);
  });

  it('lists "three" and "tag", reducing the same map as the gate', () => {
    expect(doneChecklist([item('a', { tags: ['time'] }), item('b')], CHECK_LABELS)).toEqual([
      { label: 'Three', met: false },
      { label: 'Tag', met: true },
    ]);
    expect(doneChecklist([item('a'), item('b'), item('c')], CHECK_LABELS)).toEqual([
      { label: 'Three', met: true },
      { label: 'Tag', met: false },
    ]);
    expect(doneChecklist([], CHECK_LABELS).every((row) => !row.met)).toBe(true);
    const done = [item('a', { tags: ['time'] }), item('b'), item('c')];
    expect(doneChecklist(done, CHECK_LABELS).every((row) => row.met)).toBe(isComplete(done));
  });

  it('gates the checklist on loaded labels', () => {
    expect(CHECKLIST_KEYS).toEqual(['three', 'tag']);
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(CHECK_LABELS)).toBe(true);
  });

  it('summarises counted items and favourites, null with none', () => {
    expect(summarize([item('s', { sample: true })])).toBeNull();
    expect(summarize([item('a', { favourite: true }), item('b')])).toEqual({
      count: 2,
      favourites: 1,
    });
  });
});

describe('filters', () => {
  const list = [
    item('a', { kind: 'saying', source: 'My uncle', tags: ['time'], favourite: true }),
    item('b', { kind: 'thought', text: 'Ask a second question', tags: ['Family'] }),
    item('c', { kind: 'idea', deletedAt: T0 }),
  ];
  const ids = (filter: Partial<InspirationFilter>) =>
    filtered(list, { kind: null, tag: null, favouritesOnly: false, ...filter }).map(
      (entry) => entry.id,
    );

  it('lets every live item through with no filter', () => {
    expect(ids({})).toEqual(['a', 'b']);
  });

  it('filters by kind, tag (normalised) and favourites', () => {
    expect(ids({ kind: 'thought' })).toEqual(['b']);
    expect(ids({ kind: 'idea' })).toEqual([]);
    expect(ids({ tag: 'family' })).toEqual(['b']);
    expect(ids({ favouritesOnly: true })).toEqual(['a']);
    expect(ids({ kind: 'saying', favouritesOnly: true, tag: 'time' })).toEqual(['a']);
  });

  it('keeps the tag filter while the tag is in use and clears it once it is not', () => {
    expect(keptTagFilter(['family', 'time'], 'time')).toBe('time');
    expect(keptTagFilter(['family'], 'time')).toBeNull();
    expect(keptTagFilter(['family'], null)).toBeNull();
  });
});

describe('rows', () => {
  it('falls back to empty labels before the scope loads', () => {
    expect(labelsFrom([''], undefined, undefined, undefined)).toEqual({
      kind: { saying: '', thought: '', idea: '' },
      example: '',
      favourite: '',
      unfavourite: '',
    });
  });

  it('shows the line, its source, the kind chip, the done check and the favourite star', () => {
    const row = toListItem(
      item('a', {
        text: 'Two\nlines',
        kind: 'thought',
        source: ' Car ',
        tags: ['x'],
        favourite: true,
      }),
      LABELS,
    );
    expect(row).toEqual({
      id: 'a',
      title: 'Two lines',
      subtitle: 'Car',
      chips: [{ label: 'Mine' }],
      done: true,
      toggle: {
        pressed: true,
        icon: 'star_border',
        pressedIcon: 'star',
        label: 'Favourite',
        hint: 'Remove favourite',
      },
    });
  });

  it('marks a sample with an Example chip and never as done', () => {
    const row = toListItem(item('s', { sample: true, tags: ['x'] }), LABELS);
    expect(row.chips).toEqual([{ label: 'Example' }, { label: 'Heard' }]);
    expect(row.done).toBe(false);
    expect(row.subtitle).toBeUndefined();
    expect(row.toggle?.pressed).toBe(false);
    expect(row.toggle?.hint).toBe('Favourite');
  });
});

describe('edits', () => {
  it('cleans form edits: tags normalised, an unset star and an emptied source dropped', () => {
    expect(editFields({ tags: [' Time ', 'time'] })).toEqual({ tags: ['time'] });
    expect(editFields({ favourite: false })).toEqual({ favourite: undefined });
    expect(editFields({ favourite: true })).toEqual({ favourite: true });
    expect(editFields({ source: '  ' })).toEqual({ source: undefined });
    expect(editFields({ source: 'Uncle ' })).toEqual({ source: 'Uncle ' });
    expect(editFields({ text: '' })).toEqual({ text: '' });
  });

  it("edits a live item and makes a sample the user's own", () => {
    const list = [item('a', { sample: true, favourite: true }), item('b')];
    const next = editInspiration(list, 'a', editFields({ favourite: false }));
    expect(next[0]).toEqual(item('a'));
    expect('favourite' in next[0]).toBe(false);
    expect('sample' in next[0]).toBe(false);
    expect(next[1]).toBe(list[1]);
  });

  it('returns the same array for a missing, deleted or unchanged item', () => {
    const list = [item('a', { tags: ['time'] }), item('d', { deletedAt: T0 })];
    expect(editInspiration(list, 'x', { text: 'y' })).toBe(list);
    expect(editInspiration(list, 'd', { text: 'y' })).toBe(list);
    expect(editInspiration(list, 'a', { text: 'Line a', tags: ['time'] })).toBe(list);
    expect(editInspiration(list, 'a', editFields({ favourite: false }))).toBe(list);
  });

  it('tombstones and restores, the same array when there is nothing to do', () => {
    const list = [item('a')];
    const removed = removeInspiration(list, 'a', NOW);
    expect(removed[0].deletedAt).toBe(NOW.toISOString());
    expect(removeInspiration(removed, 'a', NOW)).toBe(removed);
    const restored = restoreInspiration(removed, 'a', NOW);
    expect('deletedAt' in restored[0]).toBe(false);
    expect(restored[0].updatedAt).toBe(NOW.toISOString());
    expect(restoreInspiration(list, 'a', NOW)).toBe(list);
  });
});

describe('mission input', () => {
  it('offers counted items with a line, favourites first, in the #61 shape', () => {
    const list = [
      item('a', { text: ' First ', source: '  ', tags: ['Time'] }),
      item('b', { text: 'Second', source: ' Uncle ', favourite: true, kind: 'idea' }),
      item('s', { sample: true }),
      item('d', { deletedAt: T0 }),
      item('e', { text: '  ', source: 'Only a source' }),
    ];
    expect(forMission(list)).toEqual([
      { id: 'b', text: 'Second', kind: 'idea', detail: 'Uncle', tags: [], favourite: true },
      { id: 'a', text: 'First', kind: 'saying', tags: ['time'], favourite: false },
    ]);
    expect(forMission([])).toEqual([]);
  });
});

describe('samples', () => {
  it('reads a valid guide example and refuses a malformed one', () => {
    expect(
      inspirationFromExample({
        text: 'Line',
        kind: 'saying',
        source: 'Uncle',
        tags: ['Time', 'work'],
        favourite: true,
      }),
    ).toEqual({
      text: 'Line',
      kind: 'saying',
      source: 'Uncle',
      tags: ['time', 'work'],
      favourite: true,
    });
    expect(inspirationFromExample({ text: 'Line', kind: 'thought' })).toEqual({
      text: 'Line',
      kind: 'thought',
      tags: [],
    });
    expect(inspirationFromExample({ text: 'Line', kind: 'quote' })).toBeNull();
    expect(inspirationFromExample({ text: ' ', kind: 'saying' })).toBeNull();
    expect(inspirationFromExample({ text: 'Line', kind: 'saying', tags: [1] })).toBeNull();
    expect(inspirationFromExample(null)).toBeNull();
  });

  it('finds the untouched sample of an example already tried', () => {
    const sample = item('s', { text: 'Line', kind: 'saying', sample: true });
    const fields = { text: 'Line', kind: 'saying' as const };
    expect(liveSampleOf([sample], fields)).toBe(sample);
    expect(liveSampleOf([{ ...sample, sample: undefined }], fields)).toBeUndefined();
    expect(liveSampleOf([{ ...sample, deletedAt: T0 }], fields)).toBeUndefined();
  });
});
