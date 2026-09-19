import {
  isHorizontalGesture,
  isSwipeToDelete,
  isTowardStart,
  swipeThreshold,
} from './swipe-to-delete.logic';

describe('swipeThreshold', () => {
  it('uses the 80px floor on a narrow row', () => {
    expect(swipeThreshold(100)).toBe(80);
  });

  it('scales at 30% of row width once that exceeds the floor', () => {
    expect(swipeThreshold(400)).toBe(120);
  });
});

describe('isTowardStart', () => {
  it('is a negative dx (left) in LTR', () => {
    expect(isTowardStart(-10, 'ltr')).toBe(true);
    expect(isTowardStart(10, 'ltr')).toBe(false);
  });

  it('is a positive dx (right) in RTL', () => {
    expect(isTowardStart(10, 'rtl')).toBe(true);
    expect(isTowardStart(-10, 'rtl')).toBe(false);
  });
});

describe('isHorizontalGesture', () => {
  it('is false until the gesture clears the slop in either axis', () => {
    expect(isHorizontalGesture(5, 5, 10)).toBe(false);
  });

  it('is true once dx dominates dy past the slop', () => {
    expect(isHorizontalGesture(20, 2, 10)).toBe(true);
  });

  it('is false once dy dominates, even past the slop', () => {
    expect(isHorizontalGesture(5, 20, 10)).toBe(false);
  });
});

describe('isSwipeToDelete', () => {
  it('commits on a long, horizontal, start-ward swipe in LTR', () => {
    expect(isSwipeToDelete(-150, 5, 360, 'ltr')).toBe(true);
  });

  it('does not commit on a short swipe, even in the right direction', () => {
    expect(isSwipeToDelete(-40, 2, 360, 'ltr')).toBe(false);
  });

  it('does not commit on a mostly vertical drag, however long', () => {
    expect(isSwipeToDelete(-150, 200, 360, 'ltr')).toBe(false);
  });

  it('does not commit swiping the wrong direction (end edge) in LTR', () => {
    expect(isSwipeToDelete(150, 5, 360, 'ltr')).toBe(false);
  });

  it('mirrors direction for RTL: a rightward swipe commits, a leftward one does not', () => {
    expect(isSwipeToDelete(150, 5, 360, 'rtl')).toBe(true);
    expect(isSwipeToDelete(-150, 5, 360, 'rtl')).toBe(false);
  });
});
