import { TestBed } from '@angular/core/testing';
import { WINDOW } from '../browser/window';
import { InstallPromptService } from './install-prompt.service';

class FakeEventTarget {
  private readonly listeners = new Map<string, (event: unknown) => void>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.set(type, listener as (event: unknown) => void);
  }

  removeEventListener(type: string): void {
    this.listeners.delete(type);
  }

  dispatch(type: string, event: unknown = { type }): void {
    this.listeners.get(type)?.(event);
  }
}

function fakeBeforeInstallPromptEvent(outcome: 'accepted' | 'dismissed') {
  return {
    type: 'beforeinstallprompt',
    preventDefault: vi.fn(),
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  };
}

function setUp(): { service: InstallPromptService; fakeWindow: FakeEventTarget } {
  const fakeWindow = new FakeEventTarget();
  TestBed.configureTestingModule({
    providers: [{ provide: WINDOW, useValue: fakeWindow }],
  });
  return { service: TestBed.inject(InstallPromptService), fakeWindow };
}

describe('InstallPromptService', () => {
  it('reports no install available before beforeinstallprompt fires', () => {
    const { service } = setUp();
    expect(service.canInstall()).toBe(false);
  });

  it('captures beforeinstallprompt, suppressing the default mini-infobar', () => {
    const { service, fakeWindow } = setUp();
    service.start();
    const event = fakeBeforeInstallPromptEvent('accepted');

    fakeWindow.dispatch('beforeinstallprompt', event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(service.canInstall()).toBe(true);
  });

  it('resolves promptInstall to "unavailable" when nothing was captured', async () => {
    const { service } = setUp();
    service.start();

    await expect(service.promptInstall()).resolves.toBe('unavailable');
  });

  it('replays a captured prompt and resolves to its outcome, then clears it', async () => {
    const { service, fakeWindow } = setUp();
    service.start();
    const event = fakeBeforeInstallPromptEvent('accepted');
    fakeWindow.dispatch('beforeinstallprompt', event);

    await expect(service.promptInstall()).resolves.toBe('accepted');

    expect(event.prompt).toHaveBeenCalled();
    expect(service.canInstall()).toBe(false);
  });

  it('marks installed and drops a pending prompt on appinstalled', () => {
    const { service, fakeWindow } = setUp();
    service.start();
    fakeWindow.dispatch('beforeinstallprompt', fakeBeforeInstallPromptEvent('accepted'));

    fakeWindow.dispatch('appinstalled');

    expect(service.installed()).toBe(true);
    expect(service.canInstall()).toBe(false);
  });

  it('start() is idempotent', () => {
    const { service, fakeWindow } = setUp();
    service.start();
    service.start();

    fakeWindow.dispatch('beforeinstallprompt', fakeBeforeInstallPromptEvent('accepted'));

    expect(service.canInstall()).toBe(true);
  });
});
