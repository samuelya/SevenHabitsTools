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
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import {
  isValidIsoDate,
  localDateString,
  parseIsoDate,
} from '../../shared/exercise-kit/assessment-history.logic';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import {
  MAX_CRITERIA,
  StepDirection,
  allStepsDone,
  appendCriterion,
  appendStep,
  canMoveStep,
  editCriterion,
  editStepText,
  moveStep,
  removeCriterion,
  removeStep,
  setStepDate,
  setStepDone,
} from './project-steps.logic';
import { canAddSteps, isFinished } from './projects.logic';
import {
  PROJECT_STATUSES,
  Project,
  ProjectFields,
  ProjectStatus,
  ProjectStep,
} from './projects.model';

/**
 * The form for one project (issue #65): the name, what done looks like, how you'll know (up to
 * five lines), the deadline, the status and, last, the steps, which stay locked until "What done
 * looks like" has text. Presentational: every edit goes out at once as the fields it changes
 * (autosave), the step and criteria arrays built with `project-steps.logic.ts`.
 *
 * A toggle or checkbox is put back to the stored value before its edit is emitted, so a refused
 * write (a read-only tab) leaves it showing what is stored. A text field keeps what was typed.
 */
@Component({
  selector: 'app-project-item-form',
  imports: [
    AppNumberPipe,
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './project-item-form.html',
  styleUrl: './project-item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectItemForm {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly item = input.required<Project>();
  readonly changed = output<Partial<ProjectFields>>();
  readonly deleted = output<void>();

  protected readonly statuses = PROJECT_STATUSES;
  protected readonly maxCriteria = MAX_CRITERIA;

  private readonly nameField = viewChild<ElementRef<HTMLTextAreaElement>>('nameField');
  private readonly touched = signal<ReadonlySet<'name' | 'desiredResult'>>(new Set());
  /** What is typed in "Next step", not yet added. */
  protected readonly newStepText = signal('');
  /** The key of the step this form just asked to add: once it is stored, the field clears. */
  private pendingStepKey: string | null = null;

  protected readonly nameError = computed(
    () => this.touched().has('name') && !this.item().name.trim(),
  );
  protected readonly desiredResultError = computed(
    () => this.touched().has('desiredResult') && !canAddSteps(this.item()),
  );
  protected readonly stepsOpen = computed(() => canAddSteps(this.item()));
  protected readonly criteriaFull = computed(() => this.item().criteria.length >= MAX_CRITERIA);
  protected readonly offerDone = computed(
    () => allStepsDone(this.item().steps) && !isFinished(this.item().status),
  );
  protected readonly deadline = computed(() => dateOrNull(this.item().deadline));

  constructor() {
    // The form is reused when the selection moves to another project: reset local state, keyed to
    // the id, not the object, which is new on every save (playbook §6).
    let previous: string | undefined;
    effect(() => {
      const id = this.item().id;
      if (id === previous) {
        return;
      }
      const switched = previous !== undefined;
      previous = id;
      untracked(() => {
        this.touched.set(new Set());
        this.newStepText.set('');
        this.pendingStepKey = null;
        if (switched) {
          // See `TransitionItemForm` for why this is deferred.
          queueMicrotask(() => this.nameField()?.nativeElement.focus());
        }
      });
    });
    // "Next step" clears once its step is stored; a refused add keeps the text.
    effect(() => {
      const steps = this.item().steps;
      const key = this.pendingStepKey;
      if (key !== null && steps.some((step) => step.key === key)) {
        this.pendingStepKey = null;
        untracked(() => this.newStepText.set(''));
      }
    });
  }

  protected touch(field: 'name' | 'desiredResult'): void {
    if (!this.touched().has(field)) {
      this.touched.update((fields) => new Set(fields).add(field));
    }
  }

  protected onNameInput(event: Event): void {
    const name = (event.target as HTMLTextAreaElement).value;
    if (name.trim() === '') {
      this.touch('name');
    }
    this.changed.emit({ name });
  }

  protected onDesiredResultInput(event: Event): void {
    const desiredResult = (event.target as HTMLTextAreaElement).value;
    if (desiredResult.trim() === '') {
      this.touch('desiredResult');
    }
    this.changed.emit({ desiredResult });
  }

  // ---- How you'll know ----

  protected onCriterionInput(index: number, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.emitCriteria(editCriterion(this.item().criteria, index, text));
  }

  protected onAddCriterion(): void {
    const next = appendCriterion(this.item().criteria);
    if (next !== this.item().criteria) {
      this.emitCriteria(next);
      this.focusAfterRender(`.criterion-field[data-index="${next.length - 1}"]`);
    }
  }

  protected onRemoveCriterion(index: number): void {
    this.emitCriteria(removeCriterion(this.item().criteria, index));
    this.focusAfterRender('.add-criterion');
  }

  private emitCriteria(criteria: readonly string[]): void {
    if (criteria !== this.item().criteria) {
      this.changed.emit({ criteria });
    }
  }

  // ---- Deadline and status ----

  /** A picked or typed valid date is stored; a cleared field clears it; one that doesn't parse
   * changes nothing. */
  protected onDeadlineChange(event: MatDatepickerInputEvent<Date>, field: HTMLInputElement): void {
    if (event.value) {
      this.changed.emit({ deadline: localDateString(event.value) });
    } else if (field.value.trim() === '') {
      this.changed.emit({ deadline: '' });
    }
  }

  /** Re-selecting the current status emits nothing. */
  protected onStatusChange(event: MatButtonToggleChange): void {
    const current = this.item().status;
    const value = event.value as ProjectStatus;
    event.source.buttonToggleGroup.value = current;
    if (value !== current && (PROJECT_STATUSES as readonly string[]).includes(value)) {
      this.changed.emit({ status: value });
    }
  }

  protected onMarkProjectDone(): void {
    this.changed.emit({ status: 'done' });
  }

  // ---- Steps ----

  protected onNewStepInput(event: Event): void {
    this.newStepText.set((event.target as HTMLInputElement).value);
  }

  /** Adds "Next step" at the end. Focus stays in the field for the next one. */
  protected onAddStep(event?: Event): void {
    event?.preventDefault();
    if (!this.stepsOpen()) {
      return;
    }
    const key = crypto.randomUUID();
    const next = appendStep(this.item().steps, key, this.newStepText());
    if (next !== this.item().steps) {
      this.pendingStepKey = key;
      this.changed.emit({ steps: next });
    }
  }

  protected onStepInput(step: ProjectStep, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.emitSteps(editStepText(this.item().steps, step.key, text));
  }

  protected onStepToggle(step: ProjectStep, event: MatCheckboxChange): void {
    event.source.checked = step.done;
    this.emitSteps(setStepDone(this.item().steps, step.key, event.checked));
  }

  protected onStepDateChange(
    step: ProjectStep,
    event: MatDatepickerInputEvent<Date>,
    field: HTMLInputElement,
  ): void {
    if (event.value) {
      this.emitSteps(setStepDate(this.item().steps, step.key, localDateString(event.value)));
    } else if (field.value.trim() === '') {
      this.emitSteps(setStepDate(this.item().steps, step.key, null));
    }
  }

  protected canMove(step: ProjectStep, direction: StepDirection): boolean {
    return canMoveStep(this.item().steps, step.key, direction);
  }

  /** Moves the step and keeps focus on the button pressed, which travels with its row. The
   * buttons are `disabledInteractive`, so one at either end keeps focus too. */
  protected onMoveStep(step: ProjectStep, direction: StepDirection): void {
    this.emitSteps(moveStep(this.item().steps, step.key, direction));
    this.focusAfterRender(`[data-step-key="${step.key}"] .move-${direction}`);
  }

  protected onRemoveStep(step: ProjectStep): void {
    this.emitSteps(removeStep(this.item().steps, step.key));
    this.focusAfterRender('.new-step-field');
  }

  private emitSteps(steps: readonly ProjectStep[]): void {
    if (steps !== this.item().steps) {
      this.changed.emit({ steps });
    }
  }

  protected stepDate(step: ProjectStep): Date | null {
    return dateOrNull(step.date);
  }

  /** Focuses the first element matching `selector` in this form once the edit has rendered. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

function dateOrNull(date: string | undefined): Date | null {
  return date !== undefined && isValidIsoDate(date) ? parseIsoDate(date) : null;
}
