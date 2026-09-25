import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import { defaultKept, followUpValid, tidyFollowUp } from './rehearsal.logic';
import {
  FOLLOW_UP_KEPT,
  FOLLOW_UP_RESULTS,
  FollowUpKept,
  FollowUpResult,
  RehearsalFollowUp,
} from './rehearsal.model';

/** The follow-up as the user is filling it in: "Did it happen?" starts unanswered. */
interface FollowUpDraft {
  readonly happened?: boolean;
  readonly result?: FollowUpResult;
  readonly kept?: FollowUpKept;
  readonly learned?: string;
}

/**
 * The "Afterwards" section (issue #55): did it happen, and if so how the user responded, whether
 * they kept the promise and what they learned. Purely presentational, and the one part of the
 * editor that is not saved as the user types: the answers stay in this component until Save, so
 * backing out leaves the stored follow-up, and the promise in Your promises, untouched (issue #55's
 * implementation notes). `saved` emits the tidied follow-up for the page to store.
 *
 * The form component is reused across selections, so the answers are re-seeded from the stored
 * follow-up whenever `recordId` or `followUp` changes (`linkedSignal`).
 */
@Component({
  selector: 'app-rehearsal-follow-up',
  imports: [
    CdkTextareaAutosize,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    TranslocoPipe,
  ],
  templateUrl: './rehearsal-follow-up.html',
  styleUrl: './rehearsal-follow-up.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RehearsalFollowUpForm {
  /** The rehearsal this follow-up belongs to: a new one discards unsaved answers. */
  readonly recordId = input.required<string>();
  readonly followUp = input<RehearsalFollowUp | undefined>(undefined);
  readonly saved = output<RehearsalFollowUp>();

  protected readonly results = FOLLOW_UP_RESULTS;
  protected readonly keptOptions = FOLLOW_UP_KEPT;

  protected readonly draft = linkedSignal<FollowUpDraft>(() => {
    this.recordId();
    return { ...this.followUp() };
  });
  /** Whether Save was pressed with "Your promise" unanswered, gating its `role="alert"` error. */
  private readonly attempted = linkedSignal(() => {
    this.recordId();
    return false;
  });
  protected readonly showKeptError = computed(
    () => this.attempted() && this.draft().happened === true && this.draft().kept === undefined,
  );
  protected onHappenedChange(happened: boolean): void {
    this.draft.update((draft) => ({ ...draft, happened }));
  }

  /** A result pre-selects its promise answer (Kept, Broken, or none for Partly). */
  protected onResultChange(result: FollowUpResult): void {
    this.draft.update((draft) => ({ ...draft, result, kept: defaultKept(result) }));
  }

  protected onKeptChange(kept: FollowUpKept): void {
    this.draft.update((draft) => ({ ...draft, kept }));
  }

  protected onLearnedInput(event: Event): void {
    const learned = (event.target as HTMLTextAreaElement).value;
    this.draft.update((draft) => ({ ...draft, learned }));
  }

  protected save(): void {
    const draft = this.draft();
    if (draft.happened === undefined) {
      return;
    }
    const followUp: RehearsalFollowUp = { ...draft, happened: draft.happened };
    if (!followUpValid(followUp)) {
      this.attempted.set(true);
      return;
    }
    this.attempted.set(false);
    this.saved.emit(tidyFollowUp(followUp));
  }
}
