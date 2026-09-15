import { TestBed } from '@angular/core/testing';
import { WINDOW } from './window';
import { ONLINE_STATUS } from './online-status';

class FakeEventTarget {
  private readonly listeners = new Map<string, () => void>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.set(type, listener as () => void);
  }

  removeEventListener(type: string): void {
    this.listeners.delete(type);
  }

  dispatch(type: string): void {
    this.listeners.get(type)?.();
  }
}

function fakeWindow(onLine: boolean) {
  return Object.assign(new FakeEventTarget(), { navigator: { onLine } });
}

describe('ONLINE_STATUS', () => {
  it('starts from navigator.onLine', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: WINDOW, useValue: fakeWindow(false) }],
    });

    expect(TestBed.inject(ONLINE_STATUS)()).toBe(false);
  });

  it('flips to false on the offline event and back to true on online', () => {
    const win = fakeWindow(true);
    TestBed.configureTestingModule({ providers: [{ provide: WINDOW, useValue: win }] });
    const online = TestBed.inject(ONLINE_STATUS);
    expect(online()).toBe(true);

    win.dispatch('offline');
    expect(online()).toBe(false);

    win.dispatch('online');
    expect(online()).toBe(true);
  });
});
