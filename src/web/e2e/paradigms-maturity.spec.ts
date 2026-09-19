import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Maturity continuum self-assessment (issue #50): the second **assessment** exercise (playbook
 * §4), reusing #49's `assessment-history.logic.ts`. Happy path from the habit hub — start an
 * assessment, rate every area, see the overall profile, mark the exercise done, and confirm it
 * survives a reload and shows on the hub. No `seedDocument` call, so each project renders
 * whichever language its own locale defaults to (`mobile-ar`/`desktop-ar`, per
 * `playwright.config.ts`), same as `e2e/paradigms-transition.spec.ts`.
 */

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

const TEXT: Record<
  'en' | 'ar',
  {
    hubTitle: string;
    markDone: string;
    reopen: string;
    cancel: string;
    delete: string;
    undo: string;
  }
> = {
  en: {
    hubTitle: 'See where you stand on the growth continuum',
    markDone: 'Mark done',
    reopen: 'Reopen',
    cancel: 'Cancel',
    delete: 'Delete',
    undo: 'Undo',
  },
  ar: {
    hubTitle: 'اعرف موقعك على مسار النضج',
    markDone: 'وضع علامة تم',
    reopen: 'إعادة فتح',
    cancel: 'إلغاء',
    delete: 'حذف',
    undo: 'تراجع',
  },
};

test.describe('maturity continuum self-assessment', () => {
  test('rates every area, sees the overall profile, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    // Focus mode is a full-screen panel on handset that hides the footer (and its `DoneToggle`)
    // entirely while open (`showFooter`, `exercise-page.ts`) — the same layout `paradigms-
    // transition.spec.ts` accounts for, closing the editor before checking it.
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/paradigms');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/maturity$/);

    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/maturity\/[^/]+$/);
    const form = page.locator('app-maturity-assessment-form');
    await expect(form).toBeVisible();

    const rows = form.locator('.area-row');
    await expect(rows).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await rows.nth(i).locator('.level-option input[type="radio"]').first().check();
    }

    await expect(page.locator('app-maturity-result .profile')).toBeVisible();

    if (isMobile) {
      await page.goBack();
      await expect(page).toHaveURL(/\/habits\/paradigms\/maturity$/);
    } else {
      await page.locator('app-exercise-page .editor-close').click();
    }

    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    // Longer than the 500 ms save debounce (`SAVE_DEBOUNCE_MS`, `document-persistence.ts`) — see
    // `e2e/multi-tab.spec.ts`'s own comment on the same wait before relying on persisted state.
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(1);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.goto('/habits/paradigms');
    await expect(page.locator('app-habit-hub-page .hub-status')).toBeVisible();
  });

  test('accessibility: the assessment page and its open editor have no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/paradigms/maturity');
    const listResults = await new AxeBuilder({ page }).analyze();
    expect(
      listResults.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.locator('.add-button').click();
    await expect(page.locator('app-maturity-assessment-form')).toBeVisible();
    const editorResults = await new AxeBuilder({ page }).analyze();
    expect(
      editorResults.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });

  // Issue #203: the shared delete pattern via the history's own bin button — Cancel leaves the
  // assessment in place, Delete tombstones it and offers Undo through the snackbar.
  test('deletes an assessment from the history, with a confirm dialog and an Undo snackbar', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    const isMobile = testInfo.project.name.startsWith('mobile');
    await page.goto('/habits/paradigms/maturity');

    await page.locator('.add-button').click();
    const form = page.locator('app-maturity-assessment-form');
    await expect(form).toBeVisible();
    if (isMobile) {
      await page.goBack();
    } else {
      await page.locator('app-exercise-page .editor-close').click();
    }
    await expect(form).not.toBeVisible();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(1);

    await page.locator('.assessment-history-list__delete').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Cancel leaves the assessment untouched.
    await page.getByRole('button', { name: text.cancel }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(1);

    // Delete tombstones it and offers Undo.
    await page.locator('.assessment-history-list__delete').click();
    await page.getByRole('button', { name: text.delete, exact: true }).click();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(0);
    const undoButton = page.getByRole('button', { name: text.undo });
    await expect(undoButton).toBeVisible();

    await undoButton.click();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(1);
  });
});
