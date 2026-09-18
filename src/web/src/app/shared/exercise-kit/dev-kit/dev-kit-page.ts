import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DoneToggle } from '../done-toggle/done-toggle';
import { EditorInitialFocus } from '../exercise-page/editor-initial-focus.directive';
import { ExercisePage } from '../exercise-page/exercise-page';
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
    EditorInitialFocus,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    GuidedStepContent,
    GuidedStepper,
    MatButtonModule,
    MatIconModule,
    ReflectionEditor,
  ],
  templateUrl: './dev-kit-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevKitPage {
  private readonly progress = inject(ExerciseProgress);

  protected readonly items = DEMO_ITEMS;
  protected readonly steps = DEMO_STEPS;
  protected readonly stepIndex = signal(0);
  protected readonly reflection = signal('');
  protected readonly reflectionUpdatedAt = signal<string | null>(null);

  protected readonly editingId = signal<string | null>(null);
  protected readonly editing = computed(() => this.editingId() !== null);
  protected readonly editorTitle = computed(
    () => this.items.find((item) => item.id === this.editingId())?.title ?? '',
  );
  protected readonly editorStatus = signal<'saved' | 'saving' | null>('saved');

  protected readonly done = this.progress.isDone(DEMO_EXERCISE_ID);
  protected readonly completedAt = this.progress.completedAt(DEMO_EXERCISE_ID);

  protected edit(id: string): void {
    this.editingId.set(id);
  }

  protected closeEditor(): void {
    this.editingId.set(null);
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
