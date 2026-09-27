import { MissionInputItem } from '../../shared/mission-inputs/mission-inputs';
import {
  collectionKinds,
  collectionTags,
  filterCollection,
  ownLines,
  principleLineLabel,
  roleLineRows,
  suggestionGroups,
  suggestionRows,
} from './mission.logic';

const item = (id: string, fields: Partial<MissionInputItem> = {}): MissionInputItem => ({
  id,
  text: `Line ${id}`,
  ...fields,
});

describe('suggestions', () => {
  it('offers one chip per distinct text, pressed while kept', () => {
    const items = [
      item('a', { text: ' Presence ' }),
      item('b', { text: 'presence' }),
      item('c', { text: 'Time' }),
      item('d', { text: '  ' }),
    ];
    expect(suggestionRows(items, ['PRESENCE'])).toEqual([
      { value: 'Presence', text: 'Presence', pressed: true },
      { value: 'Time', text: 'Time', pressed: false },
    ]);
  });

  it('keeps a keyed suggestion by its key, whatever language its label is in (#299)', () => {
    const items = [item('k', { text: 'النزاهة', key: 'integrity' })];
    expect(suggestionRows(items, ['integrity'])).toEqual([
      { value: 'integrity', text: 'النزاهة', pressed: true },
    ]);
    expect(ownLines(['integrity', 'keeping my word'], suggestionRows(items, []))).toEqual([
      { text: 'keeping my word', index: 1 },
    ]);
  });

  it('groups suggestions by source, without repeating a text or keeping an empty group', () => {
    const groups = suggestionGroups(
      [
        { sourceExerciseId: 'h2-long-view', items: [item('a', { text: 'Time' })] },
        { sourceExerciseId: 'h2-other', items: [item('b', { text: 'time' })] },
        {
          sourceExerciseId: 'h2-third',
          items: [item('c', { text: 'Calm' }), item('d', { text: 'TIME' })],
        },
      ],
      ['calm'],
    );
    expect(groups).toEqual([
      { sourceExerciseId: 'h2-long-view', rows: [{ value: 'Time', text: 'Time', pressed: false }] },
      { sourceExerciseId: 'h2-third', rows: [{ value: 'Calm', text: 'Calm', pressed: true }] },
    ]);
  });

  it('lists kept lines no suggestion offers as the user own, with their index', () => {
    const rows = suggestionRows([item('a', { text: 'Time' })], []);
    expect(ownLines(['time', 'loyalty', 'presence'], rows)).toEqual([
      { text: 'loyalty', index: 1 },
      { text: 'presence', index: 2 },
    ]);
  });

  it('labels an own line through labelOf', () => {
    const labels = { courage: 'الشجاعة', honesty: '' };
    const label = (line: string) => principleLineLabel(line, labels);
    expect(ownLines(['courage', 'showing up', 'honesty'], [], label)).toEqual([
      { text: 'الشجاعة', index: 0 },
      { text: 'showing up', index: 1 },
      { text: 'honesty', index: 2 },
    ]);
    expect(principleLineLabel('constructor', labels)).toBe('constructor');
  });
});

describe('roleLineRows', () => {
  const active = [
    { id: 'r1', label: 'Parent' },
    { id: 'r2', label: 'Friend' },
  ];

  it('gives each active role its line, then written lines of roles no longer active', () => {
    const lines = [
      { roleId: 'r2', text: 'calls first' },
      { roleId: 'gone', text: 'kept my word' },
      { roleId: 'archived', text: 'showed up' },
      { roleId: 'blank', text: '  ' },
    ];
    const labelOf = (id: string) => (id === 'archived' ? 'Coach' : null);
    expect(roleLineRows(active, lines, labelOf)).toEqual([
      { roleId: 'r1', label: 'Parent', text: '' },
      { roleId: 'r2', label: 'Friend', text: 'calls first' },
      { roleId: 'gone', label: null, text: 'kept my word' },
      { roleId: 'archived', label: 'Coach', text: 'showed up' },
    ]);
  });

  it('keeps a shown row in place once its role is archived and its line cleared', () => {
    const labelOf = (id: string) => (id === 'r1' ? 'Parent' : null);
    // r1 was archived and its line cleared while on screen; r3 is new.
    const rows = roleLineRows([...active.slice(1), { id: 'r3', label: 'Coach' }], [], labelOf, [
      'r1',
      'r2',
    ]);
    expect(rows).toEqual([
      { roleId: 'r1', label: 'Parent', text: '' },
      { roleId: 'r2', label: 'Friend', text: '' },
      { roleId: 'r3', label: 'Coach', text: '' },
    ]);
  });

  it('labels a shown row whose role was deleted as deleted, and lets it be retyped', () => {
    const rows = roleLineRows([], [{ roleId: 'gone', text: 'again' }], () => null, ['gone']);
    expect(rows).toEqual([{ roleId: 'gone', label: null, text: 'again' }]);
  });

  it('is empty with no roles and no lines', () => {
    expect(roleLineRows([], [], () => null)).toEqual([]);
  });
});

describe('collection filter', () => {
  const items = [
    item('a', { kind: 'idea', tags: ['Work', ' time '] }),
    item('b', { kind: 'saying', tags: ['family'] }),
    item('c', { kind: 'idea' }),
    item('d', { kind: 'unknown', tags: ['work'] }),
  ];

  it('lists the known kinds present, in order, and the distinct normalised tags', () => {
    expect(collectionKinds(items)).toEqual(['saying', 'idea']);
    expect(collectionKinds([])).toEqual([]);
    expect(collectionTags(items)).toEqual(['family', 'time', 'work']);
  });

  it('filters by kind and tag, null meaning all', () => {
    const ids = (list: readonly MissionInputItem[]) => list.map((entry) => entry.id);
    expect(ids(filterCollection(items, { kind: null, tag: null }))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(filterCollection(items, { kind: 'idea', tag: null }))).toEqual(['a', 'c']);
    expect(ids(filterCollection(items, { kind: null, tag: 'work' }))).toEqual(['a', 'd']);
    expect(ids(filterCollection(items, { kind: 'idea', tag: 'time' }))).toEqual(['a']);
  });
});
