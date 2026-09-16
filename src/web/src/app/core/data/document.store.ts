import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { CLOCK } from '../time/clock';
import { getAtPath, setAtPath } from './document-path.utils';
import { RootDocument } from './document.model';
import { WRITER_LOCK } from './multi-tab/writer-lock';
import { BaseRecord, softDelete, touch } from './record';
import { createEmptyDocument } from './registry';

export type PathUpdater<T> = (current: T) => T;

function isBaseRecord(value: unknown): value is BaseRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { updatedAt?: unknown }).updatedAt === 'string'
  );
}

/** Names what `value` actually is, for an error naming a path expected to hold an array. */
function describeKind(value: unknown): string {
  if (value === undefined) {
    return 'nothing';
  }
  return Array.isArray(value) ? 'an array' : `a ${typeof value}`;
}

/** Stamps `next` if it is itself a record, or, when it is an array, stamps any element that looks
 * like a record and whose reference changed from the matching (by `id`) element in `current` —
 * covers calling `update()` on a whole collection instead of `upsertRecord()`. */
function stampChangedValue<T>(current: unknown, next: T, now: Date): T {
  if (isBaseRecord(next)) {
    return touch(next, now) as unknown as T;
  }
  if (Array.isArray(next)) {
    const before = Array.isArray(current) ? current : [];
    return next.map((item) => {
      if (!isBaseRecord(item)) {
        return item;
      }
      const original = before.find(
        (candidate) => isBaseRecord(candidate) && candidate.id === item.id,
      );
      return original === item ? item : touch(item, now);
    }) as unknown as T;
  }
  return next;
}

/** Finds the nearest ancestor of `path` that is a `BaseRecord` and returns `doc` with that
 * record's `updatedAt` refreshed — so editing a field *inside* a record (e.g.
 * `habits.h2.mission.statement`) still stamps the record, not just `meta`. */
function touchNearestRecordAncestor(
  doc: Record<string, unknown>,
  path: string,
  now: Date,
): Record<string, unknown> {
  const segments = path.split('.');
  for (let end = segments.length - 1; end > 0; end--) {
    const ancestorPath = segments.slice(0, end).join('.');
    const ancestor = getAtPath(doc, ancestorPath);
    if (isBaseRecord(ancestor)) {
      return setAtPath(doc, ancestorPath, touch(ancestor, now));
    }
  }
  return doc;
}

/**
 * The whole document, held as a signal. Every feature reads through `select()` (or the typed
 * `featureStore()` facade) and writes through `update()`, `upsertRecord()` and
 * `softDeleteRecord()`; nothing outside this class mutates `document` directly. Persistence
 * (`DocumentPersistence`), bootstrap loading and the corrupt-data error page
 * (`document-bootstrap.ts`) are separate services that read and replace the document through this
 * store instead of owning state of their own.
 *
 * Edits are refused while `WRITER_LOCK` says this tab is not the writer (another tab holds the
 * lock, or this tab's own lock request hasn't settled yet): an edit accepted in memory there could
 * never be saved and would be silently lost (#127). A refused edit leaves the document untouched,
 * returns `false`, and bumps `refusedEdits` so the UI can tell the user (`ReadOnlyEditNotifier`).
 * `replaceDocument()` is not an edit and is never refused: bootstrap, cross-tab reloads and
 * "Start fresh" all run before, or regardless of, this tab holding the lock.
 */
@Injectable({ providedIn: 'root' })
export class DocumentStore {
  private readonly clock = inject(CLOCK);
  private readonly writerLock = inject(WRITER_LOCK);
  private readonly documentSignal = signal<RootDocument>(createEmptyDocument());
  private readonly refusedEditsSignal = signal(0);

  readonly document: Signal<RootDocument> = this.documentSignal.asReadonly();
  /** How many edits have been refused because this tab isn't the writer. */
  readonly refusedEdits: Signal<number> = this.refusedEditsSignal.asReadonly();

  /** A read-only view of the value at `path` (e.g. `habits.h2.mission`). */
  select<T>(path: string): Signal<T | undefined> {
    return computed(() => getAtPath<T>(this.documentSignal(), path));
  }

  /** Replaces the whole document: bootstrap load, JSON import or a sync merge. */
  replaceDocument(doc: RootDocument): void {
    this.documentSignal.set(doc);
  }

  /**
   * Applies `updater` to the value at `path`. If the result (or, for a collection, one of its
   * elements) looks like a `BaseRecord`, its `updatedAt` is stamped; so is the nearest ancestor
   * record on `path`, if any (e.g. updating `habits.h2.mission.statement` stamps `mission`).
   * `meta.updatedAt` is always stamped. Returns `false`, without applying anything, while this tab
   * isn't the writer. When `updater` returns the value it was given (`Object.is`), the document,
   * `meta.updatedAt` and `dirty` are left untouched and nothing is scheduled to save — a no-op
   * update should not look like an edit to a future sync merge.
   */
  update<T>(path: string, updater: PathUpdater<T>): boolean {
    return this.mutate((doc, now) => {
      const current = getAtPath<T>(doc, path);
      const next = updater(current as T);
      if (Object.is(current, next)) {
        return doc;
      }
      const stamped = stampChangedValue(current, next, now);
      const withValue = setAtPath(doc, path, stamped);
      return touchNearestRecordAncestor(withValue, path, now);
    });
  }

  /**
   * Inserts `record` into the collection at `path`, or updates the existing record with the same
   * `id`. The stored `createdAt` always wins over a caller-supplied one (`createdAt` is immutable,
   * architecture §6). Upserting an id that is currently tombstoned throws instead of silently
   * reviving it: this store has no supported way to undelete a record, so a caller that hits this
   * has a bug to fix, not a record to restore. Throws a descriptive error, naming `path`, when
   * `path` holds something other than an array or nothing.
   */
  upsertRecord<T extends BaseRecord>(path: string, record: T): boolean {
    return this.mutate((doc, now) => {
      const listValue = getAtPath<unknown>(doc, path);
      if (listValue !== undefined && !Array.isArray(listValue)) {
        throw new Error(
          `Cannot upsert into "${path}": it holds ${describeKind(listValue)}, not an array`,
        );
      }
      const list = (listValue as readonly T[] | undefined) ?? [];
      const existing = list.find((item) => item.id === record.id);
      if (existing?.deletedAt !== undefined) {
        throw new Error(`Cannot upsert record "${record.id}" at "${path}": it is tombstoned`);
      }
      const stamped = touch({ ...record, createdAt: existing?.createdAt ?? record.createdAt }, now);
      const nextList = existing
        ? list.map((item) => (item.id === record.id ? stamped : item))
        : [...list, stamped];
      const withList = setAtPath(doc, path, nextList);
      return touchNearestRecordAncestor(withList, path, now);
    });
  }

  /**
   * Tombstones the record with `id` in the collection at `path`; it is never removed from the
   * array. A no-op — the document, including `meta.updatedAt`, is left untouched — when the record
   * is already tombstoned or is not present in the collection, so deleting the same record twice
   * (e.g. from two devices) never moves the tombstone time forward. Throws a descriptive error,
   * naming `path`, when `path` does not hold an array at all, instead of silently creating one.
   */
  softDeleteRecord(path: string, id: string): boolean {
    return this.mutate((doc, now) => {
      const listValue = getAtPath<unknown>(doc, path);
      if (!Array.isArray(listValue)) {
        throw new Error(
          `Cannot soft-delete from "${path}": it holds ${describeKind(listValue)}, not an array`,
        );
      }
      const list = listValue as readonly BaseRecord[];
      const target = list.find((item) => item.id === id);
      if (target === undefined || target.deletedAt !== undefined) {
        return doc;
      }
      const nextList = list.map((item) => (item.id === id ? softDelete(item, now) : item));
      const withList = setAtPath(doc, path, nextList);
      return touchNearestRecordAncestor(withList, path, now);
    });
  }

  private mutate(
    apply: (doc: Record<string, unknown>, now: Date) => Record<string, unknown>,
  ): boolean {
    if (!this.writerLock.isWriter()) {
      this.refusedEditsSignal.update((count) => count + 1);
      return false;
    }
    const now = this.clock.now();
    this.documentSignal.update((doc) => {
      const current = doc as unknown as Record<string, unknown>;
      const updated = apply(current, now);
      if (updated === current) {
        return doc;
      }
      const meta = {
        ...(updated['meta'] as Record<string, unknown>),
        updatedAt: now.toISOString(),
      };
      return { ...updated, meta } as unknown as RootDocument;
    });
    return true;
  }
}
