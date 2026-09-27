import { Injectable, Signal, computed, inject } from '@angular/core';
import { featureStore } from '../../core/data/feature-store';
import { CLOCK } from '../../core/time/clock';
import { localDateString } from '../exercise-kit/assessment-history.logic';
import {
  AddOutcome,
  MissionListKey,
  checklistWith,
  currentStatement,
  editMission,
  maxFor,
  roleLinesWith,
  withLine,
  withRestoredVersion,
  withReviewInterval,
  withReviewed,
  withVersion,
  withoutLine,
} from './mission.logic';
import {
  MISSION_MODEL_KEY,
  Mission,
  MissionFields,
  ReviewInterval,
  ReviewKey,
} from './mission.model';

/**
 * The only writer of `habits.h2.mission` (issue #61): the Mission page, with its version history and
 * review (#62); #71 and #97 only read `currentStatement`. The record is created by the first write
 * that carries something the user wrote or chose. Every write returns whether it applied (`false`
 * in a read-only tab, `FeatureStore.update()`); a no-op writes nothing and reports `true`.
 */
@Injectable({ providedIn: 'root' })
export class MissionService {
  private readonly clock = inject(CLOCK);
  private readonly store = featureStore<Mission | null>(MISSION_MODEL_KEY);

  /** The record, `null` until the first edit. */
  readonly record: Signal<Mission | null> = computed(() => this.store.value());

  /** The latest saved version's text, `''` before the first save. */
  readonly currentStatement: Signal<string> = computed(() => currentStatement(this.record()));

  edit(fields: Partial<MissionFields>): boolean {
    return this.write((mission) => editMission(mission, fields, this.clock.now()));
  }

  setRoleLine(roleId: string, text: string): boolean {
    return this.write((mission) =>
      editMission(
        mission,
        { roleLines: roleLinesWith(mission?.roleLines ?? [], roleId, text) },
        this.clock.now(),
      ),
    );
  }

  /** Appends `text` to `list` (normalised, deduplicated case-insensitively, step 4 capped). */
  addLine(list: MissionListKey, text: string): AddOutcome {
    const result = withLine(this.record()?.[list] ?? [], text, maxFor(list));
    if (result.outcome !== 'added') {
      return result.outcome;
    }
    return this.edit({ [list]: result.list }) ? 'added' : 'refused';
  }

  removeLine(list: MissionListKey, index: number): boolean {
    const current = this.record()?.[list] ?? [];
    return this.edit({ [list]: withoutLine(current, index) });
  }

  setCheck(key: ReviewKey, value: boolean): boolean {
    return this.write((mission) =>
      editMission(
        mission,
        { checklist: checklistWith(mission?.checklist ?? {}, key, value) },
        this.clock.now(),
      ),
    );
  }

  /** Saves the draft as a new version; returns its number (1-based), or `null` when there was
   * nothing new to save or the write was refused. */
  saveVersion(note?: string): number | null {
    const mission = this.record();
    if (mission === null) {
      return null;
    }
    const next = withVersion(mission, crypto.randomUUID(), this.clock.now(), note);
    if (next === mission || !this.store.update(() => next)) {
      return null;
    }
    return next.versions.length;
  }

  /** Copies version `id`'s text into the draft; the versions are untouched (#62). */
  restoreVersion(id: string): boolean {
    return this.writeExisting((mission) => withRestoredVersion(mission, id, this.clock.now()));
  }

  setReviewInterval(interval: ReviewInterval): boolean {
    return this.writeExisting((mission) => withReviewInterval(mission, interval, this.clock.now()));
  }

  /** "Reviewed today": today is the local date of `CLOCK`. */
  markReviewed(): boolean {
    const now = this.clock.now();
    return this.writeExisting((mission) => withReviewed(mission, localDateString(now), now));
  }

  /** `write` for an edit that needs the record: before it exists there is nothing to change. */
  private writeExisting(apply: (mission: Mission) => Mission): boolean {
    return this.write((mission) => (mission === null ? null : apply(mission)));
  }

  /** Applies `apply` unless it returns the record unchanged, so a no-op (or an empty first edit)
   * never writes, not even the `null` default into an absent slice. */
  private write(apply: (mission: Mission | null) => Mission | null): boolean {
    const current = this.record();
    if (apply(current) === current) {
      return true;
    }
    return this.store.update((mission) => apply(mission));
  }
}
