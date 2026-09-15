import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { featureStore } from '../data/feature-store';
import { CLOCK } from '../time/clock';
import { WINDOW } from '../browser/window';
import { Labels } from '../i18n/labels';
import { isIosSafari, shouldShowInstallBanner } from './install-prompt.logic';
import { InstallPromptService } from './install-prompt.service';
import { PWA_MODEL_KEY, PwaSettings } from './pwa.model';

/**
 * Dismissable install banner: a native "Install" action once Chromium has captured
 * `beforeinstallprompt` (`InstallPromptService`), or brief "Add to Home Screen" guidance on iOS
 * Safari, which never fires that event. Renders nothing once installed, on any other browser, or
 * within `INSTALL_PROMPT_SNOOZE_DAYS` of a dismissal (`install-prompt.logic.ts`). The container
 * role here is small enough that it reads and writes its own slice directly rather than splitting
 * into separate container/presentational components (`ReadOnlyBanner`, `SaveErrorNotifier`
 * likewise don't split).
 */
@Component({
  selector: 'app-pwa-install-banner',
  imports: [MatButtonModule],
  template: `
    @if (visibility(); as visible) {
      <div class="pwa-install-banner" role="status" aria-live="polite">
        <span class="material-symbols-outlined" aria-hidden="true">install_mobile</span>
        <span class="pwa-install-banner__message">
          {{
            labels.text(
              visible === 'ios-hint' ? 'data.pwa.install.iosHint' : 'data.pwa.install.message'
            )
          }}
        </span>
        <div class="pwa-install-banner__actions">
          @if (visible === 'installable') {
            <button mat-button type="button" (click)="install()">
              {{ labels.text('data.pwa.install.action') }}
            </button>
          }
          <button mat-button type="button" (click)="dismiss()">
            {{ labels.text('data.snackbar.dismiss') }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .pwa-install-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-block: 0.5rem;
      padding-inline: 1rem;
      background-color: var(--mat-sys-secondary-container, #dae2f9);
      color: var(--mat-sys-on-secondary-container, #131c2b);
      font-size: 0.875rem;
    }

    .pwa-install-banner__message {
      flex: 1 1 auto;
    }

    .pwa-install-banner__actions {
      display: flex;
      gap: 0.25rem;
      flex: 0 0 auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaInstallBanner {
  protected readonly labels = inject(Labels);
  private readonly window = inject(WINDOW);
  private readonly clock = inject(CLOCK);
  private readonly installPrompt = inject(InstallPromptService);
  private readonly settings = featureStore<PwaSettings>(PWA_MODEL_KEY);

  private readonly snoozed = computed(
    () =>
      !shouldShowInstallBanner(this.settings.value().installPromptDismissedAt, this.clock.now()),
  );

  private readonly isIosHintEligible = (): boolean =>
    isIosSafari(this.window.navigator.userAgent, this.window.navigator.maxTouchPoints) &&
    !this.window.matchMedia('(display-mode: standalone)').matches;

  /** `null` when nothing should show; otherwise which variant (native install vs. iOS hint). */
  protected readonly visibility = computed<'installable' | 'ios-hint' | null>(() => {
    if (this.installPrompt.installed() || this.snoozed()) {
      return null;
    }
    if (this.installPrompt.canInstall()) {
      return 'installable';
    }
    return this.isIosHintEligible() ? 'ios-hint' : null;
  });

  protected async install(): Promise<void> {
    const outcome = await this.installPrompt.promptInstall();
    if (outcome !== 'unavailable') {
      // Accepted or dismissed from the native prompt: either way, that answers the question this
      // banner was asking, so it shouldn't ask again immediately.
      this.recordDismissal();
    }
  }

  protected dismiss(): void {
    this.recordDismissal();
  }

  private recordDismissal(): void {
    this.settings.update((current) => ({
      ...current,
      installPromptDismissedAt: this.clock.now().toISOString(),
    }));
  }
}
