import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ONLINE_STATUS } from '../browser/online-status';
import { OfflineIndicator } from './offline-indicator';

function render(online: ReturnType<typeof signal<boolean>>): {
  banner: () => HTMLElement | null;
  detectChanges: () => void;
} {
  TestBed.configureTestingModule({
    providers: [{ provide: ONLINE_STATUS, useValue: online.asReadonly() }],
  });
  const fixture = TestBed.createComponent(OfflineIndicator);
  fixture.detectChanges();
  return {
    banner: () => fixture.nativeElement.querySelector('.offline-indicator'),
    detectChanges: () => fixture.detectChanges(),
  };
}

describe('OfflineIndicator', () => {
  it('renders nothing while online', () => {
    expect(render(signal(true)).banner()).toBeNull();
  });

  it('shows a status banner while offline', () => {
    const banner = render(signal(false)).banner();

    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.textContent).toContain('offline');
  });

  it('hides again once back online', () => {
    const online = signal(false);
    const view = render(online);
    expect(view.banner()).not.toBeNull();

    online.set(true);
    view.detectChanges();

    expect(view.banner()).toBeNull();
  });
});
