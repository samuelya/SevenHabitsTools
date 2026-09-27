import { Injectable, Signal, computed, inject } from '@angular/core';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { CLOCK } from '../../core/time/clock';
import { RoleGoalsService } from './role-goals.service';
import {
  RoleDirection,
  RoleEdit,
  activeRoles,
  builtInRole,
  editRole,
  insertRole,
  removeRole,
  reorder,
  restoreRole,
  setArchived,
  sortedRoles,
  withBuiltIn,
} from './roles.logic';
import { ROLES_MODEL_KEY, Role, RoleColor } from './roles.model';

/** What another tool supplies to add a role (issue #59's shared contract). */
export interface NewRole {
  readonly name: string;
  readonly description?: string;
  readonly color?: RoleColor;
}

/**
 * The only writer of `shared.roles` (issue #59): the Roles page, the mission (#61), the weekly
 * planner (#71) and renewal (#92/#93) all go through it. Every write returns whether it applied
 * (`false` in a read-only tab, `FeatureStore.update()`); refused edits (renaming, archiving or
 * deleting the built-in) leave the list unchanged. Deleting a role takes its goals with it, and undo
 * brings them back (issue #291).
 */
@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly clock = inject(CLOCK);
  private readonly store = featureStore<readonly Role[]>(ROLES_MODEL_KEY);
  private readonly goals = inject(RoleGoalsService);

  /** Every live role, archived and samples included, by `order`. */
  readonly all: Signal<readonly Role[]> = computed(() => sortedRoles(this.store.value()));

  /** Live roles that aren't archived, by `order`. */
  readonly active: Signal<readonly Role[]> = computed(() => activeRoles(this.store.value()));

  /** Every live role by id, archived included: one map shared by every `byId()` read. */
  private readonly liveById: Signal<ReadonlyMap<string, Role>> = computed(
    () => new Map(this.all().map((role) => [role.id, role])),
  );

  /** The live role `id`, archived included; `null` once deleted or if it never existed. A signal
   * read: inside a `computed` or template it tracks the roles, without a signal per call (#71 reads
   * it per row). */
  byId(id: string): Role | null {
    return this.liveById().get(id) ?? null;
  }

  /** Creates the built-in Sharpen the Saw role if none is live; returns its id, or `null` if the
   * store refused the write. Idempotent: with one already live it returns that id without writing,
   * so a read-only tab gets it too. */
  ensureBuiltIn(): string | null {
    const existing = builtInRole(this.store.value());
    if (existing) {
      return existing.id;
    }
    let id: string | null = null;
    const applied = this.store.update((list) => {
      const result = withBuiltIn(list, this.clock.now());
      id = result.id;
      return result.list;
    });
    return applied ? id : null;
  }

  /** Adds a role after every other one (and the built-in first, if missing); returns its id, or
   * `null` if the store refused the write. */
  add(fields: NewRole): string | null {
    const record = newRecord<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>(
      {
        name: fields.name,
        order: 0,
        ...(fields.description ? { description: fields.description } : {}),
        ...(fields.color ? { color: fields.color } : {}),
      },
      this.clock.now(),
    );
    return this.insert(record) ? record.id : null;
  }

  /** Stores a record built by the caller, id included: the page's draft-before-record (issue #217)
   * and guide samples (issue #232). Its `order` is replaced by "last"; a non-sample brings the
   * built-in with it. */
  insert(record: Role): boolean {
    return this.store.update((list) => insertRole(list, record, this.clock.now()));
  }

  /** Edits `id`; a rename of the built-in is ignored. */
  update(id: string, edit: RoleEdit): boolean {
    return this.store.update((list) => editRole(list, id, edit, this.clock.now()));
  }

  /** Swaps `id` with its neighbour in its group (active or archived). */
  move(id: string, direction: RoleDirection): boolean {
    return this.store.update((list) => reorder(list, id, direction, this.clock.now()));
  }

  archive(id: string): boolean {
    return this.store.update((list) => setArchived(list, id, true, this.clock.now()));
  }

  unarchive(id: string): boolean {
    return this.store.update((list) => setArchived(list, id, false, this.clock.now()));
  }

  /** Soft delete, with the role's goals at the same time (issue #291). Returns whether the role was
   * deleted: `false` for the built-in, an unknown id or a read-only tab, and then no goal is
   * touched. */
  remove(id: string): boolean {
    const now = this.clock.now();
    if (!this.applyChange((list) => removeRole(list, id, now))) {
      return false;
    }
    this.goals.removeForRole(id, now);
    return true;
  }

  /** Undoes `remove()` (the page's delete-with-undo snackbar), the goals deleted with it included.
   * Returns whether the role came back. */
  restore(id: string): boolean {
    if (!this.applyChange((list) => restoreRole(list, id, this.clock.now()))) {
      return false;
    }
    this.goals.restoreForRole(id);
    return true;
  }

  /** Writes `change` and reports whether it changed the list: `false` when it returned the list
   * itself (refused) or the store refused the write. */
  private applyChange(change: (list: readonly Role[]) => readonly Role[]): boolean {
    const current = this.store.value();
    const next = change(current);
    return next !== current && this.store.update(() => next);
  }
}
