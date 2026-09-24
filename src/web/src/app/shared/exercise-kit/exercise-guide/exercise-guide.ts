import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MAT_DIALOG_DATA,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/** One example card the guide shows for a step: field values in the exercise's own layout, shown
 * generically as label/value pairs so this dialog stays the same across every exercise (issue
 * #212). */
export interface ExerciseGuideExample {
  readonly title: string;
  readonly fields: readonly { readonly label: string; readonly value: string }[];
}

/** The `guide` key of an exercise's own i18n scope (issue #212's "Data model"), read with
 * `translateObjectSignal` (kept reactive to a language switch, the same reasoning as the
 * playbook's "Reactive labels" section) and passed to `ExerciseGuide` as `MAT_DIALOG_DATA`.
 * Structured JSON, not Markdown, so this dialog needs no renderer dependency (bundle budget,
 * issue #133) and the example cards can reuse the field labels the exercise already has. */
export interface ExerciseGuideContent {
  readonly inShort: string;
  readonly howTo: readonly string[];
  readonly examples: readonly ExerciseGuideExample[];
  readonly afterwards: string;
}

export interface ExerciseGuideData {
  readonly content: ExerciseGuideContent;
  /** An already-translated heading replacing the generic "How to do this exercise" — e.g. the
   * habit hub's "About this habit" (issue #219), which reuses this dialog for its intro. */
  readonly title?: string;
}

/**
 * The "Read more" guide every exercise can offer (issue #212), opened by `ExerciseGuideOpener`
 * from `ExercisePromptCard`: the same four sections, headed by the kit's own generic copy
 * (`exerciseKit.guide.*`), around one exercise's own already-translated content. Purely
 * presentational — it renders `MAT_DIALOG_DATA` and nothing else, skipping any section whose
 * content is empty (the habit hub's "About this habit" has only "In short" until #231); `MatDialog`/CDK give the focus
 * trap, Escape-to-close and focus return to the "Read more" button for free (see the design-check
 * comment on the issue).
 */
@Component({
  selector: 'app-exercise-guide',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './exercise-guide.html',
  styleUrl: './exercise-guide.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseGuide {
  protected readonly data = inject<ExerciseGuideData>(MAT_DIALOG_DATA);
}
