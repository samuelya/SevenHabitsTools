import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwipeToDeleteDirective } from './swipe-to-delete.directive';

@Component({
  imports: [SwipeToDeleteDirective],
  template: `
    <div
      #row
      class="row"
      [style.direction]="direction"
      style="inline-size: 300px;"
      [appSwipeToDeleteDisabled]="disabled"
      appSwipeToDelete
      (swiped)="swipedCount = swipedCount + 1"
    >
      <button type="button" (click)="rowClicked = true">select</button>
    </div>
  `,
})
class HostComponent {
  direction: 'ltr' | 'rtl' = 'ltr';
  disabled = false;
  swipedCount = 0;
  rowClicked = false;
}

/** `HTMLElement.getBoundingClientRect()` is always zero-sized in jsdom, so `rowWidth` (used for
 * `swipeThreshold()`) is stubbed to a realistic row width — the directive itself, not the
 * threshold math (covered by `swipe-to-delete.logic.spec.ts`), is what this spec exercises. Every
 * input the directive reads (`direction`, `disabled`) is set before the fixture's one
 * `detectChanges()` call, not mutated afterwards — this project's zoneless change detection only
 * re-checks a binding on an explicit `detectChanges()`/scheduler tick, so setting up state and
 * then triggering CD are kept as one step per test, the same shape every other spec here uses. */
function setUp(
  options: { direction?: 'ltr' | 'rtl'; disabled?: boolean; rowWidth?: number } = {},
): {
  fixture: ComponentFixture<HostComponent>;
  row: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.direction = options.direction ?? 'ltr';
  fixture.componentInstance.disabled = options.disabled ?? false;
  fixture.detectChanges();
  const row = fixture.nativeElement.querySelector('.row') as HTMLElement;
  vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
    width: options.rowWidth ?? 300,
  } as DOMRect);
  return { fixture, row };
}

function pointer(
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType = 'touch',
): PointerEvent {
  return new PointerEvent(type, { pointerId, clientX, clientY, pointerType, bubbles: true });
}

describe('SwipeToDeleteDirective', () => {
  it('emits swiped on a long, horizontal, start-ward (leftward, LTR) touch swipe', () => {
    const { fixture, row } = setUp();

    row.dispatchEvent(pointer('pointerdown', 1, 200, 100));
    row.dispatchEvent(pointer('pointermove', 1, 40, 102));
    row.dispatchEvent(pointer('pointerup', 1, 40, 102));

    expect(fixture.componentInstance.swipedCount).toBe(1);
  });

  it('does not emit on a short swipe', () => {
    const { fixture, row } = setUp();

    row.dispatchEvent(pointer('pointerdown', 1, 200, 100));
    row.dispatchEvent(pointer('pointermove', 1, 170, 101));
    row.dispatchEvent(pointer('pointerup', 1, 170, 101));

    expect(fixture.componentInstance.swipedCount).toBe(0);
  });

  it('does not emit on a mostly vertical drag', () => {
    const { fixture, row } = setUp();

    row.dispatchEvent(pointer('pointerdown', 1, 200, 100));
    row.dispatchEvent(pointer('pointermove', 1, 150, 260));
    row.dispatchEvent(pointer('pointerup', 1, 150, 260));

    expect(fixture.componentInstance.swipedCount).toBe(0);
  });

  it('does not emit swiping toward the end edge (rightward) in LTR', () => {
    const { fixture, row } = setUp();

    row.dispatchEvent(pointer('pointerdown', 1, 50, 100));
    row.dispatchEvent(pointer('pointermove', 1, 210, 101));
    row.dispatchEvent(pointer('pointerup', 1, 210, 101));

    expect(fixture.componentInstance.swipedCount).toBe(0);
  });

  it('mirrors direction under RTL: a rightward swipe commits', () => {
    const { fixture, row } = setUp({ direction: 'rtl' });

    row.dispatchEvent(pointer('pointerdown', 1, 50, 100));
    row.dispatchEvent(pointer('pointermove', 1, 210, 101));
    row.dispatchEvent(pointer('pointerup', 1, 210, 101));

    expect(fixture.componentInstance.swipedCount).toBe(1);
  });

  it('ignores a mouse drag — touch only', () => {
    const { fixture, row } = setUp();

    row.dispatchEvent(pointer('pointerdown', 1, 200, 100, 'mouse'));
    row.dispatchEvent(pointer('pointermove', 1, 40, 102, 'mouse'));
    row.dispatchEvent(pointer('pointerup', 1, 40, 102, 'mouse'));

    expect(fixture.componentInstance.swipedCount).toBe(0);
  });

  it('does nothing while disabled (a row with nothing to delete)', () => {
    const { fixture, row } = setUp({ disabled: true });

    row.dispatchEvent(pointer('pointerdown', 1, 200, 100));
    row.dispatchEvent(pointer('pointermove', 1, 40, 102));
    row.dispatchEvent(pointer('pointerup', 1, 40, 102));

    expect(fixture.componentInstance.swipedCount).toBe(0);
  });

  it('suppresses the click that follows a committed swipe, so the row is never also selected', () => {
    const { fixture, row } = setUp();

    row.dispatchEvent(pointer('pointerdown', 1, 200, 100));
    row.dispatchEvent(pointer('pointermove', 1, 40, 102));
    row.dispatchEvent(pointer('pointerup', 1, 40, 102));
    row.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fixture.componentInstance.rowClicked).toBe(false);
  });

  it('stops suppressing once a new gesture starts, so a later tap still selects the row (e.g. after Cancel on the confirm dialog)', () => {
    const { fixture, row } = setUp();

    row.dispatchEvent(pointer('pointerdown', 1, 200, 100));
    row.dispatchEvent(pointer('pointermove', 1, 40, 102));
    row.dispatchEvent(pointer('pointerup', 1, 40, 102));
    // A new gesture (e.g. the next tap, after the confirm dialog's own Cancel) clears the
    // suppression left over from the swipe that opened it.
    row.dispatchEvent(pointer('pointerdown', 2, 200, 100));
    row.dispatchEvent(pointer('pointerup', 2, 200, 100));
    row.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fixture.componentInstance.rowClicked).toBe(true);
  });

  it('leaves an uncommitted gesture free to still click-select the row', () => {
    const { fixture, row } = setUp();

    row.dispatchEvent(pointer('pointerdown', 1, 200, 100));
    row.dispatchEvent(pointer('pointermove', 1, 170, 101));
    row.dispatchEvent(pointer('pointerup', 1, 170, 101));
    row.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fixture.componentInstance.rowClicked).toBe(true);
  });
});
