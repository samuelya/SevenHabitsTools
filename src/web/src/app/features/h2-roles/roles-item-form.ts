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
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import { RoleDirection, RoleEdit, isBuiltIn, isRating } from '../../shared/roles/roles.logic';
import { ROLE_COLORS, Role, RoleColor, RoleSatisfaction } from '../../shared/roles/roles.model';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import { ROLE_SWATCHES } from './roles.logic';

/** The "None" chip's value in the colour listbox (the stored value is then absent). */
const NO_COLOR = 'none';

/**
 * The editor for one role (issue #59): name (read-only for the built-in), description, colour,
 * "How it's going" (1–5), the picture note, and Move up/down, Archive/Unarchive and Delete.
 * Presentational: `role` is the current value; every edit is emitted at once for the page to save
 * through `RolesService` (autosave, no Save step).
 *
 * Focus: the kit focuses the name field when the editor opens (`appEditorInitialFocus`; the
 * built-in has none, so the kit's editor heading takes focus); this form moves focus only when the
 * user switches to another role with the editor open.
 */
@Component({
  selector: 'app-roles-item-form',
  imports: [
    AppNumberPipe,
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    TranslocoPipe,
  ],
  templateUrl: './roles-item-form.html',
  styleUrl: './roles-item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesItemForm {
  readonly role = input.required<Role>();
  /** The built-in role's translated label (`''` for a typed role). */
  readonly builtInLabel = input('');
  /** `false` for an unsaved draft: nothing to move, archive or delete until the role is written. */
  readonly saved = input(true);
  readonly canMoveUp = input(false);
  readonly canMoveDown = input(false);

  readonly changed = output<RoleEdit>();
  readonly moved = output<RoleDirection>();
  readonly archivedChange = output<boolean>();
  readonly deleted = output<void>();

  protected readonly colors = ROLE_COLORS;
  protected readonly swatches = ROLE_SWATCHES;
  protected readonly noColor = NO_COLOR;
  protected readonly ratings: readonly RoleSatisfaction[] = [1, 2, 3, 4, 5];
  protected readonly builtIn = computed(() => isBuiltIn(this.role()));
  protected readonly rating = computed(() => {
    const value = this.role().satisfaction;
    return isRating(value) ? value : null;
  });

  private readonly firstField = viewChild<ElementRef<HTMLElement>>('firstField');
  private readonly descriptionField = viewChild<ElementRef<HTMLElement>>('descriptionField');
  private readonly touchedName = signal(false);

  constructor() {
    onChange(
      computed(() => this.role().id),
      (_id, previous) => {
        this.touchedName.set(false);
        if (previous !== undefined) {
          // Another role with the editor already open (see `TransitionItemForm` for why this is
          // a microtask rather than a direct call).
          queueMicrotask(() =>
            (this.firstField() ?? this.descriptionField())?.nativeElement.focus(),
          );
        }
      },
    );
  }

  protected readonly nameMissing = computed(
    () => !this.builtIn() && this.touchedName() && !(this.role().name ?? '').trim(),
  );

  protected touchName(): void {
    this.touchedName.set(true);
  }

  protected onNameInput(event: Event): void {
    this.changed.emit({ name: (event.target as HTMLInputElement).value });
  }

  protected onDescriptionInput(event: Event): void {
    this.changed.emit({ description: (event.target as HTMLInputElement).value });
  }

  /** Deselecting the current chip, or picking "None", clears the colour. */
  protected onColorChange(event: MatChipListboxChange): void {
    const value = event.value as RoleColor | typeof NO_COLOR | undefined;
    this.changed.emit({ color: value === undefined || value === NO_COLOR ? null : value });
  }

  protected onRatingChange(event: MatRadioChange): void {
    const value = Number(event.value);
    if (isRating(value)) {
      this.changed.emit({ satisfaction: value });
    }
  }

  protected onNoteInput(event: Event): void {
    this.changed.emit({ note: (event.target as HTMLTextAreaElement).value });
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
    react(value, before);
  });
}
