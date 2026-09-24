import { WritableSignal, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DocumentStore } from '../../core/data/document.store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { WriterRole } from '../../core/data/multi-tab/writer-role-state';
import { BaseRecord, newRecord } from '../../core/data/record';
import { NEW_ITEM_ID, RecordDraft, recordDraft } from './record-draft';

interface Note extends BaseRecord {
  readonly text: string;
  readonly tag: string;
}

const CREATED = new Date('2026-01-01T00:00:00.000Z');
const SAVED = new Date('2026-01-02T00:00:00.000Z');

interface Harness {
  itemId: WritableSignal<string | null | undefined>;
  records: WritableSignal<readonly Note[]>;
  role: WritableSignal<WriterRole>;
  draft: RecordDraft<Note>;
  creates: () => number;
  navigations: (string | null)[];
  updates: string[];
}

/** `navigate` stands in for the router: it sets `itemId` synchronously, as the input binding would
 * once the navigation lands. */
function setUp(options: { saveApplies?: boolean; role?: WriterRole } = {}): Harness {
  const role = signal<WriterRole>(options.role ?? 'writer');
  TestBed.configureTestingModule({
    providers: [
      {
        provide: WRITER_LOCK,
        useValue: { role, isWriter: computed(() => role() === 'writer') },
      },
    ],
  });
  const itemId = signal<string | null | undefined>(null);
  const records = signal<readonly Note[]>([]);
  const navigations: (string | null)[] = [];
  const updates: string[] = [];
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
      update: (id, fields) => {
        updates.push(id);
        records.update((current) =>
          current.map((note) => (note.id === id ? { ...note, ...fields } : note)),
        );
        return true;
      },
      navigate: (segment) => {
        navigations.push(segment);
        itemId.set(segment ?? undefined);
      },
      now: () => SAVED,
    }),
  );
  TestBed.tick();
  return { itemId, records, role, draft, creates: () => createCount, navigations, updates };
}

/** `start()` plus the effects the navigation triggers. */
function start(harness: Harness): string {
  harness.draft.start();
  TestBed.tick();
  return harness.draft.selected()!.id;
}

describe('recordDraft (issue #217)', () => {
  it('has no draft and selects the live record `itemId` names', () => {
    const harness = setUp();
    expect(harness.draft.selected()).toBeNull();
    expect(harness.draft.status()).toBeNull();

    const stored = newRecord({ text: 'kept', tag: 'a' }, CREATED);
    harness.records.set([stored]);
    harness.itemId.set(stored.id);
    expect(harness.draft.selected()).toBe(stored);
    expect(harness.draft.status()).toBe('saved');
    expect(harness.creates()).toBe(0);
  });

  it('start() opens a fresh in-memory draft at `new`, without saving it', () => {
    const harness = setUp();
    start(harness);

    expect(harness.navigations).toEqual([NEW_ITEM_ID]);
    expect(harness.draft.selected()?.text).toBe('');
    expect(harness.draft.unsaved()).toBe(true);
    expect(harness.draft.status()).toBe('new');
    expect(harness.records()).toHaveLength(0);
  });

  it('keeps edits in memory until the draft is worth saving', () => {
    const harness = setUp();
    const id = start(harness);

    expect(harness.draft.edit(id, { tag: 'b' })).toBe(true);
    expect(harness.draft.edit(id, { text: '  ' })).toBe(true);
    expect(harness.records()).toHaveLength(0);
    expect(harness.draft.selected()).toMatchObject({ tag: 'b', text: '  ' });
  });

  it('saves once, with the draft id, every edit so far and fresh timestamps, then shows its id', () => {
    const harness = setUp();
    const id = start(harness);
    harness.draft.edit(id, { tag: 'b' });

    expect(harness.draft.owns(id)).toBe(true);
    expect(harness.draft.edit(id, { text: 'hello' })).toBe(true);

    expect(harness.records()).toEqual([
      {
        id,
        text: 'hello',
        tag: 'b',
        createdAt: SAVED.toISOString(),
        updatedAt: SAVED.toISOString(),
      },
    ]);
    expect(harness.navigations).toEqual([NEW_ITEM_ID, id]);
    expect(harness.draft.owns(id)).toBe(false);
    expect(harness.draft.status()).toBe('saved');
    // Later edits go to the live record through `update`.
    harness.draft.edit(id, { text: 'again' });
    expect(harness.updates).toEqual([id]);
    expect(harness.records()[0].text).toBe('again');
  });

  it('an edit flushed after leaving `new` still saves the draft, without navigating back', () => {
    const harness = setUp();
    const id = start(harness);
    harness.itemId.set(undefined);
    TestBed.tick();

    expect(harness.draft.edit(id, { text: 'typed just before closing' })).toBe(true);

    expect(harness.records().map((note) => note.text)).toEqual(['typed just before closing']);
    expect(harness.navigations).toEqual([NEW_ITEM_ID]);
    expect(harness.draft.selected()).toBeNull();
  });

  it('never writes for an id that is neither the draft nor a live record', () => {
    const harness = setUp();
    const id = start(harness);
    start(harness);

    expect(harness.draft.edit(id, { text: 'from the replaced draft' })).toBe(false);
    expect(harness.draft.edit('missing', { text: 'x' })).toBe(false);
    expect(harness.updates).toEqual([]);
    expect(harness.records()).toHaveLength(0);
  });

  it('start() on an open draft replaces it with a fresh one', () => {
    const harness = setUp();
    const first = start(harness);
    harness.draft.edit(first, { tag: 'b' });

    const second = start(harness);

    expect(second).not.toBe(first);
    expect(harness.draft.selected()?.tag).toBe('a');
    expect(harness.creates()).toBe(2);
  });

  it('stays an unsaved draft when the store refuses the save', () => {
    const harness = setUp({ saveApplies: false });
    const id = start(harness);

    expect(harness.draft.edit(id, { text: 'hello' })).toBe(false);
    expect(harness.records()).toHaveLength(0);
    expect(harness.draft.unsaved()).toBe(true);
    expect(harness.draft.selected()?.text).toBe('hello');
  });

  it('opens a draft for a reload on `new`, and a fresh one after the last was saved', () => {
    const harness = setUp();
    harness.itemId.set(NEW_ITEM_ID);
    TestBed.tick();
    const id = harness.draft.selected()!.id;
    harness.draft.edit(id, { text: 'saved' });
    TestBed.tick();

    harness.itemId.set(NEW_ITEM_ID);
    TestBed.tick();
    expect(harness.creates()).toBe(2);
    expect(harness.draft.unsaved()).toBe(true);
  });

  it('in a read-only tab, start() opens nothing and counts a refused edit', () => {
    const harness = setUp({ role: 'reader' });
    harness.draft.start();
    TestBed.tick();

    expect(harness.navigations).toEqual([]);
    expect(harness.creates()).toBe(0);
    expect(TestBed.inject(DocumentStore).refusedEdits()).toBe(1);
  });

  it('a reload on `new` waits for the lock, and leaves for the list in a read-only tab', () => {
    const harness = setUp({ role: 'pending' });
    harness.itemId.set(NEW_ITEM_ID);
    TestBed.tick();
    expect(harness.draft.selected()).toBeNull();
    expect(harness.creates()).toBe(0);

    harness.role.set('reader');
    TestBed.tick();
    expect(harness.navigations).toEqual([null]);
  });
});
