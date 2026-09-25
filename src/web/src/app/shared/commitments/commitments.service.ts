import { Injectable, Signal, computed, inject } from '@angular/core';
import { featureStore } from '../../core/data/feature-store';
import { isLive, newRecord } from '../../core/data/record';
import { CLOCK } from '../../core/time/clock';
import { localDateString } from '../exercise-kit/assessment-history.logic';
import {
  CommitmentEdit,
  editCommitment,
  removeCommitment,
  reopenCommitment,
  resolveCommitment,
  restoreCommitment,
} from './commitments.logic';
import {
  COMMITMENTS_MODEL_KEY,
  Commitment,
  CommitmentRecipient,
  CommitmentResolution,
  CommitmentSource,
} from './commitments.model';

/** What another tool supplies to make a promise (issue #57's shared contract). */
export interface NewCommitment {
  readonly text: string;
  readonly toWhom: CommitmentRecipient;
  readonly dueDate?: string;
  readonly personName?: string;
  readonly source?: CommitmentSource;
}

/**
 * The only writer of `shared.commitments` (issue #57): the Promises page and every Habit 1 tool go
 * through it, and nobody writes the array directly. Every write returns whether it applied (`false`
 * in a read-only tab, `FeatureStore.update()`). "Today" is the local date of `CLOCK`.
 */
@Injectable({ providedIn: 'root' })
export class CommitmentsService {
  private readonly clock = inject(CLOCK);
  private readonly store = featureStore<Commitment[]>(COMMITMENTS_MODEL_KEY);

  /** Every live promise, samples included, in stored order. */
  readonly all: Signal<readonly Commitment[]> = computed(() => this.store.value().filter(isLive));

  /** The live promise `id`, or `null` once it is deleted or if it never existed. */
  byId(id: string): Signal<Commitment | null> {
    return computed(() => this.all().find((c) => c.id === id) ?? null);
  }

  /** Makes an open promise; returns its id, or `null` if the store refused the write. */
  add(fields: NewCommitment): string | null {
    const record = newRecord<Omit<Commitment, 'id' | 'createdAt' | 'updatedAt'>>(
      {
        text: fields.text,
        toWhom: fields.toWhom,
        status: 'open',
        ...(fields.dueDate ? { dueDate: fields.dueDate } : {}),
        ...(fields.personName ? { personName: fields.personName } : {}),
        ...(fields.source ? { source: fields.source } : {}),
      },
      this.clock.now(),
    );
    return this.insert(record) ? record.id : null;
  }

  /** Stores a record built by the caller, id included: the Promises page's draft-before-record
   * (issue #217) and its guide samples (issue #232), which must keep the id already in the URL. */
  insert(record: Commitment): boolean {
    return this.store.update((list) => [...list, record]);
  }

  /** Edits `id`: text, due date and who it's to while open; the repair note while broken. */
  update(id: string, edit: CommitmentEdit): boolean {
    return this.store.update((list) => editCommitment(list, id, edit, this.clock.now()));
  }

  /** Resolves `id` today. */
  setStatus(
    id: string,
    status: CommitmentResolution,
    options: { readonly repairNote?: string } = {},
  ): boolean {
    const now = this.clock.now();
    return this.store.update((list) =>
      resolveCommitment(list, id, status, localDateString(now), now, options.repairNote),
    );
  }

  reopen(id: string): boolean {
    return this.store.update((list) => reopenCommitment(list, id, this.clock.now()));
  }

  /** Soft delete. */
  remove(id: string): boolean {
    return this.store.update((list) => removeCommitment(list, id, this.clock.now()));
  }

  /** Undoes `remove()` (the page's delete-with-undo snackbar). */
  restore(id: string): boolean {
    return this.store.update((list) => restoreCommitment(list, id, this.clock.now()));
  }
}
