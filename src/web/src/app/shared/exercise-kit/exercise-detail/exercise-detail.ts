import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { HANDSET_QUERY } from '../../../core/layout/breakpoints';

/**
 * The "list/detail" half of the kit's list/detail pair (issue #30): on desktop, projected
 * `[detail]` content opens as a side drawer next to `[list]`; below 600 px (the same breakpoint
 * `Shell` uses for bottom navigation), the two swap in place of each other so mobile never shows a
 * cramped side-by-side layout. Purely presentational — `ExerciseList` reports the selection,
 * routing (or a local signal) decides `hasDetail`, and this component only lays the two out.
 * `(closed)` is the caller's cue to clear that selection, both for the visible close button and
 * for Material's own backdrop-click/Escape handling — `[opened]` is bound one-way, so without it
 * the drawer has no way back to the list (issue #173).
 */
@Component({
  selector: 'app-exercise-detail',
  imports: [MatButtonModule, MatIconModule, MatSidenavModule, TranslocoPipe],
  templateUrl: './exercise-detail.html',
  styleUrl: './exercise-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseDetail {
  private readonly breakpoints = inject(BreakpointObserver);

  /** Whether `[detail]` content is currently projected/selected. */
  readonly hasDetail = input.required<boolean>();
  /** Emitted when the drawer should close: the close button, a backdrop tap, or Escape. */
  readonly closed = output<void>();

  protected readonly handset = toSignal(
    this.breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(HANDSET_QUERY) },
  );

  protected onOpenedChange(opened: boolean): void {
    if (!opened) {
      this.closed.emit();
    }
  }
}
