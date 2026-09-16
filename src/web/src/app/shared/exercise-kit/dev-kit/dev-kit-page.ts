import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DoneToggle } from '../done-toggle/done-toggle';
import { ExerciseDetail } from '../exercise-detail/exercise-detail';
import { ExerciseList } from '../exercise-list/exercise-list';
import { ExerciseListItem } from '../exercise-list/exercise-list.logic';
import { ExercisePromptCard } from '../exercise-prompt-card/exercise-prompt-card';
import { ExerciseProgress } from '../exercise-progress.service';
import { GuidedStepContent } from '../guided-stepper/guided-step-content';
import { GuidedStepDefinition, GuidedStepper } from '../guided-stepper/guided-stepper';
import { ReflectionEditor } from '../reflection-editor/reflection-editor';

const DEMO_EXERCISE_ID = 'dev-kit-demo';

const DEMO_ITEMS: ExerciseListItem[] = [
  { id: 'circle', title: 'Circle of Influence', subtitle: 'Habit 1', done: true },
  { id: 'mission', title: 'Personal mission statement', subtitle: 'Habit 2', done: false },
  { id: 'roles', title: 'Key roles', subtitle: 'Habit 2', done: false },
];

const DEMO_STEPS: GuidedStepDefinition[] = [
  { key: 'identify', label: 'Identify', done: true },
  { key: 'reflect', label: 'Reflect' },
];

/**
 * `/dev/kit` (issue #30): every kit component composed together, for visual review during
 * development — not part of any production route (`route-registry.ts` only registers it when
 * `isDevMode()`). A container page: it is the one place in the kit allowed to inject
 * `ExerciseProgress`, demonstrating how a real feature page would wire `DoneToggle` to it.
 */
@Component({
  selector: 'app-dev-kit-page',
  imports: [
    DoneToggle,
    ExerciseDetail,
    ExerciseList,
    ExercisePromptCard,
    GuidedStepContent,
    GuidedStepper,
    ReflectionEditor,
  ],
  templateUrl: './dev-kit-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevKitPage {
  private readonly progress = inject(ExerciseProgress);

  protected readonly items = DEMO_ITEMS;
  protected readonly steps = DEMO_STEPS;
  protected readonly selectedId = signal<string | null>(null);
  protected readonly stepIndex = signal(0);
  protected readonly reflection = signal('');
  protected readonly reflectionUpdatedAt = signal<string | null>(null);

  protected readonly done = this.progress.isDone(DEMO_EXERCISE_ID);
  protected readonly completedAt = this.progress.completedAt(DEMO_EXERCISE_ID);
  protected readonly hasDetail = computed(() => this.selectedId() !== null);

  protected select(id: string): void {
    this.selectedId.set(id);
  }

  protected onReflectionChange(value: string): void {
    this.reflection.set(value);
    this.reflectionUpdatedAt.set(new Date().toISOString());
  }

  protected onToggle(): void {
    if (this.done()) {
      this.progress.reopen(DEMO_EXERCISE_ID);
    } else {
      this.progress.markDone(DEMO_EXERCISE_ID);
    }
  }
}
