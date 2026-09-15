import { Injectable, Signal, signal } from '@angular/core';
import { SchemaVersionTooNewError } from './migrations/migrate-document';

export type DocumentBootstrapState = 'ready' | 'corrupt';

/**
 * The outcome of loading the document on startup. `document-bootstrap.ts` writes it; `App`
 * (which one to render, the shell or the error page) and `DataErrorPage` (the raw data to export,
 * the message to show) read it. Kept separate from `DocumentStore` and from the bootstrap
 * function itself so each has one reason to change.
 */
@Injectable({ providedIn: 'root' })
export class DocumentBootstrapStatus {
  private readonly stateSignal = signal<DocumentBootstrapState>('ready');
  private readonly rawSignal = signal<unknown>(null);
  private readonly messageKeySignal = signal<string | null>(null);

  readonly state: Signal<DocumentBootstrapState> = this.stateSignal.asReadonly();
  /** The data that could not be loaded, for the error page's export action; `null` when there is none. */
  readonly raw: Signal<unknown> = this.rawSignal.asReadonly();
  /** A Labels/Transloco key describing why loading failed. */
  readonly messageKey: Signal<string | null> = this.messageKeySignal.asReadonly();

  reportReady(): void {
    this.rawSignal.set(null);
    this.messageKeySignal.set(null);
    this.stateSignal.set('ready');
  }

  reportCorrupt(raw: unknown, error: unknown): void {
    this.rawSignal.set(raw);
    this.messageKeySignal.set(
      error instanceof SchemaVersionTooNewError ? error.message : 'data.bootstrap.corrupt',
    );
    this.stateSignal.set('corrupt');
  }
}
