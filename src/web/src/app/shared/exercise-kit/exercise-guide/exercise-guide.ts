import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, inject } from '@angular/core';
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

export interface ExerciseGuideExampleField {
  readonly label: string;
  readonly value: string;
}

/** An example shown as the labelled fields the exercise asks for (issue #212) — a worksheet's one
 * example per step. `kind` may be left out of the i18n JSON: this is the default. */
export interface ExerciseGuideFieldsExample {
  readonly kind?: 'fields';
  readonly title: string;
  readonly fields: readonly ExerciseGuideExampleField[];
}

/** An example shown as a read-only mock of the item card a list or assessment exercise produces
 * (issue #230): its list row (title, an optional subtitle line, a check when `done`) with the
 * item's fields beneath. */
export interface ExerciseGuideCardExample {
  readonly kind: 'card';
  readonly title: string;
  readonly subtitle?: string;
  readonly done?: boolean;
  readonly fields: readonly ExerciseGuideExampleField[];
}

/** One finished example the guide shows. Generic label/value pairs whatever the exercise, so this
 * dialog needs no per-exercise code; `kind` only picks the visual. */
export type ExerciseGuideExample = ExerciseGuideFieldsExample | ExerciseGuideCardExample;

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
  /** A section the caller renders itself, shown right after "In short" — the habit hub's ordered
   * exercise list with each one's status (issue #230). A template rather than data, so the kit
   * never learns a caller's types and the caller's own pipes keep the section live. */
  readonly extra?: TemplateRef<unknown>;
}

/**
 * The "Read more" guide every exercise can offer (issue #212), opened by `ExerciseGuideOpener`
 * from `ExercisePromptCard`: the same four sections, headed by the kit's own generic copy
 * (`exerciseKit.guide.*`), around one exercise's own already-translated content. Purely
 * presentational — it renders `MAT_DIALOG_DATA` and nothing else, skipping any section whose
 * content is empty (the habit hub's "About this habit" has "In short" and its own `extra` section);
 * `MatDialog`/CDK give the focus
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
    NgTemplateOutlet,
    TranslocoPipe,
  ],
  templateUrl: './exercise-guide.html',
  styleUrl: './exercise-guide.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseGuide {
  protected readonly data = inject<ExerciseGuideData>(MAT_DIALOG_DATA);
}
