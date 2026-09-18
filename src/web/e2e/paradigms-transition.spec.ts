import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Transition-person reflection (issue #51): the reference "list" exercise. Happy path from the
 * habit hub — name a script, decide to stop it (which requires the new-script sentence and this
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
  test('names a script, decides to stop it, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];

    await page.goto('/habits/paradigms');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/transition$/);

    await page.locator('.add-button').click();
    const form = page.locator('app-transition-item-form');
    await expect(form).toBeVisible();

    await form.locator('textarea').first().fill('Silence means agreement');
    await form.locator('button', { hasText: text.stopToggle }).click();
    await form.locator('textarea').nth(1).fill('Pause and ask a question first');
    await form.locator('input[type="text"]').fill("Tonight's dinner conversation");

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
    // Scanned with the list/detail drawer closed: an *open* `ExerciseDetail` drawer's CDK focus
    // trap anchors (`cdk-focus-trap-anchor`) are flagged by axe's `aria-hidden-focus` rule — a
    // characteristic of Angular CDK's focus trap everywhere it's used in this app, not something
    // specific to this exercise, so it's out of this issue's scope.
    await page.goto('/habits/paradigms/transition');
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
