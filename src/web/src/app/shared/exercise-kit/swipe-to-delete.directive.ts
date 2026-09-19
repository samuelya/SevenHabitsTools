import { Directive, DestroyRef, ElementRef, inject, input, output } from '@angular/core';
import { WINDOW } from '../../core/browser/window';
import { isHorizontalGesture, isSwipeToDelete } from './swipe-to-delete.logic';

/** Below this, in either axis, a gesture is still a tap or barely-moved drag — not yet clearly
 * horizontal or vertical (issue #203's design check). */
const LOCK_SLOP_PX = 10;

/** How long the row's own snap-back animation runs — skipped under `prefers-reduced-motion`
 * (architecture issue #1 §7). */
const SNAP_BACK_MS = 150;

/** Ceiling on how long a committed swipe's click-suppression can outlive the gesture. A touch
 * drag never fires a synthetic click in the first place (only a mouse drag does — Chrome/Safari),
 * so in the touch case this flag is normally consumed by the very next `pointerdown` instead; this
 * timeout is just a backstop so it can never survive to swallow an unrelated later tap, e.g. one
 * made after the confirm dialog's own Cancel (review finding on #204's PR). */
const SUPPRESS_CLICK_MS = 500;

/**
 * Swipe-to-delete for one list row (issue #203). Applied to the row's own wrapper element, the
 * sibling of the row's select button and its trailing bin button (playbook's "Deleting entries").
 * Pointer Events with `touch-action: pan-y` on the host: the browser keeps native vertical
 * scrolling for a vertical drag, and this directive only ever tracks a drag once it is clearly
 * horizontal, so a swipe can never also scroll the page (issue #203's design-check comment).
 * Touch only, by design — a mouse or pen drag leaves text selection and other desktop gestures
 * alone; desktop/keyboard users get the same delete through the row's own bin button instead.
 *
 * Emits `swiped` once a gesture commits (`isSwipeToDelete()`); it never opens anything itself —
 * the caller (`ExerciseList`/`AssessmentHistoryList`) reacts the same way a bin-button click does,
 * so confirm-and-delete has exactly one path regardless of trigger.
 */
@Directive({
  selector: '[appSwipeToDelete]',
  host: {
    style: 'touch-action: pan-y;',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerCancel($event)',
  },
})
export class SwipeToDeleteDirective {
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly window = inject(WINDOW);

  /** Disabled for a row with nothing to delete (e.g. `paradigms-teach`'s chapters that have no
   * entry yet — playbook's "Deleting entries"). */
  readonly appSwipeToDeleteDisabled = input(false);

  readonly swiped = output<void>();

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private horizontal = false;
  private suppressNextClick = false;
  private suppressClickTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // A capture-phase listener, not the `(click)` host binding: a committed swipe's `pointerup`
    // still fires a synthetic `click` on whatever is under the pointer — the row's own select
    // button, most likely — and that button's *own* click handler runs before a bubble-phase
    // listener on this wrapper ever would. Capturing here, above the button, and calling
    // `stopPropagation()` is what keeps a swipe from also selecting/opening the row (issue #203's
    // acceptance criteria).
    this.el.addEventListener('click', this.onCapturedClick, true);
    inject(DestroyRef).onDestroy(() => {
      this.el.removeEventListener('click', this.onCapturedClick, true);
      this.clearSuppressNextClick();
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    // Any new gesture — touch or not, on this row or elsewhere — means the tap a committed swipe
    // was meant to suppress has already happened or never will; clear it up front rather than
    // letting it swallow this one (review finding on #204's PR).
    this.clearSuppressNextClick();
    if (event.pointerType !== 'touch' || this.appSwipeToDeleteDisabled()) {
      return;
    }
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.horizontal = false;
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    if (!this.horizontal) {
      if (!isHorizontalGesture(dx, dy, LOCK_SLOP_PX)) {
        if (Math.abs(dy) >= LOCK_SLOP_PX) {
          // A vertical drag: this is the page scrolling, not a swipe attempt — stop tracking it
          // and let the browser's own `touch-action: pan-y` handling take it from here.
          this.reset();
        }
        return;
      }
      this.horizontal = true;
      this.capturePointer(event.pointerId);
    }
    this.el.style.transition = 'none';
    this.el.style.transform = `translateX(${dx}px)`;
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    const committed =
      this.horizontal &&
      isSwipeToDelete(dx, dy, this.el.getBoundingClientRect().width, this.direction());
    this.snapBack();
    this.reset();
    if (committed) {
      this.suppressNextClick = true;
      this.suppressClickTimer = setTimeout(() => this.clearSuppressNextClick(), SUPPRESS_CLICK_MS);
      this.swiped.emit();
    }
  }

  protected onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.snapBack();
    this.reset();
  }

  private readonly onCapturedClick = (event: MouseEvent): void => {
    if (this.suppressNextClick) {
      this.clearSuppressNextClick();
      event.stopPropagation();
      event.preventDefault();
    }
  };

  private clearSuppressNextClick(): void {
    this.suppressNextClick = false;
    if (this.suppressClickTimer !== undefined) {
      clearTimeout(this.suppressClickTimer);
      this.suppressClickTimer = undefined;
    }
  }

  private direction(): 'ltr' | 'rtl' {
    return getComputedStyle(this.el).direction === 'rtl' ? 'rtl' : 'ltr';
  }

  private snapBack(): void {
    // Guarded: `WINDOW`'s jsdom-backed `defaultView` in this project's unit tests doesn't
    // implement `matchMedia` unless a spec stubs it (`pwa-install-banner.spec.ts`'s own
    // `fakeWindow()`) — a real browser always has it, so this only ever skips reduced-motion
    // detection in a test double that doesn't care about the animation either way.
    const reduceMotion =
      typeof this.window.matchMedia === 'function' &&
      this.window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.el.style.transition = reduceMotion ? 'none' : `transform ${SNAP_BACK_MS}ms ease-out`;
    this.el.style.transform = 'translateX(0)';
  }

  private reset(): void {
    this.releasePointer();
    this.pointerId = null;
    this.horizontal = false;
  }

  /** Guarded, not called unconditionally: jsdom (this project's unit test environment) doesn't
   * implement `Element.setPointerCapture`/`releasePointerCapture`/`hasPointerCapture`, and a real
   * browser works exactly as well without the guard failing — it only ever skips a call jsdom
   * would otherwise throw on. */
  private capturePointer(pointerId: number): void {
    if (typeof this.el.setPointerCapture === 'function') {
      this.el.setPointerCapture(pointerId);
    }
  }

  private releasePointer(): void {
    if (
      this.pointerId !== null &&
      typeof this.el.hasPointerCapture === 'function' &&
      this.el.hasPointerCapture(this.pointerId)
    ) {
      this.el.releasePointerCapture(this.pointerId);
    }
  }
}
