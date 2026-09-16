import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SAVE_DEBOUNCE_MS, SAVE_RETRY_MAX_MS } from './document-persistence';
import { setUp } from './document-persistence.spec';
import { StrandedEditsError } from './stranded-edits-error';

describe('DocumentPersistence — #143: the write lock is lost while there are unsaved edits', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sets a StrandedEditsError and stays dirty, without attempting a save', async () => {
    const isWriter = signal(true);
    const { persistence, store, save } = setUp({ isWriter });
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    expect(persistence.dirty()).toBe(true);

    isWriter.set(false); // another tab's heartbeat entry took over before the debounce fired
    TestBed.tick();

    expect(persistence.saveError()).toBeInstanceOf(StrandedEditsError);
    expect(persistence.dirty()).toBe(true);

    // Neither the pending debounce nor a later retry ever calls adapter.save().
    await vi.advanceTimersByTimeAsync(SAVE_RETRY_MAX_MS);
    expect(save).not.toHaveBeenCalled();
  });

  it('cancels a save already in flight from attempting a retry after stepping down', async () => {
    const isWriter = signal(true);
    const { persistence, store, save } = setUp({ isWriter });
    save.mockRejectedValueOnce(new Error('quota'));
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1); // the failed attempt, still pending a retry

    isWriter.set(false);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_RETRY_MAX_MS);

    expect(save).toHaveBeenCalledTimes(1); // the retry that would have fired never does
    expect(persistence.saveError()).toBeInstanceOf(StrandedEditsError);
  });

  it('does not let a save already in flight when stepping down clear the stranded error on success', async () => {
    const isWriter = signal(true);
    const { persistence, store, save } = setUp({ isWriter });
    let resolveSave!: () => void;
    save.mockReturnValueOnce(new Promise<void>((resolve) => (resolveSave = resolve)));
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1); // in flight, not yet resolved

    isWriter.set(false); // stepped down while that save is still pending
    TestBed.tick();
    expect(persistence.saveError()).toBeInstanceOf(StrandedEditsError);

    resolveSave(); // the in-flight save succeeds after all, despite the step-down
    await vi.advanceTimersByTimeAsync(0);

    expect(persistence.saveError()).toBeInstanceOf(StrandedEditsError);
    expect(persistence.dirty()).toBe(true);
  });

  it('sets nothing for a clean (not dirty) step-down', async () => {
    const isWriter = signal(true);
    const { persistence } = setUp({ isWriter });
    persistence.start();
    TestBed.tick();

    isWriter.set(false);
    TestBed.tick();

    expect(persistence.saveError()).toBeNull();
    expect(persistence.dirty()).toBe(false);
  });

  it('does nothing for a tab that starts read-only (no prior writer state to lose)', () => {
    const isWriter = signal(false);
    const { persistence } = setUp({ isWriter });
    persistence.start();
    TestBed.tick();

    expect(persistence.saveError()).toBeNull();
  });
});
