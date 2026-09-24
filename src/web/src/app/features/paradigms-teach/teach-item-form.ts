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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../core/i18n/locale.pipe';
import { parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import { KEY_IDEA_MAX_LENGTH, isKeyIdeaValid, isValidPlannedAt } from './teach.logic';
import { TEACH_STATUSES, TeachEntryFields, TeachStatus } from './teach.model';

/**
 * The form for one chapter's teach-it commitment: key idea, who to teach, when, its status, and
 * what was learned by teaching it. Purely presentational — `entry` is the page's current draft
 * (`teach.logic.ts`'s `draftFor()`: the chapter's live entry, or fresh defaults if it has none
 * yet), `changed` emits the edited field(s) on every change so the page can persist through
 * `featureStore` immediately, the same autosave-on-edit convention as `transition-item-form.ts`.
 *
 * **Who moves focus, and when** (`exercise-layout.md`): the kit focuses the key-idea field when the editor
 * *opens* (it carries `appEditorInitialFocus`). This form only moves focus for the one transition
 * the kit cannot see — switching to a *different* chapter while the editor stays open (the compact
 * desktop list stays clickable in focus mode, reusing this instance) — keyed on `entry().chapter`,
 * the one field that's stable across a chapter's whole lifecycle even before it has a record (and
 * therefore an `id`) of its own.
 */
@Component({
  selector: 'app-teach-item-form',
  imports: [
    AppDatePipe,
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './teach-item-form.html',
  styleUrl: './teach-item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeachItemForm {
  readonly entry = input.required<TeachEntryFields>();
  /** The chapter's live entry's `sharedAt`, read-only display only — `null` before it has ever
   * been shared. Kept out of `entry` since it's never user-edited directly. */
  readonly sharedAt = input<string | null>(null);
  readonly changed = output<Partial<TeachEntryFields>>();

  protected readonly statuses = TEACH_STATUSES;
  protected readonly maxKeyIdeaLength = KEY_IDEA_MAX_LENGTH;
  protected readonly keyIdeaInvalid = computed(() => !isKeyIdeaValid(this.entry().keyIdea));

  private readonly keyIdeaField = viewChild<ElementRef<HTMLTextAreaElement>>('keyIdeaField');

  private readonly touchedFields = signal<ReadonlySet<string>>(new Set());

  constructor() {
    onChange(
      computed(() => this.entry().chapter),
      (_chapter, previous) => {
        this.touchedFields.set(new Set());
        if (previous === undefined) {
          // First render: the kit's own `appEditorInitialFocus` handling focuses the key-idea
          // field on editor open. Focusing it here too would be a second writer for the same
          // moment (`exercise-layout.md`).
          return;
        }
        queueMicrotask(() => this.keyIdeaField()?.nativeElement.focus());
      },
    );
  }

  protected isTouched(field: string): boolean {
    return this.touchedFields().has(field);
  }

  protected touch(field: string): void {
    if (!this.touchedFields().has(field)) {
      this.touchedFields.update((fields) => new Set(fields).add(field));
    }
  }

  protected onKeyIdeaInput(event: Event): void {
    this.changed.emit({ keyIdea: (event.target as HTMLTextAreaElement).value });
  }

  protected onPersonInput(event: Event): void {
    this.changed.emit({ person: (event.target as HTMLInputElement).value });
  }

  protected onPlannedAtInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    // Ignore an incomplete/cleared value rather than persisting it — see `isValidPlannedAt`'s own
    // doc comment for why a stored `''` would be worse than just not applying this edit.
    if (isValidPlannedAt(value)) {
      this.changed.emit({ plannedAt: value });
    }
  }

  /** `sharedAt` is a plain ISO date, not a `Date` — `AppDatePipe` needs a real `Date` parsed as
   * *local* midnight (`parseIsoDate`), the same convention every other date-only render in this
   * app follows (`maturity-result.ts`, `pc-balance-audit-form.ts`,
   * `assessment-history-list.ts`) — piping the raw string straight through `new Date(string)`
   * parses it as UTC midnight, which displays a day early in a negative-UTC-offset timezone. */
  protected localDate(date: string): Date {
    return parseIsoDate(date);
  }

  protected onStatusChange(status: TeachStatus): void {
    this.changed.emit({ status });
  }

  protected onLearnedInput(event: Event): void {
    this.changed.emit({ learned: (event.target as HTMLTextAreaElement).value });
  }
}

/**
 * Runs `react` only when `source()` actually *changes* value, handing it the previous value —
 * `undefined` on the first run. `entry()` is a new object on every keystroke, so a plain `effect`
 * would re-run (and re-focus) constantly — the same helper `transition-item-form.ts` uses, copied
 * rather than shared: it's four lines, and a shared one would be this form's only reason to import
 * from that feature's folder (playbook §6: "never import another feature's folder"). Must be
 * called from an injection context.
 */
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
