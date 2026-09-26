import { MissionInputItem } from '../../shared/mission-inputs/mission-inputs';
import {
  collectionKinds,
  collectionTags,
  filterCollection,
  ownLines,
  roleLineRows,
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
      { text: 'Presence', pressed: true },
      { text: 'Time', pressed: false },
    ]);
  });

  it('lists kept lines no suggestion offers as the user own, with their index', () => {
    const rows = suggestionRows([item('a', { text: 'Time' })], []);
    expect(ownLines(['time', 'loyalty', 'presence'], rows)).toEqual([
      { text: 'loyalty', index: 1 },
      { text: 'presence', index: 2 },
    ]);
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
