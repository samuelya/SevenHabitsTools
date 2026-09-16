import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSidenavModule } from '@angular/material/sidenav';
import { map } from 'rxjs';
import { HANDSET_QUERY } from '../../../core/layout/breakpoints';

/**
 * The "list/detail" half of the kit's list/detail pair (issue #30): on desktop, projected
 * `[detail]` content opens as a side drawer next to `[list]`; below 600 px (the same breakpoint
 * `Shell` uses for bottom navigation), the two swap in place of each other so mobile never shows a
 * cramped side-by-side layout. Purely presentational — `ExerciseList` reports the selection,
 * routing (or a local signal) decides `hasDetail`, and this component only lays the two out.
 */
@Component({
  selector: 'app-exercise-detail',
  imports: [MatSidenavModule],
  templateUrl: './exercise-detail.html',
  styleUrl: './exercise-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseDetail {
  private readonly breakpoints = inject(BreakpointObserver);

  /** Whether `[detail]` content is currently projected/selected. */
  readonly hasDetail = input.required<boolean>();

  protected readonly handset = toSignal(
    this.breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(HANDSET_QUERY) },
  );
}
