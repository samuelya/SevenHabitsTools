import { BreakpointObserver } from '@angular/cdk/layout';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
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
  private readonly document = inject(DOCUMENT);

  /** Whether `[detail]` content is currently projected/selected. */
  readonly hasDetail = input.required<boolean>();
  /** Emitted when the drawer should close: the close button, a backdrop tap, or Escape. */
  readonly closed = output<void>();

  private readonly closeButton = viewChild.required<unknown, ElementRef<HTMLButtonElement>>(
    'closeButton',
    { read: ElementRef },
  );

  protected readonly handset = toSignal(
    this.breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(HANDSET_QUERY) },
  );

  /** The element focused before this opened the drawer, to restore on close (issue #174). */
  private triggerElement: HTMLElement | null = null;
  private wasOpen = false;

  constructor() {
    // `[opened]` is bound one-way from `hasDetail`, not driven through `drawer.open()`, so
    // MatDrawer's own autoFocus (gated behind its opening transition actually completing, see
    // `MatDrawer#_takeFocus`) can miss a reopen. Owning focus here instead makes it independent of
    // that animation coupling. Only handset mode is a full-screen overlay over the triggering list
    // item (see `exercise-detail.scss`), so on desktop's persistent side panel this leaves focus
    // alone, matching `MatDrawer`'s own non-modal `autoFocus` default. Focus is captured here
    // *before* moving it into the close button and restored explicitly on close rather than left
    // to `MatDrawer`'s own restore, because that mechanism reads `document.activeElement` only
    // after this effect has already moved it.
    effect(() => {
      const handset = this.handset();
      const open = this.hasDetail();
      if (handset) {
        if (open && !this.wasOpen) {
          this.triggerElement = this.document.activeElement as HTMLElement | null;
          this.closeButton().nativeElement.focus();
        } else if (!open && this.wasOpen) {
          this.triggerElement?.focus();
          this.triggerElement = null;
        }
      }
      this.wasOpen = open;
    });
  }

  protected onOpenedChange(opened: boolean): void {
    if (!opened) {
      this.closed.emit();
    }
  }
}
