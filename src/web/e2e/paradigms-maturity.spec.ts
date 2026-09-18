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

const TEXT: Record<'en' | 'ar', { hubTitle: string; markDone: string; reopen: string }> = {
  en: {
    hubTitle: 'See where you stand on the growth continuum',
    markDone: 'Mark done',
    reopen: 'Reopen',
  },
  ar: {
    hubTitle: 'اعرف موقعك على مسار النضج',
    markDone: 'وضع علامة تم',
    reopen: 'إعادة فتح',
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
    await expect(page.locator('app-assessment-history-list mat-nav-list button')).toHaveCount(1);
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
});
