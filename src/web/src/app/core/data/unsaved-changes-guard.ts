import { Injectable, Injector, effect, inject } from '@angular/core';
import { WINDOW } from '../browser/window';
import { DocumentPersistence } from './document-persistence';

/**
 * Asks the browser to confirm before the tab is closed or reloaded while there are edits that
 * failed to save (`dirty` and `saveError`), since closing would lose them (#136). The
 * `beforeunload` listener is only registered while that is true, so the tab stays eligible for the
 * back/forward cache the rest of the time.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedChangesGuard {
  private readonly persistence = inject(DocumentPersistence);
  private readonly window = inject(WINDOW);
  private readonly injector = inject(Injector);

  private started = false;
  private listening = false;

  private readonly onBeforeUnload = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
    // Older browsers only prompt when `returnValue` is set.
    event.returnValue = '';
  };

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    effect(
      () => {
        const atRisk = this.persistence.dirty() && this.persistence.saveError() !== null;
        if (atRisk === this.listening) {
          return;
        }
        this.listening = atRisk;
        if (atRisk) {
          this.window.addEventListener('beforeunload', this.onBeforeUnload);
        } else {
          this.window.removeEventListener('beforeunload', this.onBeforeUnload);
        }
      },
      { injector: this.injector },
    );
  }
}
