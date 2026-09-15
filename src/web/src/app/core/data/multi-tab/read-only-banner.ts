import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Labels } from '../../i18n/labels';
import { WRITER_LOCK } from './writer-lock';

/**
 * Persistent banner telling the user this tab is read-only because another tab holds the write
 * lock (`role() === 'reader'`); renders nothing while the lock request is still `pending` (a
 * moment at startup, when the message would usually be wrong) or once this tab is the writer.
 * Purely a read of `WRITER_LOCK`
 * and `Labels` — it has no `start()`/lifecycle of its own, unlike the services that actually
 * acquire the lock or act on it.
 */
@Component({
  selector: 'app-read-only-banner',
  template: `
    @if (role() === 'reader') {
      <div class="read-only-banner" role="status" aria-live="polite">
        <span class="material-symbols-outlined" aria-hidden="true">lock</span>
        {{ labels.text('data.readOnly.banner') }}
      </div>
    }
  `,
  styles: `
    .read-only-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-block: 0.5rem;
      padding-inline: 1rem;
      background-color: var(--mat-sys-error-container, #fdecea);
      color: var(--mat-sys-on-error-container, #611a15);
      font-size: 0.875rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadOnlyBanner {
  protected readonly labels = inject(Labels);
  protected readonly role = inject(WRITER_LOCK).role;
}
