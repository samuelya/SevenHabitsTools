import { BreakpointObserver } from '@angular/cdk/layout';
import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HANDSET_QUERY } from '../../../core/layout/breakpoints';

/**
 * The value an exercise page binds to `ExercisePromptCard`'s `collapsedByDefault` (issues #212,
 * #216): collapsed once the exercise is `started`, and on a phone always collapsed, since the
 * expanded card alone pushes the primary action below the fold at 360×800 (measured on #216:
 * teach's first chapter at 768px against a 735px scroll port). Desktop/tablet keeps the literal
 * "expanded until started" rule. Call it from a component field initializer (it `inject()`s).
 */
export function introCollapsedByDefault(started: Signal<boolean>): Signal<boolean> {
  const breakpoints = inject(BreakpointObserver);
  const handset = toSignal(breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)), {
    initialValue: breakpoints.isMatched(HANDSET_QUERY),
  });
  return computed(() => started() || handset());
}
