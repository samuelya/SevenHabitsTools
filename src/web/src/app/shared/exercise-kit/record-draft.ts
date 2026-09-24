import { Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { DocumentStore } from '../../core/data/document.store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { BaseRecord } from '../../core/data/record';
import { EditorStatus } from './exercise-page/exercise-page';

/** The reserved `:itemId` segment of an unsaved draft (issue #217): `.../transition/new`. Never a
 * record id, since those are UUIDs. */
export const NEW_ITEM_ID = 'new';

export interface RecordDraftOptions<T extends BaseRecord> {
  /** The page's `:itemId` route param. */
  readonly itemId: Signal<string | null | undefined>;
  /** The page's live records: what a stored `:itemId` selects, and where a saved draft shows up. */
  readonly records: Signal<readonly T[]>;
  /** A fresh draft, id included, built with `newRecord()`; called by `start()`, and when `itemId`
   * is `NEW_ITEM_ID` with no unsaved draft open (a reload on `.../new`). */
  readonly create: () => T;
  /** The exercise's pure "first meaningful input" rule (`<slug>.logic.ts`): whether `draft` now
   * holds enough to become a record. `initial` is the draft as `create()` built it. */
  readonly isWorthSaving: (draft: T, initial: T) => boolean;
  /** Appends `record` to the store in one `store.update()`; returns whether it applied. */
  readonly save: (record: T) => boolean;
  /** Merges `fields` into the live record `id` in one `store.update()`; returns whether it
   * applied. Only ever called for an id in `records()`. */
  readonly update: (id: string, fields: Partial<T>) => boolean;
  /** Navigates to the page's `:itemId` `segment`, or to the list for `null`. */
  readonly navigate: (segment: string | null, options?: { replaceUrl?: boolean }) => void;
  readonly now: () => Date;
}

export interface RecordDraft<T extends BaseRecord> {
  /** What the editor shows: the live record `itemId` names, or on `NEW_ITEM_ID` the in-memory
   * draft until it is saved and its stored copy after; `null` otherwise. */
  readonly selected: Signal<T | null>;
  /** Whether `selected()` is the unsaved draft, still only in memory. A child that holds edits
   * back (`ReflectionEditor`'s debounce) must pass them on at once while this is `true`. */
  readonly unsaved: Signal<boolean>;
  /** The editor header's status: "New" for the unsaved draft, else "saved" (every store update is
   * synchronous — `exercise-layout.md`'s `editorStatus()`); `null` with no editor open. */
  readonly status: Signal<EditorStatus>;
  /** The Add/New button: a fresh draft at `NEW_ITEM_ID`, replacing any unsaved one. Opens nothing
   * in a tab that may not edit, which the user is told like any refused edit. */
  start(): void;
  /** Whether `id` is the open draft's and it has not been saved yet. */
  owns(id: string): boolean;
  /** Closes the unsaved draft without saving it (Delete on a draft). `replaceUrl`, so Back
   * doesn't reopen `NEW_ITEM_ID` on a fresh draft. */
  discard(): void;
  /** Applies `fields` to record `id`: the open unsaved draft's (saving it once `isWorthSaving`
   * holds, then moving the URL to its id), or a live record's through `update`. Any other id
   * writes nothing. Returns whether the edit reached the store; an edit kept in the unsaved draft
   * did not. */
  edit(id: string, fields: Partial<T>): boolean;
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
 * page's field initializer): it owns the page's `:itemId` effects — open a draft on `new`, drop
 * it on leaving `new`, and send an id that is not a live record back to the list.
 *
 * The draft lives only while the URL is `new`. That holds because a draft's edits are never held
 * back: every child passes them on at once while `unsaved()` is `true` (`ReflectionEditor`'s
 * `immediate`), so nothing is left to flush when the editor closes, the page is left or New is
 * pressed again (review R1, R2, R10 on #261).
 *
 * The draft carries its final id from the start, so saving it and then navigating from `new` to
 * that id keeps the page's editor form instance (the same id, so no re-focus or touched-state
 * reset).
 */
export function recordDraft<T extends BaseRecord>(options: RecordDraftOptions<T>): RecordDraft<T> {
  const store = inject(DocumentStore);
  const writerLock = inject(WRITER_LOCK);
  const state = signal<DraftState<T> | null>(null);
  const isNew = computed(() => options.itemId() === NEW_ITEM_ID);

  const open = (): void => {
    const draft = options.create();
    state.set({ initial: draft, value: draft, saved: false });
  };

  // `new`, on a reload, a history step or `start()`: open a draft unless `start()` already did,
  // once this tab may edit — the lock is still `pending` right after a reload — and leave for the
  // list in a read-only tab, whose banner already says why (`replaceUrl`, so Back isn't trapped).
  // Leaving `new` drops the draft; only that transition does, not `start()` from the list.
  let wasNew = false;
  effect(() => {
    const onNew = isNew();
    const role = writerLock.role();
    untracked(() => {
      if (!onNew) {
        if (wasNew) {
          state.set(null);
        }
      } else if (role === 'reader') {
        options.navigate(null, { replaceUrl: true });
      } else if (role === 'writer' && (state() === null || state()?.saved)) {
        open();
      }
    });
    wasNew = onNew;
  });

  // An `:itemId` that isn't a live record — a stale deep link, or one just deleted — goes back to
  // the list (issue #187). `id != null`, not `!== null`: `withComponentInputBinding()` sets a
  // missing param to `undefined`.
  effect(() => {
    const id = options.itemId();
    if (id != null && id !== NEW_ITEM_ID && !options.records().some((record) => record.id === id)) {
      untracked(() => options.navigate(null));
    }
  });

  const selected = computed<T | null>(() => {
    const id = options.itemId();
    if (id !== NEW_ITEM_ID) {
      return options.records().find((record) => record.id === id) ?? null;
    }
    const draft = state();
    if (draft === null || !store.isWriter()) {
      return null;
    }
    if (!draft.saved) {
      return draft.value;
    }
    return options.records().find((record) => record.id === draft.value.id) ?? null;
  });
  const unsaved = computed(() => selected() !== null && isNew() && state()?.saved === false);
  const status = computed<EditorStatus>(() => {
    if (selected() === null) {
      return null;
    }
    return unsaved() ? 'new' : 'saved';
  });

  const owns = (id: string): boolean => {
    const draft = untracked(state);
    return untracked(isNew) && draft !== null && !draft.saved && draft.value.id === id;
  };

  const editDraft = (draft: DraftState<T>, fields: Partial<T>): boolean => {
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
    // `replaceUrl`: a reload then opens the stored record, and Back still returns to the list.
    options.navigate(record.id, { replaceUrl: true });
    return true;
  };

  return {
    selected,
    unsaved,
    status,
    start(): void {
      if (!store.isWriter()) {
        store.reportRefusedEdit();
        return;
      }
      open();
      options.navigate(NEW_ITEM_ID);
    },
    owns,
    discard(): void {
      options.navigate(null, { replaceUrl: true });
    },
    edit(id: string, fields: Partial<T>): boolean {
      const draft = untracked(state);
      if (draft !== null && owns(id)) {
        return editDraft(draft, fields);
      }
      if (!untracked(options.records).some((record) => record.id === id)) {
        return false;
      }
      return options.update(id, fields);
    },
  };
}
