import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import { isItemComplete } from './affirmations.logic';
import {
  AFFIRMATION_CHECKS,
  Affirmation,
  AffirmationCheck,
  AffirmationFields,
} from './affirmations.model';

/**
 * The form for one affirmation (issue #64): the sentence, the five quality checks with a hint
 * each, the scene, Archive/Unarchive and Delete. Presentational: it emits each edit and the page
 * stores it (autosave, no Save step).
 */
@Component({
  selector: 'app-affirmation-item-form',
  imports: [
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './affirmation-item-form.html',
  styleUrl: './affirmation-item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffirmationItemForm {
  readonly item = input.required<Affirmation>();
  /** `false` for an unsaved draft: nothing to archive until it is written. */
  readonly saved = input(true);
  readonly changed = output<Partial<AffirmationFields>>();
  readonly archivedChange = output<boolean>();
  readonly deleted = output<void>();

  protected readonly checkKeys = AFFIRMATION_CHECKS;

  private readonly textField = viewChild<ElementRef<HTMLTextAreaElement>>('textField');
  private readonly touchedText = signal(false);
  protected readonly textError = computed(() => this.touchedText() && !this.item().text.trim());
  protected readonly complete = computed(() => isItemComplete(this.item()));

  constructor() {
    // The form is reused when the selection moves to another affirmation: reset the touched state,
    // keyed to the id, not the object, which is new on every save (playbook §6).
    let previous: string | undefined;
    effect(() => {
      const id = this.item().id;
      if (id === previous) {
        return;
      }
      const switched = previous !== undefined;
      previous = id;
      untracked(() => {
        this.touchedText.set(false);
        if (switched) {
          // A switch with the editor open; the kit focuses the sentence on open itself. See
          // `TransitionItemForm` for why this is deferred.
          queueMicrotask(() => this.textField()?.nativeElement.focus());
        }
      });
    });
  }

  protected onTextInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    if (text.trim() === '') {
      this.touchedText.set(true);
    }
    this.changed.emit({ text });
  }

  protected onTextBlur(): void {
    this.touchedText.set(true);
  }

  protected onCheckChange(key: AffirmationCheck, checked: boolean): void {
    if (this.item().checks[key] !== checked) {
      this.changed.emit({ checks: { ...this.item().checks, [key]: checked } });
    }
  }

  protected onSceneInput(event: Event): void {
    this.changed.emit({ scene: (event.target as HTMLTextAreaElement).value });
  }
}
