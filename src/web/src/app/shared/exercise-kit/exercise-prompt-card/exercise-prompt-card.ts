import {
  ChangeDetectionStrategy,
  Component,
  ViewContainerRef,
  effect,
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
 * `collapsedByDefault` (issue #212) only sets that initial value, once, the first time it becomes
 * `true` — a page like `PerceptionPage` passes its own `isStarted()` so a returning user sees the
 * card collapsed, while the user's own toggle keeps working afterwards exactly as before (it never
 * fights a later toggle, since the write only ever happens on that one `false` → `true` edge).
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

  private appliedCollapsedByDefault = false;

  constructor() {
    effect(() => {
      if (this.collapsedByDefault() && !this.appliedCollapsedByDefault) {
        this.appliedCollapsedByDefault = true;
        this.expanded.set(false);
      }
    });
  }

  protected toggle(): void {
    this.expanded.update((expanded) => !expanded);
  }

  protected openGuide(): void {
    const content = this.guide();
    if (content !== null) {
      void this.guideOpener.open(content, this.viewContainerRef);
    }
  }
}
