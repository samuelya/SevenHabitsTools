import { Signal, computed } from '@angular/core';
import { translateObjectSignal } from '@jsverse/transloco';
import { ExerciseGuideContent } from './exercise-guide';

/**
 * The `guide` key of an exercise's own Transloco scope as `ExercisePromptCard`'s `[guide]` input
 * (issue #212's "Data model", playbook §8): the whole object at once, since its shape (an array of
 * How-to steps, an array of examples) doesn't fit `translateSignal`'s flat-key-list API, and
 * reactive to a language switch the same way `translateSignal` is.
 *
 * `null` until the scope has actually loaded: `translateObjectSignal` starts at `{}`, which a cast
 * alone makes look like real content, so "Read more" would appear (and open an empty dialog)
 * before the scope loads. Gating on `howTo.length` also keeps a scope with no `guide` key at
 * `null`. Call it in an injection context (a field initializer).
 */
export function exerciseGuideSignal(scope: string): Signal<ExerciseGuideContent | null> {
  const translation = translateObjectSignal('guide', undefined, scope);
  return computed(() => {
    const content = translation() as unknown as ExerciseGuideContent;
    return content.howTo?.length ? content : null;
  });
}
