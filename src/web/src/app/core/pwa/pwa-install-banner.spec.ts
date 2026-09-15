import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WINDOW } from '../browser/window';
import { CLOCK } from '../time/clock';
import { InstallPromptService } from './install-prompt.service';
import { PwaInstallBanner } from './pwa-install-banner';

const CHROME_ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14) Chrome/125.0 Mobile Safari/537.36';
const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

function fakeWindow(userAgent: string, standalone = false) {
  return {
    navigator: { userAgent, maxTouchPoints: 0 },
    matchMedia: () => ({ matches: standalone }),
  };
}

function fakeInstallPrompt(overrides: {
  canInstall?: boolean;
  installed?: boolean;
  promptInstall?: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}) {
  return {
    canInstall: signal(overrides.canInstall ?? false),
    installed: signal(overrides.installed ?? false),
    promptInstall: overrides.promptInstall ?? vi.fn().mockResolvedValue('unavailable'),
  };
}

function render(options: {
  window: ReturnType<typeof fakeWindow>;
  installPrompt: ReturnType<typeof fakeInstallPrompt>;
  now?: Date;
}) {
  TestBed.configureTestingModule({
    providers: [
      { provide: WINDOW, useValue: options.window },
      { provide: InstallPromptService, useValue: options.installPrompt },
      { provide: CLOCK, useValue: { now: () => options.now ?? new Date('2026-06-15T12:00:00Z') } },
    ],
  });
  const fixture = TestBed.createComponent(PwaInstallBanner);
  fixture.detectChanges();
  return {
    fixture,
    banner: () => fixture.nativeElement.querySelector('.pwa-install-banner'),
    installButton: (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelectorAll('button')[0] ?? null,
    dismissButton: (): HTMLButtonElement =>
      [...fixture.nativeElement.querySelectorAll('button')].at(-1) as HTMLButtonElement,
  };
}

describe('PwaInstallBanner', () => {
  it('renders nothing on a browser with neither the native prompt nor an iOS hint', () => {
    const view = render({
      window: fakeWindow(CHROME_ANDROID_UA),
      installPrompt: fakeInstallPrompt({ canInstall: false }),
    });
    expect(view.banner()).toBeNull();
  });

  it('shows the native install action once beforeinstallprompt was captured', () => {
    const view = render({
      window: fakeWindow(CHROME_ANDROID_UA),
      installPrompt: fakeInstallPrompt({ canInstall: true }),
    });
    expect(view.banner()).not.toBeNull();
    expect(view.installButton()?.textContent).toContain('Install');
  });

  it('shows the iOS hint on Safari when there is no native prompt', () => {
    const view = render({
      window: fakeWindow(IPHONE_SAFARI_UA),
      installPrompt: fakeInstallPrompt({ canInstall: false }),
    });
    expect(view.banner()?.textContent).toContain('Add to Home Screen');
  });

  it('renders nothing once already running standalone on iOS', () => {
    const view = render({
      window: fakeWindow(IPHONE_SAFARI_UA, true),
      installPrompt: fakeInstallPrompt({ canInstall: false }),
    });
    expect(view.banner()).toBeNull();
  });

  it('renders nothing once installed, even if still "installable"', () => {
    const view = render({
      window: fakeWindow(CHROME_ANDROID_UA),
      installPrompt: fakeInstallPrompt({ canInstall: true, installed: true }),
    });
    expect(view.banner()).toBeNull();
  });

  it('prompts install and hides the banner on click, without re-showing this session', async () => {
    const promptInstall = vi.fn().mockResolvedValue('accepted');
    const view = render({
      window: fakeWindow(CHROME_ANDROID_UA),
      installPrompt: fakeInstallPrompt({ canInstall: true, promptInstall }),
    });

    view.installButton()!.click();
    await Promise.resolve();
    await Promise.resolve();
    view.fixture.detectChanges();

    expect(promptInstall).toHaveBeenCalled();
    expect(view.banner()).toBeNull();
  });

  it('dismissing hides the banner and it stays hidden within the snooze window', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const view = render({
      window: fakeWindow(CHROME_ANDROID_UA),
      installPrompt: fakeInstallPrompt({ canInstall: true }),
      now,
    });

    view.dismissButton().click();
    view.fixture.detectChanges();

    expect(view.banner()).toBeNull();
  });
});
