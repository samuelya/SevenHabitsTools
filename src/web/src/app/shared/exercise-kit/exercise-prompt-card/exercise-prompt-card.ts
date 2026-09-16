import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * The opening card of an exercise: title, paraphrased prompt, an optional chapter reference and an
 * optional "why this matters" expander (issue #30). Purely presentational — the calling feature
 * passes already-translated strings (its own Transloco scope), not keys, since this kit's own
 * `exercise-kit` scope only owns its generic chrome ("Why this matters").
 */
@Component({
  selector: 'app-exercise-prompt-card',
  imports: [MatCardModule, MatExpansionModule, TranslocoPipe],
  templateUrl: './exercise-prompt-card.html',
  styleUrl: './exercise-prompt-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExercisePromptCard {
  readonly title = input.required<string>();
  readonly prompt = input.required<string>();
  readonly chapterReference = input<string | null>(null);
  /** Shows the "why this matters" expander when set. */
  readonly whyItMatters = input<string | null>(null);
}
