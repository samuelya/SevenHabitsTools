import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AppDialog } from '../../core/layout/app-dialog';
import { AppSnackbar } from '../../core/layout/app-snackbar';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import {
  ConfirmAndDeleteOptions,
  DELETE_CONFIRM_DIALOG_LOADER,
  DELETE_UNDO_MS,
  DeleteWithUndo,
} from './delete-with-undo';

/** Neither the real `AppDialog` (which loads `@angular/material/dialog`) nor the real dialog
 * component needs to exist for this service's own spec — `DELETE_CONFIRM_DIALOG_LOADER` resolves
 * to any object shaped like the module `import()` would return, the same DI seam
 * `backup-section.spec.ts` uses for `IMPORT_CONFIRM_DIALOG_LOADER`. */
function setUp(
  options: {
    dialogResult?: boolean;
    snackbarAction?: Subject<void>;
    dialogLoader?: () => Promise<{ DeleteConfirmDialog: unknown }>;
  } = {},
): {
  service: DeleteWithUndo;
  dialogOpen: ReturnType<typeof vi.fn>;
  snackbarOpen: ReturnType<typeof vi.fn>;
} {
  const dialogOpen = vi.fn().mockResolvedValue({ afterClosed: () => of(options.dialogResult) });
  const action = options.snackbarAction ?? new Subject<void>();
  const snackbarOpen = vi.fn().mockResolvedValue({ onAction: () => action });
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      { provide: AppDialog, useValue: { open: dialogOpen } },
      { provide: AppSnackbar, useValue: { open: snackbarOpen } },
      {
        provide: DELETE_CONFIRM_DIALOG_LOADER,
        useValue:
          options.dialogLoader ?? (() => Promise.resolve({ DeleteConfirmDialog: class {} })),
      },
    ],
  });
  return { service: TestBed.inject(DeleteWithUndo), dialogOpen, snackbarOpen };
}

function options(overrides: Partial<ConfirmAndDeleteOptions> = {}): ConfirmAndDeleteOptions {
  return {
    deletedMessage: 'Deleted',
    undoLabel: 'Undo',
    onConfirm: vi.fn(),
    onUndo: vi.fn(),
    ...overrides,
  };
}

describe('DeleteWithUndo', () => {
  it('opens the shared confirm dialog', async () => {
    const { service, dialogOpen } = setUp({ dialogResult: true });

    await service.confirmAndDelete(options());

    expect(dialogOpen).toHaveBeenCalledTimes(1);
  });

  it('does not delete, and does not show a snackbar, when the dialog is cancelled (undefined result)', async () => {
    const { service, snackbarOpen } = setUp({ dialogResult: undefined });
    const onConfirm = vi.fn();

    await service.confirmAndDelete(options({ onConfirm }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(snackbarOpen).not.toHaveBeenCalled();
  });

  it('runs onConfirm and opens the "deleted — undo" snackbar once the dialog confirms', async () => {
    const { service, snackbarOpen } = setUp({ dialogResult: true });
    const onConfirm = vi.fn();

    await service.confirmAndDelete(
      options({ onConfirm, deletedMessage: 'Script deleted', undoLabel: 'Undo' }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(snackbarOpen).toHaveBeenCalledWith('Script deleted', 'Undo', {
      duration: DELETE_UNDO_MS,
    });
  });

  it('runs onUndo when the snackbar action fires', async () => {
    const action = new Subject<void>();
    const { service } = setUp({ dialogResult: true, snackbarAction: action });
    const onUndo = vi.fn();

    await service.confirmAndDelete(options({ onUndo }));
    action.next();

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('never runs onUndo when Undo is never tapped', async () => {
    const { service } = setUp({ dialogResult: true });
    const onUndo = vi.fn();

    await service.confirmAndDelete(options({ onUndo }));

    expect(onUndo).not.toHaveBeenCalled();
  });

  it('shows a load-error snackbar, and never opens the dialog or deletes, when the dialog chunk fails to load', async () => {
    const { service, dialogOpen, snackbarOpen } = setUp({
      dialogLoader: () => Promise.reject(new Error('chunk load failed')),
    });
    const onConfirm = vi.fn();

    await service.confirmAndDelete(options({ onConfirm }));

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(snackbarOpen).toHaveBeenCalledWith(
      "Couldn't load the delete dialog. Check your connection and try again.",
      'Dismiss',
    );
  });
});
