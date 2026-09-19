/** A swipe shorter than this never commits, however far it travels vertically — keeps a diagonal
 * drag that's mostly a page scroll from being misread as the start of a delete swipe (issue
 * #203's design check). */
const SWIPE_MIN_THRESHOLD_PX = 80;

/** The rest of the threshold scales with the row itself, so a delete swipe takes roughly the same
 * fraction of the gesture on a narrow phone and a wide tablet. */
const SWIPE_THRESHOLD_RATIO = 0.3;

/** How far, in pixels, a swipe on a row of `rowWidth` must travel before it commits (issue #203's
 * design check: "~30% of row width, min 80px"). */
export function swipeThreshold(rowWidth: number): number {
  return Math.max(SWIPE_MIN_THRESHOLD_PX, rowWidth * SWIPE_THRESHOLD_RATIO);
}

/** The direction a swipe must travel to open the confirm dialog: toward the row's own start edge
 * — left in LTR, right in Arabic RTL (issue #203's acceptance criteria). Read from the *row's*
 * computed `direction`, not a hardcoded sign, so a swipe stays correct however the page got its
 * direction (the `<html dir>` the shell sets, or a future per-row override). */
export function isTowardStart(dx: number, direction: 'ltr' | 'rtl'): boolean {
  return direction === 'rtl' ? dx > 0 : dx < 0;
}

/**
 * Whether an in-progress swipe, currently at `(dx, dy)` from where the pointer went down on a row
 * `rowWidth` pixels wide, has committed to opening the confirm dialog (issue #203's design check):
 * mostly horizontal (`|dx| > |dy|`), toward the row's start edge, and past `swipeThreshold()`. A
 * short, vertical or wrong-direction swipe never commits — vertical page scroll and picking a
 * different row both keep working.
 */
export function isSwipeToDelete(
  dx: number,
  dy: number,
  rowWidth: number,
  direction: 'ltr' | 'rtl',
): boolean {
  if (Math.abs(dx) <= Math.abs(dy)) {
    return false;
  }
  if (!isTowardStart(dx, direction)) {
    return false;
  }
  return Math.abs(dx) >= swipeThreshold(rowWidth);
}

/** Whether a gesture that has moved `(dx, dy)` from its start should lock into this directive's
 * own horizontal handling (and therefore keep tracking the pointer) rather than being left alone
 * as page scroll. A small slop before locking in avoids treating a barely-moved tap as a swipe
 * attempt in either direction. */
export function isHorizontalGesture(dx: number, dy: number, slopPx: number): boolean {
  if (Math.abs(dx) < slopPx && Math.abs(dy) < slopPx) {
    return false;
  }
  return Math.abs(dx) > Math.abs(dy);
}
