import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Paradigms & perception (issue #48): the reference **worksheet** exercise (playbook §4) — a
 * single record filled through a fixed 3-step stepper, with no per-item selection and no
 * focus-mode editor at all. Happy path from the habit hub: read the two views, reveal the
 * alternative and rate how hard it was to switch, name 3 change attempts and tag them, trace a
 * see-do-get chain two ways, mark the exercise done, and confirm it survives a reload and shows
 * on the hub. No `seedDocument` call, so each project renders whichever language its own locale
 * defaults to (`mobile-ar`/`desktop-ar`, per `playwright.config.ts`), same as
 * `e2e/paradigms-transition.spec.ts`.
 */

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

const TEXT: Record<
  'en' | 'ar',
  {
    hubTitle: string;
    reveal: string;
    character: string;
    next: string;
    markDone: string;
    reopen: string;
  }
> = {
  en: {
    hubTitle: 'Notice your paradigm',
    reveal: 'Show what was really going on',
    character: 'Character (a principle you built)',
    next: 'Next',
    markDone: 'Mark done',
    reopen: 'Reopen',
  },
  ar: {
    hubTitle: 'لاحظ إطارك الذهني',
    reveal: 'اعرض ما كان يجري فعلاً',
    character: 'شخصية (مبدأ بنيته في نفسك)',
    next: 'التالي',
    markDone: 'وضع علامة تم',
    reopen: 'إعادة فتح',
  },
};

test.describe('paradigms & perception worksheet', () => {
  test('fills all three steps, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];

    await page.goto('/habits/paradigms');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/perception$/);

    // Step 1: two views.
    await page.locator('.step-two-views textarea').fill('They must be upset with me');
    const revealButton = page.locator('button', { hasText: text.reveal });
    await expect(revealButton).toBeEnabled();
    await revealButton.click();
    const slider = page.locator('.step-two-views input[matSliderThumb]');
    await slider.focus();
    await slider.press('ArrowUp');
    await slider.press('ArrowUp');
    await slider.press('ArrowUp');

    await page.locator('button:visible', { hasText: text.next }).click();

    // Step 2: 3 change attempts, tag the second one "Character", plus the difference sentence.
    const attemptTextareas = page.locator('.step-character-technique textarea');
    await attemptTextareas.nth(0).fill('Tried a new morning routine');
    await attemptTextareas.nth(1).fill('Practiced listening before reacting');
    await attemptTextareas.nth(2).fill('Set a strict schedule');
    await page
      .locator('.kind-toggle')
      .nth(1)
      .locator('button', { hasText: text.character })
      .click();
    await attemptTextareas
      .nth(3)
      .fill('A technique fades once the effort stops; character sticks.');

    await page.locator('button:visible', { hasText: text.next }).click();

    // Step 3: the current chain, then the alternative one.
    const chainTextareas = page.locator('.step-see-do-get textarea');
    await chainTextareas.nth(0).fill('A distant coworker');
    await chainTextareas.nth(1).fill('I avoid them');
    await chainTextareas.nth(2).fill('A tense team');
    await chainTextareas.nth(3).fill('A distracted coworker');
    await chainTextareas.nth(4).fill('I check in with them');
    await chainTextareas.nth(5).fill('A trusted team');

    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    // Longer than the 500 ms save debounce (`SAVE_DEBOUNCE_MS`) — see `paradigms-transition`'s
    // own e2e spec for the same wait before relying on persisted state.
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('.step-two-views textarea')).toHaveValue(
      'They must be upset with me',
    );
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.goto('/habits/paradigms');
    await expect(
      page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }),
    ).toBeVisible();
  });

  test('accessibility: the worksheet page has no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/paradigms/perception');
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
