import { Injectable, Signal, signal } from '@angular/core';
import { SchemaVersionTooNewError } from './migrations/migrate-document';
import { StorageBlockedError } from './storage-adapter';

export type DocumentBootstrapState = 'ready' | 'corrupt' | 'blocked';

/**
 * The failure's own message key when it knows why loading failed and that the stored data is not
 * damaged — a document from a newer build (`SchemaVersionTooNewError`) — so the error page says
 * what actually happened instead of describing intact data as corrupt.
 */
function messageKeyFor(error: unknown): string {
  return error instanceof SchemaVersionTooNewError ? error.message : 'data.bootstrap.corrupt';
}

/**
 * The outcome of loading the document on startup. `document-bootstrap.ts` writes it; `App`
 * (which one to render, the shell or the error page) and `DataErrorPage` (the raw data to export,
 * the message to show, which recovery actions are safe) read it. Kept separate from `DocumentStore`
 * and from the bootstrap function itself so each has one reason to change.
 *
 * `blocked` is a separate state from `corrupt` rather than a variant of it because the stored data
 * is intact and will load once the blocker is gone (#139): nothing may offer corrupt-data recovery
 * — least of all the irreversible "Start fresh" — for a condition that resolves by itself. Only
 * `ready` means the document in `DocumentStore` reflects storage, so every "may I write?" check
 * asks for `ready` rather than listing the failure states.
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
    this.messageKeySignal.set(messageKeyFor(error));
    this.stateSignal.set('corrupt');
  }

  /** Storage is intact but held by something else; retrying later is the whole recovery. */
  reportBlocked(error: StorageBlockedError): void {
    this.rawSignal.set(null);
    this.messageKeySignal.set(error.message);
    this.stateSignal.set('blocked');
  }
}
