import {
  ChangeDetectionStrategy,
  Component,
  ViewContainerRef,
  afterNextRender,
  inject,
  input,
  model,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExerciseGuideContent } from '../exercise-guide/exercise-guide';
import { ExerciseGuideOpener } from '../exercise-guide/exercise-guide-opener';

/**
 * The opening card of an exercise: a one-paragraph prompt and, once the exercise offers one, a
 * "Read more" button (issue #212) are always visible; "About this exercise" expands to "Why this
 * matters" and a `From: <chapter>` line (issue #30, reworked by #185 and #212). Purely
 * presentational — the calling feature passes already-translated strings (its own Transloco
 * scope), not keys, since this kit's own `exercise-kit` scope only owns its generic chrome
 * ("About this exercise", "Read more", "Why this matters"). The exercise page itself renders the
 * title once, as a visually hidden `h1` (`ExercisePage`) — this card no longer repeats it (issue
 * #184's "one title" decision).
 *
 * `expanded` is a `model()`, not a plain input, so the card manages its own collapse state when
 * no page binds it at all, while still letting `ExercisePage` collapse it imperatively on
 * entering focus mode (it holds a `contentChild` reference and calls `.set(false)` on it), and a
 * page bind `[(expanded)]` itself for its own extra control — all three are the same signal.
 * `collapsedByDefault` (issue #212) only sets that initial value, read once right after the first
 * render — not reactively (review finding on this PR): `PerceptionPage` ORs its own `isStarted()`
 * with the handset breakpoint, and `isStarted()` flips `false → true` on the very first keystroke
 * of the user's first edit, so an `effect` re-checking the input on every change would collapse the
 * card while the user is still typing into the field it just pulled out from under them. Reading it
 * once, after the first render (`afterNextRender`, the same one-shot pattern `ExercisePage` uses),
 * means only the value at mount matters; the user's own toggle keeps working afterwards exactly as
 * before, and no later change to `collapsedByDefault` is ever observed again.
 */
@Component({
  selector: 'app-exercise-prompt-card',
  imports: [MatCardModule, MatIconModule, TranslocoPipe],
  templateUrl: './exercise-prompt-card.html',
  styleUrl: './exercise-prompt-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExercisePromptCard {
  private readonly guideOpener = inject(ExerciseGuideOpener);
  private readonly viewContainerRef = inject(ViewContainerRef);

  readonly prompt = input.required<string>();
  readonly chapterReference = input<string | null>(null);
  /** Shows the "why this matters" note when set. */
  readonly whyItMatters = input<string | null>(null);
  /** Shows the "Read more" button, opening `ExerciseGuide` with this content, when set. */
  readonly guide = input<ExerciseGuideContent | null>(null);
  /** Expanded on entering the page by default (owner decision on #184), unless this is `true` on
   * the first change (issue #212's "started" rule). */
  readonly collapsedByDefault = input(false);
  readonly expanded = model(true);

  /** Guards `openGuide()` against a double-tap (review finding on this PR): `open()` is async, so
   * without this a second tap before the first dialog opens starts a second one — two dialogs,
   * two focus traps. */
  private guideOpening = false;

  constructor() {
    afterNextRender(() => {
      if (this.collapsedByDefault()) {
        this.expanded.set(false);
      }
    });
  }

  protected toggle(): void {
    this.expanded.update((expanded) => !expanded);
  }

  protected openGuide(): void {
    const content = this.guide();
    if (content !== null && !this.guideOpening) {
      this.guideOpening = true;
      void this.guideOpener
        .open(content, this.viewContainerRef)
        .finally(() => (this.guideOpening = false));
    }
  }
}
