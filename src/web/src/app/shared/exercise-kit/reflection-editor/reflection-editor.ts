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
 *
 * The debounce only ever *asks* to save — this component has no visibility into whether the
 * write actually landed (a read-only tab's `DocumentStore.update()` returns `false`). So it never
 * sets `status` to `'saved'` itself; the caller calls `reportSaveOutcome()` once it knows the real
 * result (review finding on this PR), the same "container knows, presentational component is
 * told" split the rest of this kit follows.
 *
 * `promptId` (issue #212) lets a page's own visible question — a `.field-prompt` it renders right
 * before this component, outside its template — reach the textarea's `aria-describedby` without
 * this component needing to know the question's text: the id is the caller's, this component just
 * adds it alongside its own status/hint id.
 */
@Component({
  selector: 'app-reflection-editor',
  imports: [MatFormFieldModule, MatInputModule, TranslocoPipe, AppDatePipe],
  templateUrl: './reflection-editor.html',
  styleUrl: './reflection-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReflectionEditor implements OnDestroy {
  private static nextInstanceId = 0;

  readonly value = input.required<string>();
  readonly label = input.required<string>();
  /** A worked example shown while the field is empty (issue #230's `label`/`prompt`/`placeholder`
   * pattern) — never the only label. */
  readonly placeholder = input<string | null>(null);
  readonly updatedAt = input<string | null>(null);
  /** Opts into the session-scoped Saving/Saved status instead of the default character-count +
   * saved-at caption (issue #212) — see the class doc comment's scope call. */
  readonly sessionStatus = input(false);
  /** An id the caller's own `.field-prompt` question already has, added to the textarea's
   * `aria-describedby` alongside this component's own status/hint id (issue #212, review
   * finding). */
  readonly promptId = input<string | null>(null);
  /** Emits every keystroke at once, with no debounce and no "Saving…" (issue #217): for a record
   * that is still an unsaved draft, which must hold nothing back when the editor closes. The
   * caller's `reportSaveOutcome(true)` still shows "Saved" once the edit is stored. */
  readonly immediate = input(false);
  readonly valueChange = output<string>();

  /** Resyncs to `value()` whenever it changes externally (initial load, a sync from another tab),
   * but keeps its own writes in between — the caret-adjacent draft while the user is still typing,
   * ahead of the debounced `valueChange` this same edit will eventually emit. */
  protected readonly draft = linkedSignal(() => this.value());
  protected readonly characterCount = computed(() => this.draft().length);
  /** `null` until the first keystroke of this session; `'saving'` while the debounce is pending,
   * `'saved'` once the caller confirms the write landed (`reportSaveOutcome`). Only rendered when
   * `sessionStatus()` is `true`. */
  protected readonly status = signal<'saving' | 'saved' | null>(null);
  /** Own instance id, the same pattern `DoneToggle` uses (issue #215): two editors on one page
   * would otherwise share one `id`, and every textarea's `aria-describedby` would resolve to the
   * first editor's caption. */
  private readonly instanceId = ReflectionEditor.nextInstanceId++;
  protected readonly statusId = `reflection-status-${this.instanceId}`;
  protected readonly hintId = `reflection-hint-${this.instanceId}`;
  protected readonly describedBy = computed(() => {
    const ids = [this.promptId(), this.sessionStatus() ? this.statusId : this.hintId];
    return ids.filter((id) => id !== null).join(' ');
  });

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingSave = false;

  ngOnDestroy(): void {
    this.flush();
  }

  /** Emits a pending debounced edit now. For a caller about to change the record this editor
   * writes into (issue #56: "Finish test" must store a note typed within the debounce first). */
  flush(): void {
    clearTimeout(this.debounceTimer);
    if (this.pendingSave) {
      this.pendingSave = false;
      this.valueChange.emit(this.draft());
    }
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.draft.set(text);
    if (this.immediate()) {
      this.valueChange.emit(text);
      return;
    }
    this.pendingSave = true;
    this.status.set('saving');
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.pendingSave = false;
      this.valueChange.emit(this.draft());
    }, REFLECTION_DEBOUNCE_MS);
  }

  /** Called by the caller once it knows whether the debounced edit above was actually persisted
   * (`DocumentStore.update()`'s return) — never report "Saved" for a write a read-only tab
   * refused (review finding on this PR). Leaves `status` at `'saving'` on a refused write rather
   * than claiming a state that didn't happen; there's no copy for a third "not saved" caption. */
  reportSaveOutcome(saved: boolean): void {
    if (saved) {
      this.status.set('saved');
    }
  }
}
