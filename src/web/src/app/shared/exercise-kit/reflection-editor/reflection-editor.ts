import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../../core/i18n/locale.pipe';

/** How long to wait after the last keystroke before `ReflectionEditor` emits `valueChange`. */
export const REFLECTION_DEBOUNCE_MS = 1000;

/**
 * A multiline reflection field with a 1 s autosave debounce (issue #30). Purely presentational:
 * `value`/`updatedAt` are inputs, `valueChange` is the debounced edit — the caller (a container
 * page, through its own `featureStore`) decides how and where to persist it.
 *
 * Shows a character count and a "Saved <time>"/"Not saved yet" caption by default —
 * `PcBalanceAuditForm`'s only persistence feedback after a reload, unchanged since #30.
 * `sessionStatus` (issue #212) opts a caller into the alternative instead: no status at all until
 * the first keystroke of *this* session (the caption reads as noise next to an untouched field on
 * a first-time worksheet), then "Saving…"/"Saved" in the same style `ExercisePage`'s own editor
 * header uses. Scope call on this PR: the session-scoped behaviour is opt-in, not a replacement,
 * so it can't silently remove PC Balance's only reload feedback — #215 migrates the kit's other
 * callers deliberately, one at a time.
 */
@Component({
  selector: 'app-reflection-editor',
  imports: [MatFormFieldModule, MatInputModule, TranslocoPipe, AppDatePipe],
  templateUrl: './reflection-editor.html',
  styleUrl: './reflection-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReflectionEditor implements OnDestroy {
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly updatedAt = input<string | null>(null);
  /** Opts into the session-scoped Saving/Saved status instead of the default character-count +
   * saved-at caption (issue #212) — see the class doc comment's scope call. */
  readonly sessionStatus = input(false);
  readonly valueChange = output<string>();

  /** Resyncs to `value()` whenever it changes externally (initial load, a sync from another tab),
   * but keeps its own writes in between — the caret-adjacent draft while the user is still typing,
   * ahead of the debounced `valueChange` this same edit will eventually emit. */
  protected readonly draft = linkedSignal(() => this.value());
  protected readonly characterCount = computed(() => this.draft().length);
  /** `null` until the first keystroke of this session; `'saving'` while the debounce is pending,
   * `'saved'` once it has fired. Only rendered when `sessionStatus()` is `true`. */
  protected readonly status = signal<'saving' | 'saved' | null>(null);

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingSave = false;

  ngOnDestroy(): void {
    clearTimeout(this.debounceTimer);
    if (this.pendingSave) {
      this.valueChange.emit(this.draft());
    }
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.draft.set(text);
    this.pendingSave = true;
    this.status.set('saving');
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.pendingSave = false;
      this.status.set('saved');
      this.valueChange.emit(this.draft());
    }, REFLECTION_DEBOUNCE_MS);
  }
}
