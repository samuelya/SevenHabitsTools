import { Injectable, Signal, computed } from '@angular/core';
import { featureStore } from '../../core/data/feature-store';
import { OpenProjectStep, allOpenSteps } from './projects.logic';
import { PROJECTS_MODEL_KEY, Project } from './projects.model';

/**
 * The one reader and writer of `habits.h2.projects` (issue #65): the Projects page edits through
 * `update()`, and the weekly planner (#71) reads `allOpenSteps()`. Writes return whether they
 * applied (`false` in a read-only tab, `FeatureStore.update()`); a change that returns the same
 * array writes nothing.
 */
@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly store = featureStore<readonly Project[]>(PROJECTS_MODEL_KEY);

  /** The stored list, tombstones and samples included. */
  readonly value: Signal<readonly Project[]> = this.store.value;

  /** The steps the weekly planner may offer as big rocks (`allOpenSteps()`): open steps of the
   * user's own projects under way; deleted, sample, Done and Dropped projects offer none. */
  readonly allOpenSteps: Signal<readonly OpenProjectStep[]> = computed(() =>
    allOpenSteps(this.store.value()),
  );

  update(change: (list: readonly Project[]) => readonly Project[]): boolean {
    return this.store.update(change);
  }
}
