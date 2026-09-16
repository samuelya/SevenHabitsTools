import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ONLINE_STATUS } from '../browser/online-status';

/**
 * Persistent banner telling the user the browser is offline, so a missing network doesn't read as
 * the app being broken (it works fully offline once loaded, per #27). Purely a read of
 * `ONLINE_STATUS`, styled and placed like `ReadOnlyBanner` — no `start()` of its own, the token
 * already keeps itself live.
 */
@Component({
  selector: 'app-offline-indicator',
  imports: [TranslocoPipe],
  template: `
    @if (!online()) {
      <div class="offline-indicator" role="status" aria-live="polite">
        <span class="material-symbols-outlined" aria-hidden="true">cloud_off</span>
        {{ 'data.pwa.offline' | transloco }}
      </div>
    }
  `,
  styles: `
    .offline-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-block: 0.5rem;
      padding-inline: 1rem;
      background-color: var(--mat-sys-surface-variant, #e1e2ec);
      color: var(--mat-sys-on-surface-variant, #44474e);
      font-size: 0.875rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflineIndicator {
  protected readonly online = inject(ONLINE_STATUS);
}
