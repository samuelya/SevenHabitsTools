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
   * Applies `updater` to the value at `path`. If the result looks like a `BaseRecord` its
   * `updatedAt` is stamped; `meta.updatedAt` is always stamped.
   */
  update<T>(path: string, updater: PathUpdater<T>): void {
    this.mutate((doc, now) => {
      const current = getAtPath<T>(doc, path);
      const next = updater(current as T);
      const stamped = isBaseRecord(next) ? touch(next, now) : next;
      return setAtPath(doc, path, stamped);
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
      return setAtPath(doc, path, nextList);
    });
  }

  /** Tombstones the record with `id` in the collection at `path`; it is never removed from the array. */
  softDeleteRecord(path: string, id: string): void {
    this.mutate((doc, now) => {
      const list = getAtPath<readonly BaseRecord[]>(doc, path) ?? [];
      const nextList = list.map((item) => (item.id === id ? softDelete(item, now) : item));
      return setAtPath(doc, path, nextList);
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
