import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WINDOW } from '../browser/window';
import { DocumentPersistence } from './document-persistence';
import { UnsavedChangesGuard } from './unsaved-changes-guard';

function setUp() {
  const dirty = signal(false);
  const saveError = signal<unknown>(null);
  const listeners = new Set<(event: Event) => void>();
  const window = {
    addEventListener: vi.fn((_type: string, listener: (event: Event) => void) =>
      listeners.add(listener),
    ),
    removeEventListener: vi.fn((_type: string, listener: (event: Event) => void) =>
      listeners.delete(listener),
    ),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DocumentPersistence, useValue: { dirty, saveError } },
      { provide: WINDOW, useValue: window },
    ],
  });
  const guard = TestBed.inject(UnsavedChangesGuard);
  guard.start();
  TestBed.tick();

  /** Fires `beforeunload` at every registered listener; returns whether it was cancelled. */
  const unload = (): boolean => {
    const event = new Event('beforeunload', { cancelable: true });
    listeners.forEach((listener) => listener(event));
    return event.defaultPrevented;
  };
  return { guard, dirty, saveError, window, listeners, unload };
}

describe('UnsavedChangesGuard', () => {
  it('registers nothing while edits are saving normally', () => {
    const { dirty, window, unload } = setUp();

    dirty.set(true);
    TestBed.tick();

    expect(window.addEventListener).not.toHaveBeenCalled();
    expect(unload()).toBe(false);
  });

  it('#136: asks to confirm closing while there are edits that failed to save', () => {
    const { dirty, saveError, unload } = setUp();

    dirty.set(true);
    saveError.set(new Error('quota'));
    TestBed.tick();

    expect(unload()).toBe(true);
  });

  it('removes the prompt once the edits are saved', () => {
    const { dirty, saveError, window, listeners, unload } = setUp();
    dirty.set(true);
    saveError.set(new Error('quota'));
    TestBed.tick();

    saveError.set(null);
    dirty.set(false);
    TestBed.tick();

    expect(window.removeEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(listeners.size).toBe(0);
    expect(unload()).toBe(false);
  });

  it('start() is idempotent: one listener at most', () => {
    const { guard, dirty, saveError, listeners } = setUp();
    guard.start();

    dirty.set(true);
    saveError.set(new Error('quota'));
    TestBed.tick();

    expect(listeners.size).toBe(1);
  });
});
