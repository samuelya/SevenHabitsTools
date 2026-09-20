import { BreakpointObserver } from '@angular/cdk/layout';
import { ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppDialog } from '../../../core/layout/app-dialog';
import { AppSnackbar } from '../../../core/layout/app-snackbar';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ExerciseGuideContent } from './exercise-guide';
import { EXERCISE_GUIDE_LOADER, ExerciseGuideOpener } from './exercise-guide-opener';

const CONTENT: ExerciseGuideContent = {
  inShort: 'In short.',
  howTo: ['Step one.'],
  examples: [],
  afterwards: 'Afterwards.',
};

/** Neither the real `AppDialog` (which loads `@angular/material/dialog`) nor the real
 * `ExerciseGuide` component needs to exist for this service's own spec — `EXERCISE_GUIDE_LOADER`
 * resolves to any object shaped like the module `import()` would return, the same DI seam
 * `delete-with-undo.spec.ts` uses for `DELETE_CONFIRM_DIALOG_LOADER`. */
function setUp(
  options: {
    handset?: boolean;
    guideLoader?: () => Promise<{ ExerciseGuide: unknown }>;
    dialogOpen?: ReturnType<typeof vi.fn>;
  } = {},
): {
  service: ExerciseGuideOpener;
  dialogOpen: ReturnType<typeof vi.fn>;
  snackbarOpen: ReturnType<typeof vi.fn>;
} {
  const dialogOpen = options.dialogOpen ?? vi.fn().mockResolvedValue({});
  const snackbarOpen = vi.fn().mockResolvedValue({});
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      { provide: AppDialog, useValue: { open: dialogOpen } },
      { provide: AppSnackbar, useValue: { open: snackbarOpen } },
      { provide: BreakpointObserver, useValue: { isMatched: () => options.handset ?? false } },
      {
        provide: EXERCISE_GUIDE_LOADER,
        useValue: options.guideLoader ?? (() => Promise.resolve({ ExerciseGuide: class {} })),
      },
    ],
  });
  return { service: TestBed.inject(ExerciseGuideOpener), dialogOpen, snackbarOpen };
}

function fakeViewContainerRef(): ViewContainerRef {
  return {} as ViewContainerRef;
}

describe('ExerciseGuideOpener', () => {
  it('opens the guide dialog with the given content', async () => {
    const { service, dialogOpen } = setUp();

    await service.open(CONTENT, fakeViewContainerRef());

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    const [, config] = dialogOpen.mock.calls[0] as [unknown, { data: { content: unknown } }];
    expect(config.data).toEqual({ content: CONTENT });
  });

  it('sizes the dialog full-screen below the handset breakpoint', async () => {
    const { service, dialogOpen } = setUp({ handset: true });

    await service.open(CONTENT, fakeViewContainerRef());

    const [, config] = dialogOpen.mock.calls[0] as [
      unknown,
      { width?: string; height?: string; maxWidth?: string },
    ];
    expect(config.width).toBe('100%');
    expect(config.height).toBe('100%');
    expect(config.maxWidth).toBe('100vw');
  });

  it('caps the dialog width at 560px on desktop', async () => {
    const { service, dialogOpen } = setUp({ handset: false });

    await service.open(CONTENT, fakeViewContainerRef());

    const [, config] = dialogOpen.mock.calls[0] as [unknown, { maxWidth?: string }];
    expect(config.maxWidth).toBe('560px');
  });

  it('passes the given view container so the dialog opens inside the route injector tree', async () => {
    const { service, dialogOpen } = setUp();
    const viewContainerRef = fakeViewContainerRef();

    await service.open(CONTENT, viewContainerRef);

    const [, config] = dialogOpen.mock.calls[0] as [unknown, { viewContainerRef?: unknown }];
    expect(config.viewContainerRef).toBe(viewContainerRef);
  });

  it('shows a load-error snackbar, and never opens the dialog, when the guide chunk fails to load', async () => {
    const { service, dialogOpen, snackbarOpen } = setUp({
      guideLoader: () => Promise.reject(new Error('chunk load failed')),
    });

    await service.open(CONTENT, fakeViewContainerRef());

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(snackbarOpen).toHaveBeenCalledTimes(1);
  });

  it('shows a load-error snackbar, instead of an unhandled rejection, when AppDialog.open() itself rejects', async () => {
    // Regression test for a review finding: only the chunk load used to be in try/catch, so a
    // rejection from `AppDialog.open()` (e.g. offline with the dialog chunk not yet cached)
    // surfaced as an unhandled promise rejection instead of the same load-error path.
    const { service, snackbarOpen } = setUp({
      dialogOpen: vi.fn().mockRejectedValue(new Error('dialog chunk load failed')),
    });

    await expect(service.open(CONTENT, fakeViewContainerRef())).resolves.toBeUndefined();

    expect(snackbarOpen).toHaveBeenCalledTimes(1);
  });
});
