import { Signal, computed, effect, signal, untracked } from '@angular/core';
import { BaseRecord } from '../../core/data/record';

/** The reserved `:itemId` segment of an unsaved draft (issue #217): `.../transition/new`. Never a
 * record id, since those are UUIDs. */
export const NEW_ITEM_ID = 'new';

export interface RecordDraftOptions<T extends BaseRecord> {
  /** The page's `:itemId` route param. */
  readonly itemId: Signal<string | null | undefined>;
  /** The page's live records, where a saved draft shows up. */
  readonly records: Signal<readonly T[]>;
  /** A fresh draft, id included, built with `newRecord()`; called each time `itemId` becomes
   * `NEW_ITEM_ID` with no draft open (the Add button, or a reload on `.../new`). */
  readonly create: () => T;
  /** The exercise's pure "first meaningful input" rule (`<slug>.logic.ts`): whether `draft` now
   * holds enough to become a record. `initial` is the draft as `create()` built it. */
  readonly isWorthSaving: (draft: T, initial: T) => boolean;
  /** Appends `record` to the store in one `store.update()`; returns whether it applied. */
  readonly save: (record: T) => boolean;
  readonly now: () => Date;
}

export interface RecordDraft<T extends BaseRecord> {
  /** What the editor shows while `itemId` is `NEW_ITEM_ID`: the in-memory draft until it is
   * saved, its stored copy after; `null` for any other `itemId`. */
  readonly current: Signal<T | null>;
  /** Whether `current()` is still only in memory: the editor status reads "New", not "Saved". */
  readonly unsaved: Signal<boolean>;
  /** Whether `id` is the open draft's and it has not been saved yet. */
  owns(id: string): boolean;
  /** Merges `fields` into the unsaved draft and saves it once `isWorthSaving` holds. Returns
   * `true` exactly when this call saved it, so the page can move the URL to the real id. */
  edit(fields: Partial<T>): boolean;
}

interface DraftState<T> {
  readonly initial: T;
  readonly value: T;
  readonly saved: boolean;
}

/**
 * Draft before record (issue #217): an Add/New editor opens on an in-memory draft that reaches the
 * store — and so `DocumentPersistence` and IndexedDB — only on the first meaningful input. Backing
 * out of an untouched draft leaves nothing behind. Must be called from an injection context (a
 * page's field initializer), since it owns one effect: open a draft whenever `itemId` becomes
 * `NEW_ITEM_ID`, drop it whenever `itemId` moves away. That effect is also what reopens an empty
 * draft on a reload of `.../new`.
 *
 * The draft carries its final id from the start, so saving it and then navigating from `new` to
 * that id keeps the page's editor form instance (the same id, so no re-focus or touched-state
 * reset).
 */
export function recordDraft<T extends BaseRecord>(options: RecordDraftOptions<T>): RecordDraft<T> {
  const state = signal<DraftState<T> | null>(null);
  const isNew = computed(() => options.itemId() === NEW_ITEM_ID);

  effect(() => {
    const open = isNew();
    untracked(() => {
      if (open && state() === null) {
        const draft = options.create();
        state.set({ initial: draft, value: draft, saved: false });
      } else if (!open && state() !== null) {
        state.set(null);
      }
    });
  });

  const current = computed<T | null>(() => {
    const draft = state();
    if (!isNew() || draft === null) {
      return null;
    }
    if (!draft.saved) {
      return draft.value;
    }
    return options.records().find((record) => record.id === draft.value.id) ?? null;
  });
  const unsaved = computed(() => isNew() && state()?.saved === false);

  return {
    current,
    unsaved,
    owns(id: string): boolean {
      const draft = state();
      return draft !== null && !draft.saved && draft.value.id === id;
    },
    edit(fields: Partial<T>): boolean {
      const draft = state();
      if (draft === null || draft.saved) {
        return false;
      }
      const next: T = { ...draft.value, ...fields };
      if (!options.isWorthSaving(next, draft.initial)) {
        state.set({ ...draft, value: next });
        return false;
      }
      const timestamp = options.now().toISOString();
      const record: T = { ...next, createdAt: timestamp, updatedAt: timestamp };
      if (!options.save(record)) {
        state.set({ ...draft, value: next });
        return false;
      }
      state.set({ ...draft, value: record, saved: true });
      return true;
    },
  };
}
