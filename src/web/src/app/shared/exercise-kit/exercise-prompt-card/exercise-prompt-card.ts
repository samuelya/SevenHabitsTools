import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * The opening card of an exercise: a single collapsed row by default that expands to a
 * paraphrased prompt, an optional chapter reference and an optional "why this matters" note
 * (issue #30, reworked by #185). Purely presentational — the calling feature passes
 * already-translated strings (its own Transloco scope), not keys, since this kit's own
 * `exercise-kit` scope only owns its generic chrome ("About this exercise", "Why this matters").
 * The exercise page itself renders the title once, as a visually hidden `h1`
 * (`ExercisePage`) — this card no longer repeats it (issue #184's "one title" decision).
 *
 * `expanded` is a `model()`, not a plain input, so the card manages its own collapse state when
 * no page binds it at all, while still letting `ExercisePage` collapse it imperatively on
 * entering focus mode (it holds a `contentChild` reference and calls `.set(false)` on it), and a
 * page bind `[(expanded)]` itself for its own extra control — all three are the same signal.
 */
@Component({
  selector: 'app-exercise-prompt-card',
  imports: [MatCardModule, MatIconModule, TranslocoPipe],
  templateUrl: './exercise-prompt-card.html',
  styleUrl: './exercise-prompt-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExercisePromptCard {
  readonly prompt = input.required<string>();
  readonly chapterReference = input<string | null>(null);
  /** Shows the "why this matters" note when set. */
  readonly whyItMatters = input<string | null>(null);
  /** Expanded on entering the page by default (owner decision on #184). */
  readonly expanded = model(true);

  protected toggle(): void {
    this.expanded.update((expanded) => !expanded);
  }
}
