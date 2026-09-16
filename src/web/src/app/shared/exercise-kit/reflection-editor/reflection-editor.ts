import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../../core/i18n/locale.pipe';

/** How long to wait after the last keystroke before `ReflectionEditor` emits `valueChange`. */
export const REFLECTION_DEBOUNCE_MS = 1000;

/**
 * A multiline reflection field with a 1 s autosave debounce, a character count and a "saved at"
 * caption (issue #30). Purely presentational: `value`/`updatedAt` are inputs, `valueChange` is
 * the debounced edit — the caller (a container page, through its own `featureStore`) decides how
 * and where to persist it.
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
  readonly valueChange = output<string>();

  /** Resyncs to `value()` whenever it changes externally (initial load, a sync from another tab),
   * but keeps its own writes in between — the caret-adjacent draft while the user is still typing,
   * ahead of the debounced `valueChange` this same edit will eventually emit. */
  protected readonly draft = linkedSignal(() => this.value());
  protected readonly characterCount = computed(() => this.draft().length);

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  ngOnDestroy(): void {
    clearTimeout(this.debounceTimer);
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.draft.set(text);
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(
      () => this.valueChange.emit(this.draft()),
      REFLECTION_DEBOUNCE_MS,
    );
  }
}
