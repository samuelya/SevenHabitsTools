import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * P/PC balance audit (issue #49): the reference **assessment** exercise (playbook §4). Happy path
 * from the habit hub — start an audit, add an over-used asset, name its maintenance action, mark
 * the exercise done, and confirm it survives a reload and shows on the hub. No `seedDocument`
 * call, so each project renders whichever language its own locale defaults to (`mobile-ar`/
 * `desktop-ar`, per `playwright.config.ts`), same as `e2e/paradigms-transition.spec.ts`.
 */

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

const TEXT: Record<'en' | 'ar', { hubTitle: string; markDone: string; reopen: string }> = {
  en: {
    hubTitle: 'Audit your results and capacity',
    markDone: 'Mark done',
    reopen: 'Reopen',
  },
  ar: {
    hubTitle: 'قيّم نتائجك وقدرتك على الإنتاج',
    markDone: 'وضع علامة تم',
    reopen: 'إعادة فتح',
  },
};

test.describe('P/PC balance audit', () => {
  test('adds an over-used asset with a maintenance action, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    // Focus mode is a full-screen panel on handset that hides the footer (and its `DoneToggle`)
    // entirely while open (`showFooter`, `exercise-page.ts`) — the same layout `paradigms-
    // transition.spec.ts` accounts for, closing the editor before checking it.
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/paradigms');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/pc-balance$/);

    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/pc-balance\/[^/]+$/);
    const form = page.locator('app-pc-balance-audit-form');
    await expect(form).toBeVisible();

    const nameInput = form.locator('.add-asset-row input[type="text"]').first();
    await nameInput.fill('Sleep');
    await form.locator('.add-asset-row button').first().click();

    // `ArrowUp`/`ArrowDown`, not `ArrowRight`/`ArrowLeft`: a native range input mirrors left/right
    // for RTL to match the visual direction, but up/down always increment/decrement regardless of
    // `dir`, so this reaches the same P/PC values in every one of the four Playwright projects.
    const pSlider = form.locator('.slider-field input[matSliderThumb]').nth(0);
    const pcSlider = form.locator('.slider-field input[matSliderThumb]').nth(1);
    await pSlider.focus();
    await pSlider.press('ArrowUp');
    await pSlider.press('ArrowUp');
    await pcSlider.focus();
    await pcSlider.press('ArrowDown');
    await pcSlider.press('ArrowDown');

    const actionField = form.locator('.asset-action textarea');
    await expect(actionField).toBeVisible();
    await actionField.fill('Sleep by 10pm on weeknights');

    if (isMobile) {
      await page.goBack();
      await expect(page).toHaveURL(/\/habits\/paradigms\/pc-balance$/);
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

  // Issue #213's shared fix (`exercise-page.scss`) applies to every split-mode editor, but
  // `e2e/paradigms-maturity.spec.ts` is the one regression test for it (review round 1: at
  // 1280x1500 an empty audit's own editor is far shorter than the viewport, so an equivalent check
  // here passed unchanged against the unfixed bug and guarded nothing).
  test('accessibility: the audit page and its open editor have no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/paradigms/pc-balance');
    const listResults = await new AxeBuilder({ page }).analyze();
    expect(
      listResults.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.locator('.add-button').click();
    await expect(page.locator('app-pc-balance-audit-form')).toBeVisible();
    const editorResults = await new AxeBuilder({ page }).analyze();
    expect(
      editorResults.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
