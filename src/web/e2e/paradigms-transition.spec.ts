import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Transition-person reflection (issue #51): the reference "list" exercise, adopting the exercise
 * page pattern (issue #187, parent #184). Happy path from the habit hub — add a script through
 * the focus-mode editor, decide to stop it (which requires the new-script sentence and this
 * week's situation), mark the exercise done, and confirm it survives a reload and shows on the
 * hub. No `seedDocument` call, so each project renders whichever language its own locale defaults
 * to (`mobile-ar`/`desktop-ar`, per `playwright.config.ts`), same as `e2e/habits.spec.ts`.
 */

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

const TEXT: Record<
  'en' | 'ar',
  { hubTitle: string; markDone: string; reopen: string; stopToggle: string }
> = {
  en: {
    hubTitle: 'Become a transition person',
    markDone: 'Mark done',
    reopen: 'Reopen',
    stopToggle: 'Stop',
  },
  ar: {
    hubTitle: 'كن حلقة انتقال إيجابية',
    markDone: 'وضع علامة تم',
    reopen: 'إعادة فتح',
    stopToggle: 'أوقفه',
  },
};

test.describe('paradigms transition reflection', () => {
  test('adds a script through the full-screen editor, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    // The four Playwright projects cover both breakpoints (`playwright.config.ts`); focus mode's
    // own behaviour (a full-screen panel that hides everything else, closed by the phone's back
    // gesture) only applies below `HANDSET_QUERY`, so those checks are conditional on it rather
    // than looping the breakpoints by hand here.
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/paradigms');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/transition$/);

    await page.locator('.add-button').click();
    // The selected script is the child route `:itemId` (issue #187, owner decision on #184).
    await expect(page).toHaveURL(/\/habits\/paradigms\/transition\/[^/]+$/);
    const form = page.locator('app-transition-item-form');
    await expect(form).toBeVisible();
    // The script field is the editor's initial focus target (`appEditorInitialFocus`), whether
    // the script is brand new or already has text.
    await expect(form.locator('textarea').first()).toBeFocused();

    if (isMobile) {
      // Focus mode is a full-screen panel covering the intro, list, footer and bottom
      // navigation, not just scrolled past them — a fixed `inset: 0` panel the size of the
      // viewport, with everything under it `inert` (`.body`'s own `inert` attribute, not just
      // visually hidden — `exercise-page.ts`'s own doc comment on why: a screen reader can't land
      // there either). The footer isn't even rendered while editing on handset (`showFooter`).
      const editorPanelPosition = await page
        .locator('.editor-panel')
        .evaluate((el) => getComputedStyle(el).position);
      expect(editorPanelPosition).toBe('fixed');
      await expect(page.locator('.body')).toHaveAttribute('inert', '');
      await expect(page.locator('.footer-slot')).toHaveCount(0);
    }

    await form.locator('textarea').first().fill('Silence means agreement');
    await form.locator('button', { hasText: text.stopToggle }).click();
    // Choosing Stop reveals the new-script field and moves focus straight into it.
    await expect(form.locator('textarea').nth(1)).toBeFocused();
    await form.locator('textarea').nth(1).fill('Pause and ask a question first');
    await form.locator('input[type="text"]').fill("Tonight's dinner conversation");

    if (isMobile) {
      // The phone's back gesture closes the editor and returns to the list, without leaving the
      // exercise page (issue #187, owner decision on #184: option (b), the child route).
      await page.goBack();
      await expect(page).toHaveURL(/\/habits\/paradigms\/transition$/);
      await expect(form).not.toBeVisible();
    } else {
      await page.locator('app-exercise-page .editor-close').click();
      await expect(page.locator('.editor-panel')).not.toBeVisible();
    }

    await expect(page.locator('app-transition-summary')).toBeVisible();
    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    // Longer than the 500 ms save debounce (`SAVE_DEBOUNCE_MS`, `document-persistence.ts`) — see
    // `e2e/multi-tab.spec.ts`'s own comment on the same wait before relying on persisted state.
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('app-exercise-list mat-nav-list button')).toHaveCount(1);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.goto('/habits/paradigms');
    await expect(page.locator('app-habit-hub-page .hub-status')).toBeVisible();
  });

  test('accessibility: the exercise page has no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/paradigms/transition');
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
