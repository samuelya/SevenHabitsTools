import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { BeforeInstallPromptEvent } from '../browser/install-prompt-event';
import { WINDOW } from '../browser/window';

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/**
 * Captures the Chromium `beforeinstallprompt` event so it can be replayed later from the banner's
 * own "Install" button instead of the browser's default mini-infobar, and tracks `appinstalled`.
 * Only the browser event plumbing and the native prompt call live here; deciding whether and when
 * to *show* a banner (the snooze, the iOS hint) is `install-prompt.logic.ts` and
 * `PwaInstallBanner`'s job, kept separate so this service stays a thin wrapper over one browser
 * API (interface segregation, and easy to fake in tests that don't care about the real event).
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly window = inject(WINDOW);

  private readonly capturedEventSignal = signal<BeforeInstallPromptEvent | null>(null);
  private readonly installedSignal = signal(false);

  /** Whether a `beforeinstallprompt` event is captured and ready to replay. */
  readonly canInstall: Signal<boolean> = computed(() => this.capturedEventSignal() !== null);
  /** Whether `appinstalled` has fired for this app on this device. */
  readonly installed: Signal<boolean> = this.installedSignal.asReadonly();

  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.window.addEventListener(
      'beforeinstallprompt',
      this.onBeforeInstallPrompt as EventListener,
    );
    this.window.addEventListener('appinstalled', this.onInstalled);
  }

  /** Replays the captured prompt. Resolves `'unavailable'`, without prompting, when nothing was
   * captured (unsupported browser, or a prompt already used once). */
  async promptInstall(): Promise<InstallOutcome> {
    const event = this.capturedEventSignal();
    if (!event) {
      return 'unavailable';
    }
    // A captured event can only be prompted once; drop it regardless of the outcome so a second
    // click can't replay a stale prompt.
    this.capturedEventSignal.set(null);
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  }

  private readonly onBeforeInstallPrompt = (event: Event): void => {
    // Suppresses the browser's own mini-infobar; the app's banner offers the same action instead.
    event.preventDefault();
    this.capturedEventSignal.set(event as BeforeInstallPromptEvent);
  };

  private readonly onInstalled = (): void => {
    this.installedSignal.set(true);
    this.capturedEventSignal.set(null);
  };
}
