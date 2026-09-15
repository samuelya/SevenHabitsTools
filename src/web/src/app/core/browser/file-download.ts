import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Downloads text content as a file. The only place that touches `Blob`/anchor download APIs
 * directly, so features that need it — the corrupt-data error page now, JSON export/import later
 * — can be tested without exercising real DOM download side effects.
 */
@Injectable({ providedIn: 'root' })
export class FileDownloader {
  private readonly document = inject(DOCUMENT);

  download(filename: string, content: string, mimeType = 'application/json'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = this.document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
