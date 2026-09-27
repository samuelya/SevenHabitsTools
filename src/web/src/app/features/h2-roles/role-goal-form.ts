import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe, AppNumberPipe } from '../../core/i18n/locale.pipe';
import { parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import { MAX_GOAL_STEPS } from '../../shared/roles/role-goals.logic';
import {
  GOAL_HORIZONS,
  GoalStep,
  RoleGoal,
  isGoalHorizon,
} from '../../shared/roles/role-goals.model';
import { GoalAction } from './goals.logic';

let nextId = 0;

/**
 * The editor for one goal (issue #291): what, why, how you'll know, when (horizon) and, once the
 * goal is saved, its first steps, its status (Reached / Drop / Reopen) and Delete. Presentational:
 * `goal` is the current value and every edit goes out at once as a `GoalAction` (autosave).
 *
 * A toggle or checkbox is put back to the stored value before its edit is emitted, so a refused
 * write (a read-only tab) leaves it showing what is stored, and an applied one updates it through
 * the input. A text field keeps what the user typed either way.
 */
@Component({
  selector: 'app-role-goal-form',
  imports: [
    AppDatePipe,
    AppNumberPipe,
    CdkTextareaAutosize,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './role-goal-form.html',
  styleUrl: './role-goal-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleGoalForm {
  private readonly injector = inject(Injector);

  readonly goal = input.required<RoleGoal>();
  /** `false` for an unsaved draft: steps, status and the rest wait until the goal is written. */
  readonly saved = input(true);
  /** Focus "What you want to reach" when this form first renders (a goal just added). */
  readonly focusOnOpen = input(false);

  readonly action = output<GoalAction>();

  /** Unique per instance, for `id`/`aria-describedby` pairs. */
  protected readonly uid = `goal-${nextId++}`;
  protected readonly horizons = GOAL_HORIZONS;
  protected readonly maxSteps = MAX_GOAL_STEPS;
  protected readonly full = computed(() => this.goal().steps.length >= MAX_GOAL_STEPS);
  protected readonly resolvedDate = computed(() => {
    const resolvedOn = this.goal().resolvedOn;
    return resolvedOn ? parseIsoDate(resolvedOn) : null;
  });

  private readonly whatField = viewChild<ElementRef<HTMLTextAreaElement>>('whatField');
  private readonly stepFields = viewChildren<ElementRef<HTMLInputElement>>('stepField');
  private readonly touchedWhat = signal(false);
  /** What is in the "what" field; `null` until typed in. It can be blank while the stored `what`
   * keeps its last valid value (`editGoal()` never stores a blank one). */
  private readonly typedWhat = signal<string | null>(null);
  /** The step count when "Add step" was pressed; the new step's field takes focus once it shows. */
  private readonly stepsBeforeAdd = signal<number | null>(null);

  protected readonly whatMissing = computed(
    () => this.touchedWhat() && !(this.typedWhat() ?? this.goal().what).trim(),
  );

  constructor() {
    afterNextRender(() => {
      if (this.focusOnOpen()) {
        this.whatField()?.nativeElement.focus();
      }
    });
    effect(() => {
      const count = this.goal().steps.length;
      const before = this.stepsBeforeAdd();
      if (before === null || count <= before) {
        return;
      }
      untracked(() => this.stepsBeforeAdd.set(null));
      afterNextRender(() => this.stepFields().at(-1)?.nativeElement.focus(), {
        injector: this.injector,
      });
    });
  }

  protected touchWhat(): void {
    this.touchedWhat.set(true);
  }

  protected onWhatInput(event: Event): void {
    const what = (event.target as HTMLTextAreaElement).value;
    this.typedWhat.set(what);
    if (what.trim() === '' && this.saved()) {
      this.touchedWhat.set(true);
    }
    this.action.emit({ kind: 'edit', edit: { what } });
  }

  protected onWhyInput(event: Event): void {
    this.action.emit({ kind: 'edit', edit: { why: (event.target as HTMLTextAreaElement).value } });
  }

  protected onHowInput(event: Event): void {
    this.action.emit({ kind: 'edit', edit: { how: (event.target as HTMLInputElement).value } });
  }

  /** Re-selecting the current horizon emits nothing. */
  protected onHorizonChange(event: MatButtonToggleChange): void {
    const current = this.goal().horizon;
    const value: unknown = event.value;
    event.source.buttonToggleGroup.value = current;
    if (value !== current && isGoalHorizon(value)) {
      this.action.emit({ kind: 'edit', edit: { horizon: value } });
    }
  }

  protected onStepInput(step: GoalStep, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.action.emit({ kind: 'editStep', key: step.key, text });
  }

  protected onStepToggle(step: GoalStep, event: MatCheckboxChange): void {
    event.source.checked = step.done;
    this.action.emit({ kind: 'toggleStep', key: step.key, done: event.checked });
  }

  protected onAddStep(): void {
    if (this.full()) {
      return;
    }
    this.stepsBeforeAdd.set(this.goal().steps.length);
    this.action.emit({ kind: 'addStep' });
  }
}
