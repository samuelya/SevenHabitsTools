import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, InjectionToken, ViewContainerRef, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { HANDSET_QUERY } from '../../../core/layout/breakpoints';
import { AppDialog } from '../../../core/layout/app-dialog';
import { AppSnackbar } from '../../../core/layout/app-snackbar';
// Types only (erased at build time): a value import from './exercise-guide' would pull the dialog
// component into every page's initial bundle and defeat the lazy load below.
import type {
  ExerciseGuideContent,
  ExerciseGuideData,
  ExerciseGuideResult,
  ExerciseGuideSample,
} from './exercise-guide';

/** Whether a dialog close `result` is "Try this example" (`ExerciseGuideResult`). */
export function isTryExampleResult(result: unknown): result is ExerciseGuideResult {
  if (typeof result !== 'object' || result === null) {
    return false;
  }
  const tryExample = (result as Record<string, unknown>)['tryExample'];
  return typeof tryExample === 'object' && tryExample !== null;
}

type ExerciseGuideModule = typeof import('./exercise-guide');

/** DI seam around the lazy `import('./exercise-guide')`, the same shape
 * `DELETE_CONFIRM_DIALOG_LOADER` (`delete-with-undo.ts`) uses — lets a spec substitute or fail the
 * load through a TestBed provider instead of module-level mocking, which the Angular unit-test
 * builder doesn't support for relative imports. */
export const EXERCISE_GUIDE_LOADER = new InjectionToken<() => Promise<ExerciseGuideModule>>(
  'EXERCISE_GUIDE_LOADER',
  { providedIn: 'root', factory: () => () => import('./exercise-guide') },
);

/**
 * Opens `ExerciseGuide` for `ExercisePromptCard`'s "Read more" button (issue #212): lazy-loads the
 * dialog component so it's never in a page's initial bundle (the same reasoning `DeleteWithUndo`
 * gives its own dialog), sizes it full-screen below `HANDSET_QUERY` and centred (max 560px) above
 * it, and reports a chunk-load failure instead of the button silently doing nothing. The caller
 * passes its own `ViewContainerRef` so the dialog opens inside the route's injector tree and can
 * read the `exercise-kit` scope the route already provides (see the design-check comment on the
 * issue) — `AppDialog`'s own root-injector default, which `ImportConfirmDialog`/
 * `DeleteConfirmDialog` rely on for their root-scope copy, doesn't reach a route-provided scope.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseGuideOpener {
  private readonly dialog = inject(AppDialog);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly snackbar = inject(AppSnackbar);
  private readonly transloco = inject(TranslocoService);
  private readonly loadExerciseGuide = inject(EXERCISE_GUIDE_LOADER);

  /** `options.title` (already translated) replaces the dialog's generic heading, e.g. "About this
   * habit" on the habit hub (issue #219); `options.extra` is a caller-rendered section shown after
   * "In short" (issue #230). `onTryExample` receives a card example's `sample` when the guide was
   * closed with "Try this example" (issue #232). It runs from `afterClosed()`, which CDK emits only
   * after it has disposed the overlay and returned focus to the opener's button, so a caller that
   * opens its editor there never races the dialog's own focus return. Resolves once the dialog is
   * open, not when it closes. */
  async open(
    content: ExerciseGuideContent,
    viewContainerRef: ViewContainerRef,
    options: Omit<ExerciseGuideData, 'content'> & {
      readonly onTryExample?: (sample: ExerciseGuideSample) => void;
    } = {},
  ): Promise<void> {
    try {
      const { ExerciseGuide } = await this.loadExerciseGuide();
      const handset = this.breakpoints.isMatched(HANDSET_QUERY);
      const { onTryExample, ...dataOptions } = options;
      const data: ExerciseGuideData = { content, ...dataOptions };
      const ref = await this.dialog.open<InstanceType<typeof ExerciseGuide>, ExerciseGuideData>(
        ExerciseGuide,
        {
          viewContainerRef,
          data,
          width: handset ? '100%' : undefined,
          height: handset ? '100%' : undefined,
          maxWidth: handset ? '100vw' : '560px',
          maxHeight: handset ? '100vh' : '80vh',
        },
      );
      if (onTryExample) {
        ref.afterClosed().subscribe((result) => {
          if (isTryExampleResult(result)) {
            onTryExample(result.tryExample);
          }
        });
      }
    } catch {
      // Most likely offline with this chunk not yet cached (the service worker's `chunks` group is
      // `installMode: lazy`) — say so plainly, the same handling `DeleteWithUndo`/`BackupSection`
      // give their own lazy-loaded dialogs, rather than the button silently doing nothing. Wraps
      // both the chunk load *and* `AppDialog.open()` itself (review finding on this PR): the caller
      // does `void this.guideOpener.open(...)`, so a rejection from `open()` that isn't caught here
      // becomes an unhandled promise rejection instead of ever reaching the user.
      try {
        // Its own try/catch (round-4 review finding): `AppSnackbar.open()` lazy-loads
        // `@angular/material/snack-bar` too, so in the exact offline case this handler exists for,
        // that load can fail as well — without this, the rejection would itself go unhandled and
        // the user would still see nothing.
        await this.snackbar.open(
          this.transloco.translate('exerciseKit.guide.loadError'),
          this.transloco.translate('data.snackbar.dismiss'),
        );
      } catch {
        // Nothing more we can do — both the guide and the error message failed to load.
      }
    }
  }
}
