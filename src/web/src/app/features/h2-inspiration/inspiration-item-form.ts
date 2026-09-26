import { COMMA, ENTER } from '@angular/cdk/keycodes';
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
  untracked,
  viewChild,
} from '@angular/core';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import {
  addTag,
  isDuplicateTag,
  itemTags,
  normaliseTag,
  removeTag,
  tagSuggestions,
} from './inspiration.logic';
import {
  INSPIRATION_KINDS,
  Inspiration,
  InspirationFields,
  InspirationKind,
} from './inspiration.model';

/**
 * The form for one collection item (issue #63): the line, what it is, where it's from, tags (a chip
 * grid with autocomplete from the tags already used) and the favourite star. Presentational: it
 * emits each edit and the page stores it (autosave, no Save step).
 *
 * Tags are added on Enter, comma or blur, or by picking a suggestion. A refused tag (already on
 * the item) keeps its text in the field and says why. A blur while the suggestions are open adds
 * nothing: it is the click on a suggestion, which adds that one.
 */
@Component({
  selector: 'app-inspiration-item-form',
  imports: [
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './inspiration-item-form.html',
  styleUrl: './inspiration-item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspirationItemForm {
  readonly item = input.required<Inspiration>();
  /** Every tag in use across the collection (`allTags()`), for the suggestions. */
  readonly usedTags = input<readonly string[]>([]);
  readonly changed = output<Partial<InspirationFields>>();
  readonly deleted = output<void>();

  protected readonly kinds = INSPIRATION_KINDS;
  protected readonly separatorKeys = [ENTER, COMMA] as const;

  private readonly textField = viewChild<ElementRef<HTMLTextAreaElement>>('textField');
  private readonly tagInput = viewChild<ElementRef<HTMLInputElement>>('tagInput');
  private readonly tagTrigger = viewChild(MatAutocompleteTrigger);

  protected readonly tags = computed(() => itemTags(this.item()));
  private readonly touchedText = signal(false);
  protected readonly textError = computed(() => this.touchedText() && !this.item().text.trim());
  /** What is in the tag field, for the suggestions. */
  protected readonly typedTag = signal('');
  /** The tag the last add refused as already there; its text stays in the field. */
  protected readonly duplicate = signal<string | null>(null);
  protected readonly suggestions = computed(() =>
    tagSuggestions(this.usedTags(), this.tags(), this.typedTag()),
  );

  constructor() {
    // The form is reused when the selection moves to another item: reset what belongs to the old
    // one (touched state, the typed tag, the duplicate hint), keyed to the id, not the object,
    // which is new on every save (playbook §6).
    onChange(
      computed(() => this.item().id),
      (_id, previous) => {
        this.touchedText.set(false);
        this.typedTag.set('');
        this.duplicate.set(null);
        const input = this.tagInput()?.nativeElement;
        if (input) {
          input.value = '';
        }
        if (previous !== undefined) {
          // A switch with the editor open; the kit focuses the line on open itself. See
          // `TransitionItemForm` for why this is deferred.
          queueMicrotask(() => this.textField()?.nativeElement.focus());
        }
      },
    );
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

  protected onKindChange(kind: InspirationKind): void {
    if (kind !== this.item().kind) {
      this.changed.emit({ kind });
    }
  }

  protected onSourceInput(event: Event): void {
    this.changed.emit({ source: (event.target as HTMLInputElement).value });
  }

  protected onFavouriteToggle(): void {
    this.changed.emit({ favourite: !this.item().favourite });
  }

  protected onTagTyped(event: Event): void {
    this.typedTag.set((event.target as HTMLInputElement).value);
    this.duplicate.set(null);
  }

  /** Enter or comma. With a suggestion highlighted, the autocomplete adds that one instead. */
  protected onTagTokenEnd(event: MatChipInputEvent): void {
    const trigger = this.tagTrigger();
    if (trigger?.panelOpen && trigger.activeOption) {
      return;
    }
    this.addTyped(event.value);
  }

  protected onTagSelected(event: MatAutocompleteSelectedEvent): void {
    this.addTyped(String(event.option.value));
  }

  protected onTagBlur(): void {
    if (this.tagTrigger()?.panelOpen) {
      return;
    }
    const value = this.tagInput()?.nativeElement.value ?? '';
    if (value.trim() !== '') {
      this.addTyped(value);
    }
  }

  protected onTagRemoved(tag: string): void {
    const tags = this.item().tags;
    const next = removeTag(tags, tag);
    if (next !== tags) {
      this.changed.emit({ tags: next });
    }
  }

  private addTyped(raw: string): void {
    const tags = this.item().tags;
    if (isDuplicateTag(tags, raw)) {
      this.duplicate.set(normaliseTag(raw));
      this.setTagInput(raw);
      return;
    }
    this.duplicate.set(null);
    const next = addTag(tags, raw);
    if (next !== tags) {
      this.changed.emit({ tags: next });
    }
    this.setTagInput('');
  }

  /** Sets the tag field's text: the autocomplete writes the picked option into it, which a refused
   * pick replaces with what the user typed. */
  private setTagInput(value: string): void {
    const input = this.tagInput()?.nativeElement;
    const text = value === '' ? '' : this.typedTag() || value;
    if (input) {
      input.value = text;
    }
    this.typedTag.set(text);
  }
}

/** Runs `react` only when `source()` changes, with the previous value (`undefined` at first). */
function onChange<T>(source: Signal<T>, react: (value: T, previous: T | undefined) => void): void {
  let previous: T | undefined;
  let first = true;
  effect(() => {
    const value = source();
    if (!first && value === previous) {
      return;
    }
    const before = first ? undefined : previous;
    first = false;
    previous = value;
    untracked(() => react(value, before));
  });
}
