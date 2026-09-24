import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Maturity continuum self-assessment, the editor's flow (issue #50, reworked by #222): pick areas
 * as chips, continue (which saves the draft, #222 review), rate every area, see the overall
 * profile, mark the exercise done, and confirm it survives a reload and shows on the hub. The
 * layout repros and deleting an assessment are in `e2e/paradigms-maturity.spec.ts`. No
 * `seedDocument` call, so each project renders whichever language its own locale defaults to.
 */

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

const TEXT: Record<
  'en' | 'ar',
  {
    checklistItem: string;
    hubTitle: string;
    markDone: string;
    reopen: string;
    cancel: string;
    summary: string;
  }
> = {
  en: {
    checklistItem: 'Rate every area in one assessment',
    hubTitle: 'Growth continuum',
    markDone: 'Mark done',
    reopen: 'Reopen',
    cancel: 'Cancel',
    summary: 'Mostly independence',
  },
  ar: {
    checklistItem: 'قيّم كل المجالات في تقييم واحد',
    hubTitle: 'مسار النضج',
    markDone: 'وضع علامة تم',
    reopen: 'إعادة فتح',
    cancel: 'إلغاء',
    summary: 'في الغالب اعتماد على النفس',
  },
};

/** Desktop rates areas in expansion panels (issue #222): opens every one still closed. */
async function expandAllPanels(page: Page): Promise<void> {
  const panels = page.locator('app-maturity-assessment-form .area-panel');
  const count = await panels.count();
  for (let i = 0; i < count; i++) {
    const header = panels.nth(i).locator('mat-expansion-panel-header');
    if ((await header.getAttribute('aria-expanded')) !== 'true') {
      await header.click();
    }
    await expect(header).toHaveAttribute('aria-expanded', 'true');
  }
}

test.describe('maturity continuum: areas and rating (#222)', () => {
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

    // No zero counter before the first assessment: the gate checklist is the only message (#215).
    await expect(page.locator('app-maturity-summary')).toHaveCount(0);
    await expect(page.locator('.done-checklist', { hasText: text.checklistItem })).toBeVisible();

    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/maturity\/new$/);
    const form = page.locator('app-maturity-assessment-form');
    await expect(form).toBeVisible();

    // Phase 1 (issue #222): chips for the six suggested areas, none chosen; the first chip row is
    // on screen without scrolling at 360x800, with a 10% margin for CI's wider fonts.
    const chips = form.locator('.area-chip');
    await expect(chips).toHaveCount(6);
    await expect(form.locator('.area-chip[aria-pressed="true"]')).toHaveCount(0);
    const chipBottom = (await chips.first().boundingBox())!;
    const port = (await page.locator('main.page').boundingBox())!;
    expect(chipBottom.y + chipBottom.height).toBeLessThanOrEqual(port.y + port.height * 0.9);

    // Choosing chips keeps the draft in memory; Continue saves it (#222 review).
    await chips.nth(0).click();
    await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/\/habits\/paradigms\/maturity\/new$/);
    await chips.nth(2).click();
    const custom = form.locator('.custom-area input');
    await custom.fill('Volunteering');
    await custom.press('Enter');
    await expect(custom).toHaveValue('');
    await expect(form.locator('.area-chip[aria-pressed="true"]')).toHaveCount(3);

    // A name already in the list is refused, and the text kept to fix (#222 review).
    await custom.fill('volunteering');
    await custom.press('Enter');
    await expect(custom).toHaveValue('volunteering');
    await expect(custom).toHaveAttribute('aria-invalid', 'true');
    await custom.fill('');

    await form.locator('.continue-button').click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/maturity\/(?!new$)[^/]+$/);
    await expect(form.locator('.rate-phase')).toBeVisible();
    await expect(form.locator('.maturity-legend')).toHaveCount(1);

    if (isMobile) {
      // One area per screen, Previous/Next.
      for (let i = 0; i < 3; i++) {
        await expect(form.locator('.area-rating')).toHaveCount(1);
        await form.locator('.level-option').nth(1).click();
        if (i < 2) {
          await form.locator('.next-area').click();
        }
      }
      await expect(form.locator('.next-area')).toHaveCount(0);
    } else {
      await expect(form.locator('.area-panel')).toHaveCount(3);
      await expandAllPanels(page);
      for (let i = 0; i < 3; i++) {
        await form.locator('.area-panel').nth(i).locator('.level-option').nth(1).click();
      }
    }

    await expect(page.locator('app-maturity-result .profile')).toBeVisible();

    // The date is editable on a saved assessment too (issue #226).
    await form.locator('app-assessment-date-field input').fill('2026-03-14');

    // Unpressing a rated area's chip asks first; Cancel keeps it (#222 review).
    await form.locator('.change-areas').click();
    await chips.nth(0).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: text.cancel }).click();
    await expect(dialog).not.toBeVisible();
    await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await form.locator('.continue-button').click();
    await expect(form.locator('.rate-phase')).toBeVisible();

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
    // Date + result summary (issue #226), after a reload: the edited date was stored.
    const row = page.locator('.assessment-history-list__item');
    await expect(row).toContainText('14');
    await expect(row.locator('.assessment-history-list__summary')).toHaveText(text.summary);
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

    // Phase 2 (issue #222): the legend, the rating control and the pager or panels.
    const form = page.locator('app-maturity-assessment-form');
    await form.locator('.area-chip').first().click();
    await form.locator('.continue-button').click();
    await expect(form.locator('.rate-phase')).toBeVisible();
    await form.locator('.maturity-legend mat-expansion-panel-header').click();
    const ratingResults = await new AxeBuilder({ page }).analyze();
    expect(
      ratingResults.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
