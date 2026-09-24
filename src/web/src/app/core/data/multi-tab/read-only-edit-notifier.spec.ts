import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppSnackbar } from '../../layout/app-snackbar';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { DocumentStore } from '../document.store';
import { READ_ONLY_EDIT_SNACKBAR_MS, ReadOnlyEditNotifier } from './read-only-edit-notifier';
import { WRITER_LOCK } from './writer-lock';
import { WriterRole } from './writer-role-state';

function setUp(role: WriterRole): {
  notifier: ReadOnlyEditNotifier;
  refusedEdits: ReturnType<typeof signal<number>>;
  open: ReturnType<typeof vi.fn>;
} {
  const refusedEdits = signal(0);
  const open = vi.fn().mockResolvedValue(undefined);
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      { provide: DocumentStore, useValue: { refusedEdits } as unknown as DocumentStore },
      { provide: WRITER_LOCK, useValue: { role: signal(role), isWriter: signal(false) } },
      { provide: AppSnackbar, useValue: { open } },
    ],
  });
  return { notifier: TestBed.inject(ReadOnlyEditNotifier), refusedEdits, open };
}

describe('ReadOnlyEditNotifier', () => {
  it('shows nothing until an edit is refused', () => {
    const { notifier, open } = setUp('reader');

    notifier.start();
    TestBed.tick();

    expect(open).not.toHaveBeenCalled();
  });

  it('#127: tells a read-only tab its edit was not made, with a dismiss action', () => {
    const { notifier, refusedEdits, open } = setUp('reader');
    notifier.start();
    TestBed.tick();

    refusedEdits.set(1);
    TestBed.tick();

    expect(open).toHaveBeenCalledTimes(1);
    const [message, action, config] = open.mock.calls[0]!;
    expect(message).toContain('read-only');
    expect(action).toBe('Dismiss');
    expect(config).toEqual({ duration: READ_ONLY_EDIT_SNACKBAR_MS });
  });

  it('#127: tells a tab whose lock is still pending to try again in a moment', () => {
    const { notifier, refusedEdits, open } = setUp('pending');
    notifier.start();
    TestBed.tick();

    refusedEdits.set(1);
    TestBed.tick();

    expect(open.mock.calls[0]![0]).toContain('Try that again');
  });

  it('does not report edits refused before it started', () => {
    const { notifier, refusedEdits, open } = setUp('reader');
    refusedEdits.set(2);

    notifier.start();
    TestBed.tick();

    expect(open).not.toHaveBeenCalled();
  });
});
