import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { WINDOW } from '../browser/window';
import { DocumentPersistence } from '../data/document-persistence';
import { AppSnackbar } from '../layout/app-snackbar';
import { AppUpdateService } from './app-update.service';

interface FakeRef {
  readonly action: Subject<void>;
  readonly dismissed: Subject<void>;
}

function setUp(options: { isEnabled?: boolean; dirty?: boolean; saveError?: unknown } = {}) {
  const versionUpdates = new Subject<VersionReadyEvent>();
  const unrecoverable = new Subject<{ reason: string }>();
  const activateUpdate = vi.fn().mockResolvedValue(true);
  const swUpdate = {
    isEnabled: options.isEnabled ?? true,
    versionUpdates,
    unrecoverable,
    activateUpdate,
  };

  const flush = vi.fn().mockResolvedValue(undefined);
  let dirty = options.dirty ?? false;
  let saveError: unknown = options.saveError ?? null;
  const persistence = {
    flush,
    dirty: () => dirty,
    saveError: () => saveError,
  };

  const reload = vi.fn();
  const refs: FakeRef[] = [];
  const open = vi.fn(async () => {
    const ref: FakeRef = { action: new Subject<void>(), dismissed: new Subject<void>() };
    refs.push(ref);
    return { onAction: () => ref.action, afterDismissed: () => ref.dismissed };
  });

  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      { provide: SwUpdate, useValue: swUpdate },
      { provide: DocumentPersistence, useValue: persistence as unknown as DocumentPersistence },
      { provide: WINDOW, useValue: { location: { reload } } },
      { provide: AppSnackbar, useValue: { open } },
    ],
  });

  const service = TestBed.inject(AppUpdateService);
  service.start();

  return {
    service,
    versionUpdates,
    unrecoverable,
    activateUpdate,
    reload,
    open,
    refs,
    // Real MatSnackBar's action button both emits onAction() and dismisses the snackbar
    // (dismissWithAction()); the fake ref mirrors that so promptOpen resets the way it really does.
    clickAction: (index: number): void => {
      refs[index]!.action.next();
      refs[index]!.dismissed.next();
    },
    setDirty: (value: boolean) => {
      dirty = value;
    },
    setSaveError: (value: unknown) => {
      saveError = value;
    },
    readyEvent: { type: 'VERSION_READY' } as VersionReadyEvent,
  };
}

describe('AppUpdateService', () => {
  it('does nothing when the service worker is not enabled', () => {
    const { versionUpdates, open, readyEvent } = setUp({ isEnabled: false });
    versionUpdates.next(readyEvent);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens a reload prompt when a new version is ready', async () => {
    const { versionUpdates, open, readyEvent } = setUp();
    versionUpdates.next(readyEvent);
    await vi.dynamicImportSettled();

    expect(open).toHaveBeenCalledTimes(1);
    const [, action] = open.mock.calls[0]! as unknown as [string, string];
    expect(action).toBe('Reload');
  });

  it('opens a reload prompt for an unrecoverable state', async () => {
    const { unrecoverable, open } = setUp();
    unrecoverable.next({ reason: 'hash mismatch' });
    await vi.dynamicImportSettled();

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('never stacks a second prompt while one is already open', async () => {
    const { versionUpdates, open, readyEvent } = setUp();
    versionUpdates.next(readyEvent);
    await vi.dynamicImportSettled();
    versionUpdates.next(readyEvent);
    await vi.dynamicImportSettled();

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('flushes and reloads once nothing is dirty or failing', async () => {
    const { versionUpdates, clickAction, activateUpdate, reload, readyEvent } = setUp();
    versionUpdates.next(readyEvent);
    await vi.dynamicImportSettled();

    clickAction(0);
    await vi.dynamicImportSettled();
    await vi.dynamicImportSettled();

    expect(activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it('does not reload while an edit is still dirty, and reopens the prompt', async () => {
    const { versionUpdates, clickAction, activateUpdate, reload, readyEvent, setDirty, open } =
      setUp();
    setDirty(true);
    versionUpdates.next(readyEvent);
    await vi.dynamicImportSettled();

    clickAction(0);
    await vi.dynamicImportSettled();
    await vi.dynamicImportSettled();

    expect(activateUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('does not reload while the last save is failing', async () => {
    const { versionUpdates, clickAction, activateUpdate, reload, readyEvent, setSaveError } =
      setUp();
    setSaveError(new Error('quota'));
    versionUpdates.next(readyEvent);
    await vi.dynamicImportSettled();

    clickAction(0);
    await vi.dynamicImportSettled();
    await vi.dynamicImportSettled();

    expect(activateUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('start() is idempotent', async () => {
    const { service, versionUpdates, open, readyEvent } = setUp();
    service.start();

    versionUpdates.next(readyEvent);
    await vi.dynamicImportSettled();

    expect(open).toHaveBeenCalledTimes(1);
  });
});
