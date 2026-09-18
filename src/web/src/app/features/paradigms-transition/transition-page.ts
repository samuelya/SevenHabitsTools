import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { CLOCK } from '../../core/time/clock';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { ExerciseDetail } from '../../shared/exercise-kit/exercise-detail/exercise-detail';
import { ExerciseList } from '../../shared/exercise-kit/exercise-list/exercise-list';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { TransitionItemForm } from './transition-item-form';
import { TransitionSummary } from './transition-summary';
import {
  addScript,
  canMarkDone,
  editScript,
  liveScripts,
  removeScript,
  summarize,
  toListItem,
} from './transition.logic';
import {
  SCRIPT_EFFECTS,
  SCRIPT_SOURCES,
  Script,
  ScriptEffect,
  ScriptFields,
  ScriptSource,
  TRANSITION_MODEL_KEY,
} from './transition.model';

/** Every new script starts here; the user edits it straight away in the opened detail form. */
const DEFAULT_FIELDS: ScriptFields = {
  text: '',
  source: 'family',
  effect: 'mixed',
  decision: 'keep',
};

/** Transition-person reflection (issue #51): the reference "list" exercise every later exercise
 * copies (`src/web/docs/exercise-playbook.md`). The container: it reads `featureStore`, calls
 * `ExerciseProgress`, and passes plain values down to `ExerciseList`/`ExerciseDetail`/
 * `TransitionItemForm`/`TransitionSummary` — none of which inject the store or a service.
 */
@Component({
  selector: 'app-transition-page',
  imports: [
    DoneToggle,
    ExerciseDetail,
    ExerciseList,
    ExercisePromptCard,
    MatButtonModule,
    MatIconModule,
    TransitionItemForm,
    TransitionSummary,
    TranslocoPipe,
  ],
  templateUrl: './transition-page.html',
  styleUrl: './transition-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransitionPage {
  private readonly clock = inject(CLOCK);
  private readonly store = featureStore<Script[]>(TRANSITION_MODEL_KEY);
  protected readonly progress = inject(ExerciseProgress);

  protected readonly selectedId = signal<string | null>(null);

  // `translateSignal` (not `transloco.translate()` read inside a `computed`): the scope loads
  // over HTTP and only once something asks for it, and a `computed` that calls `translate()`
  // without reading a signal evaluates exactly once, so a cold load can freeze it on the raw key
  // and a later language switch never re-runs it. `translateSignal` instead subscribes to
  // Transloco's own `selectTranslate()` stream, so it emits again once the scope arrives and
  // again on every language change (review finding on #51's PR — see the playbook's "Reactive
  // labels" section for the pattern every exercise should copy).
  // The scope is named explicitly, with keys relative to it, rather than left to ambient
  // `TRANSLOCO_SCOPE` resolution: this route also provides `exercise-kit` (playbook §2), and
  // `translateSignal` (unlike `TranslocoPipe`, which loads every registered scope and then
  // translates the fully-aliased key) picks the *last*-registered scope when none is given, which
  // resolved these keys against the wrong one.
  private readonly sourceLabels = translateSignal(
    SCRIPT_SOURCES.map((source) => `source.${source}`),
    undefined,
    'paradigms-transition',
  );
  private readonly effectLabels = translateSignal(
    SCRIPT_EFFECTS.map((effect) => `effect.${effect}`),
    undefined,
    'paradigms-transition',
  );
  private readonly labels = computed(() => ({
    source: Object.fromEntries(
      SCRIPT_SOURCES.map((source, index) => [source, this.sourceLabels()[index]]),
    ) as Record<ScriptSource, string>,
    effect: Object.fromEntries(
      SCRIPT_EFFECTS.map((effect, index) => [effect, this.effectLabels()[index]]),
    ) as Record<ScriptEffect, string>,
  }));

  protected readonly scripts = computed(() => liveScripts(this.store.value()));
  protected readonly items = computed(() =>
    this.scripts().map((script) => toListItem(script, this.labels())),
  );
  protected readonly selectedScript = computed(
    () => this.scripts().find((script) => script.id === this.selectedId()) ?? null,
  );
  protected readonly hasDetail = computed(() => this.selectedScript() !== null);
  protected readonly summary = computed(() => summarize(this.store.value()));
  protected readonly readyToMarkDone = computed(() => canMarkDone(this.store.value()));

  protected readonly done = this.progress.isDone(TRANSITION_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(TRANSITION_MODEL_KEY);

  protected select(id: string): void {
    this.selectedId.set(id);
  }

  protected closeDetail(): void {
    this.selectedId.set(null);
  }

  protected onAddScript(): void {
    const now = this.clock.now();
    let createdId: string | null = null;
    const applied = this.store.update((scripts) => {
      const next = addScript(scripts, DEFAULT_FIELDS, now);
      createdId = next[next.length - 1].id;
      return next;
    });
    if (applied && createdId) {
      this.selectedId.set(createdId);
    }
  }

  protected onItemChanged(id: string, fields: Partial<ScriptFields>): void {
    this.store.update((scripts) => editScript(scripts, id, fields));
  }

  protected onItemDeleted(id: string): void {
    this.store.update((scripts) => removeScript(scripts, id, this.clock.now()));
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(TRANSITION_MODEL_KEY);
    } else {
      this.progress.markDone(TRANSITION_MODEL_KEY);
    }
  }
}
