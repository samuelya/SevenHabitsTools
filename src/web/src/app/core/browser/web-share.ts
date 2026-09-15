import { InjectionToken, inject } from '@angular/core';
import { WINDOW } from './window';

/** The slice of the Web Share API `DocumentImportExportService` needs: sharing a file (the
 * export), nothing else. `null` in browsers (and the unit-test `jsdom` environment) without
 * `navigator.share`/`canShare`. Export always downloads by default regardless (`FileDownloader`);
 * this only backs the separate, explicit "Share…" action `canShare`/`shareDocument()` offer
 * (#154: never substitute a download with a share sheet automatically). */
export interface WebShareApi {
  canShareFiles(files: readonly File[]): boolean;
  share(files: readonly File[]): Promise<void>;
}

class NavigatorWebShareApi implements WebShareApi {
  constructor(private readonly navigator: Navigator) {}

  canShareFiles(files: readonly File[]): boolean {
    return (
      typeof this.navigator.canShare === 'function' &&
      this.navigator.canShare({ files: [...files] })
    );
  }

  async share(files: readonly File[]): Promise<void> {
    await this.navigator.share({ files: [...files] });
  }
}

export const WEB_SHARE = new InjectionToken<WebShareApi | null>('WEB_SHARE', {
  providedIn: 'root',
  factory: () => {
    const navigator = inject(WINDOW).navigator;
    return typeof navigator.share === 'function' ? new NavigatorWebShareApi(navigator) : null;
  },
});
