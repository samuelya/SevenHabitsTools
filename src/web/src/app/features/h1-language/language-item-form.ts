import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Signal,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import { PHRASE_KINDS, Phrase, PhraseFields, PhraseKind } from './language.model';

/**
 * The form for one phrase (issue #54): what was said, which kind (each with its example words
 * under it), the rewrite for a phrase that gives the choice away, and where. Purely
 * presentational: `changed` emits the edited field(s) for the page to persist.
 *
 * Every field is bound to the `phrase` input, so a switch to another phrase shows that phrase's
 * text; the only local state, which fields were blurred, resets when the phrase id changes, not
 * when the same phrase is saved again. Focus: the kit focuses "What you said" when the editor
 * opens (`appEditorInitialFocus`); this form only refocuses it when the page switches to a
 * different phrase with the editor open, as `transition-item-form.ts` does.
 */
@Component({
  selector: 'app-language-item-form',
  imports: [
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    TranslocoPipe,
  ],
  templateUrl: './language-item-form.html',
  styleUrl: './language-item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageItemForm {
  readonly phrase = input.required<Phrase>();
  readonly changed = output<Partial<PhraseFields>>();
  readonly deleted = output<void>();

  protected readonly kinds = PHRASE_KINDS;
  protected readonly reactive = computed(() => this.phrase().kind === 'reactive');

  private readonly textField = viewChild<ElementRef<HTMLTextAreaElement>>('textField');
  private readonly touchedFields = signal<ReadonlySet<string>>(new Set());

  constructor() {
    onChange(
      computed(() => this.phrase().id),
      (_id, previous) => {
        this.touchedFields.set(new Set());
        if (previous !== undefined) {
          queueMicrotask(() => this.textField()?.nativeElement.focus());
        }
      },
    );
  }

  /** Whether `field` has been blurred at least once, gating its `role="alert"` error. */
  protected isTouched(field: string): boolean {
    return this.touchedFields().has(field);
  }

  protected touch(field: string): void {
    if (!this.touchedFields().has(field)) {
      this.touchedFields.update((fields) => new Set(fields).add(field));
    }
  }

  protected blank(text: string | undefined): boolean {
    return !text?.trim();
  }

  protected onTextInput(field: 'text' | 'reframe' | 'context', event: Event): void {
    this.changed.emit({ [field]: (event.target as HTMLTextAreaElement | HTMLInputElement).value });
  }

  protected onKindChange(kind: PhraseKind): void {
    this.changed.emit({ kind });
  }
}

/** Runs `react` only when `source()` changes, with the previous value (`undefined` at first). */
function onChange<T>(source: Signal<T>, react: (value: T, previous: T | undefined) => void): void {
  let previous: T | undefined;
  effect(() => {
    const value = source();
    if (previous !== undefined && value === previous) {
      return;
    }
    const before = previous;
    previous = value;
    react(value, before);
  });
}
