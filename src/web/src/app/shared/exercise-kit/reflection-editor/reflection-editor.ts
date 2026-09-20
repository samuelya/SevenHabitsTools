import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

/** How long to wait after the last keystroke before `ReflectionEditor` emits `valueChange`. */
export const REFLECTION_DEBOUNCE_MS = 1000;

/**
 * A multiline reflection field with a 1 s autosave debounce (issue #30). Purely presentational:
 * `value`/`updatedAt` are inputs, `valueChange` is the debounced edit — the caller (a container
 * page, through its own `featureStore`) decides how and where to persist it.
 *
 * Shows no status at all until the first keystroke of this session (issue #212's "Save
 * vocabulary": a character count and a "not saved yet" caption next to an untouched field read as
 * noise, not information), then "Saving…"/"Saved" in the same style — and the same two generic
 * `exerciseKit.editor.*` keys — as `ExercisePage`'s own editor header status.
 */
@Component({
  selector: 'app-reflection-editor',
  imports: [MatFormFieldModule, MatInputModule, TranslocoPipe],
  templateUrl: './reflection-editor.html',
  styleUrl: './reflection-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReflectionEditor implements OnDestroy {
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly updatedAt = input<string | null>(null);
  readonly valueChange = output<string>();

  /** Resyncs to `value()` whenever it changes externally (initial load, a sync from another tab),
   * but keeps its own writes in between — the caret-adjacent draft while the user is still typing,
   * ahead of the debounced `valueChange` this same edit will eventually emit. */
  protected readonly draft = linkedSignal(() => this.value());
  /** `null` until the first keystroke of this session; `'saving'` while the debounce is pending,
   * `'saved'` once it has fired. */
  protected readonly status = signal<'saving' | 'saved' | null>(null);

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  ngOnDestroy(): void {
    clearTimeout(this.debounceTimer);
    if (this.status() === 'saving') {
      this.valueChange.emit(this.draft());
    }
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.draft.set(text);
    this.status.set('saving');
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.status.set('saved');
      this.valueChange.emit(this.draft());
    }, REFLECTION_DEBOUNCE_MS);
  }
}
