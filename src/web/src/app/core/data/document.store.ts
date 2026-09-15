import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { CLOCK } from '../time/clock';
import { getAtPath, setAtPath } from './document-path.utils';
import { RootDocument } from './document.model';
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
 */
@Injectable({ providedIn: 'root' })
export class DocumentStore {
  private readonly clock = inject(CLOCK);
  private readonly documentSignal = signal<RootDocument>(createEmptyDocument());

  readonly document: Signal<RootDocument> = this.documentSignal.asReadonly();

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
   * `meta.updatedAt` is always stamped.
   */
  update<T>(path: string, updater: PathUpdater<T>): void {
    this.mutate((doc, now) => {
      const current = getAtPath<T>(doc, path);
      const next = updater(current as T);
      const stamped = stampChangedValue(current, next, now);
      const withValue = setAtPath(doc, path, stamped);
      return touchNearestRecordAncestor(withValue, path, now);
    });
  }

  /** Inserts `record` into the collection at `path`, or replaces the existing record with the same `id`. */
  upsertRecord<T extends BaseRecord>(path: string, record: T): void {
    this.mutate((doc, now) => {
      const list = getAtPath<readonly T[]>(doc, path) ?? [];
      const stamped = touch(record, now);
      const index = list.findIndex((item) => item.id === stamped.id);
      const nextList =
        index === -1 ? [...list, stamped] : list.map((item, i) => (i === index ? stamped : item));
      const withList = setAtPath(doc, path, nextList);
      return touchNearestRecordAncestor(withList, path, now);
    });
  }

  /** Tombstones the record with `id` in the collection at `path`; it is never removed from the array. */
  softDeleteRecord(path: string, id: string): void {
    this.mutate((doc, now) => {
      const list = getAtPath<readonly BaseRecord[]>(doc, path) ?? [];
      const nextList = list.map((item) => (item.id === id ? softDelete(item, now) : item));
      const withList = setAtPath(doc, path, nextList);
      return touchNearestRecordAncestor(withList, path, now);
    });
  }

  private mutate(
    apply: (doc: Record<string, unknown>, now: Date) => Record<string, unknown>,
  ): void {
    const now = this.clock.now();
    this.documentSignal.update((doc) => {
      const updated = apply(doc as unknown as Record<string, unknown>, now);
      const meta = {
        ...(updated['meta'] as Record<string, unknown>),
        updatedAt: now.toISOString(),
      };
      return { ...updated, meta } as unknown as RootDocument;
    });
  }
}
