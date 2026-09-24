import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BaseRecord, newRecord } from '../../core/data/record';
import { NEW_ITEM_ID, RecordDraft, recordDraft } from './record-draft';

interface Note extends BaseRecord {
  readonly text: string;
  readonly tag: string;
}

const CREATED = new Date('2026-01-01T00:00:00.000Z');
const SAVED = new Date('2026-01-02T00:00:00.000Z');

function setUp(options: { saveApplies?: boolean } = {}): {
  itemId: WritableSignal<string | null | undefined>;
  records: WritableSignal<readonly Note[]>;
  draft: RecordDraft<Note>;
  creates: () => number;
} {
  const itemId = signal<string | null | undefined>(null);
  const records = signal<readonly Note[]>([]);
  let createCount = 0;
  const draft = TestBed.runInInjectionContext(() =>
    recordDraft<Note>({
      itemId,
      records,
      create: () => {
        createCount++;
        return newRecord({ text: '', tag: 'a' }, CREATED);
      },
      isWorthSaving: (note) => note.text.trim() !== '',
      save: (record) => {
        if (options.saveApplies === false) {
          return false;
        }
        records.update((current) => [...current, record]);
        return true;
      },
      now: () => SAVED,
    }),
  );
  TestBed.tick();
  return { itemId, records, draft, creates: () => createCount };
}

describe('recordDraft (issue #217)', () => {
  it('has no draft while itemId is not `new`', () => {
    const { draft, creates } = setUp();
    expect(draft.current()).toBeNull();
    expect(draft.unsaved()).toBe(false);
    expect(creates()).toBe(0);
  });

  it('opens a fresh in-memory draft when itemId becomes `new`, without saving it', () => {
    const { itemId, records, draft } = setUp();
    itemId.set(NEW_ITEM_ID);
    TestBed.tick();

    expect(draft.current()?.text).toBe('');
    expect(draft.unsaved()).toBe(true);
    expect(records()).toHaveLength(0);
  });

  it('keeps edits in memory until the draft is worth saving', () => {
    const { itemId, records, draft } = setUp();
    itemId.set(NEW_ITEM_ID);
    TestBed.tick();

    expect(draft.edit({ tag: 'b' })).toBe(false);
    expect(draft.edit({ text: '  ' })).toBe(false);
    expect(records()).toHaveLength(0);
    expect(draft.current()).toMatchObject({ tag: 'b', text: '  ' });
  });

  it('saves once, with the draft id, every edit so far and fresh timestamps', () => {
    const { itemId, records, draft } = setUp();
    itemId.set(NEW_ITEM_ID);
    TestBed.tick();
    const id = draft.current()!.id;
    draft.edit({ tag: 'b' });

    expect(draft.owns(id)).toBe(true);
    expect(draft.edit({ text: 'hello' })).toBe(true);

    expect(records()).toEqual([
      {
        id,
        text: 'hello',
        tag: 'b',
        createdAt: SAVED.toISOString(),
        updatedAt: SAVED.toISOString(),
      },
    ]);
    expect(draft.unsaved()).toBe(false);
    expect(draft.owns(id)).toBe(false);
    // Later edits are the page's own store updates, not the draft's.
    expect(draft.edit({ text: 'again' })).toBe(false);
    expect(records()).toHaveLength(1);
  });

  it('shows the stored copy once saved', () => {
    const { itemId, records, draft } = setUp();
    itemId.set(NEW_ITEM_ID);
    TestBed.tick();
    draft.edit({ text: 'hello' });
    records.update((current) => current.map((note) => ({ ...note, text: 'edited' })));

    expect(draft.current()?.text).toBe('edited');
  });

  it('stays an unsaved draft when the store refuses the save (e.g. a read-only tab)', () => {
    const { itemId, records, draft } = setUp({ saveApplies: false });
    itemId.set(NEW_ITEM_ID);
    TestBed.tick();

    expect(draft.edit({ text: 'hello' })).toBe(false);
    expect(records()).toHaveLength(0);
    expect(draft.unsaved()).toBe(true);
    expect(draft.current()?.text).toBe('hello');
  });

  it('drops the draft when itemId leaves `new`, and the next `new` starts fresh', () => {
    const { itemId, draft, creates } = setUp();
    itemId.set(NEW_ITEM_ID);
    TestBed.tick();
    const firstId = draft.current()!.id;
    draft.edit({ tag: 'b' });

    itemId.set(undefined);
    TestBed.tick();
    expect(draft.current()).toBeNull();
    expect(draft.owns(firstId)).toBe(false);

    itemId.set(NEW_ITEM_ID);
    TestBed.tick();
    expect(creates()).toBe(2);
    expect(draft.current()?.id).not.toBe(firstId);
    expect(draft.current()?.tag).toBe('a');
  });
});
