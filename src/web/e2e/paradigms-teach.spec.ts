import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Teach-to-learn tracker (issue #52): the second "list" exercise, this one over a fixed row per
 * book chapter instead of an arbitrary add-your-own list. Happy path from a habit hub other than
 * Paradigms — proving the generic "teach this" hub action (`shared/exercise-kit/hub-action-
 * registry.ts`) reaches this exercise and pre-selects that hub's own chapter — fill the key idea,
 * mark it shared, mark the exercise done, and confirm it survives a reload and shows the shared
 * count on the Paradigms hub.
 */

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

const TEXT: Record<
  'en' | 'ar',
  {
    checklistItem: string;
    hubActionLabel: string;
    h1Title: string;
    markDone: string;
    notPlanned: string;
    overdue: string;
    reopen: string;
    sharedToggle: string;
  }
> = {
  en: {
    checklistItem: 'Plan one chapter with a date',
    hubActionLabel: 'Teach this chapter',
    h1Title: 'Habit 1: Be proactive',
    markDone: 'Mark done',
    notPlanned: 'Not planned',
    overdue: 'Overdue',
    reopen: 'Reopen',
    sharedToggle: 'Shared',
  },
  ar: {
    checklistItem: 'خطّط لفصل واحد بميعاد',
    hubActionLabel: 'علّم هذا الفصل',
    h1Title: 'العادة 1: كن مبادراً',
    markDone: 'وضع علامة تم',
    notPlanned: 'غير مخطط',
    overdue: 'متأخر',
    reopen: 'إعادة فتح',
    sharedToggle: 'تمت المشاركة',
  },
};

test.describe('teach-to-learn tracker', () => {
  test('shows the gate checklist and no zero counter before any chapter is planned (#215)', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];

    await page.goto('/habits/paradigms/teach');

    await expect(page.locator('.done-checklist', { hasText: text.checklistItem })).toBeVisible();
    await expect(page.locator('app-teach-summary')).toHaveCount(0);
  });

  test('opens from the h1 hub pre-selecting its chapter, marks it shared and done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/h1');
    await page.locator('app-habit-hub-page .hub-action', { hasText: text.hubActionLabel }).click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/teach\/h1$/);

    const form = page.locator('app-teach-item-form');
    await expect(form).toBeVisible();
    await expect(form.locator('textarea').first()).toBeFocused();

    await form.locator('textarea').first().fill('You choose your response, not just react');
    await form.locator('button', { hasText: text.sharedToggle }).click();

    // The editor's own close control, on both breakpoints — not the phone's back *gesture*: this
    // page was reached from the h1 hub, not from its own bare list (the "teach this" hub action's
    // `?chapter=` redirect uses `replaceUrl`, issue #52), so one *browser* back step from here
    // correctly returns to that hub, not to a list the user never visited. `.editor-close` is the
    // control that returns to this exercise's own list, same as every other exercise.
    await page.locator('app-exercise-page .editor-close').click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/teach$/);
    await expect(form).not.toBeVisible();
    if (!isMobile) {
      await expect(page.locator('.editor-panel')).not.toBeVisible();
    }

    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    // Longer than the 500 ms save debounce (`SAVE_DEBOUNCE_MS`) — see `paradigms-transition`'s
    // own e2e spec for the same wait before relying on persisted state.
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.goto('/habits/paradigms');
    await expect(page.locator('app-habit-hub-page .hub-status')).toBeVisible();
  });

  test('shows all ten chapters with status chips, no search or sort, and highlights an overdue one (#224)', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    await seedDocument({
      habits: {
        paradigms: {
          teach: [
            {
              id: '11111111-1111-4111-8111-111111111112',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              chapter: 'h1',
              keyIdea: 'Choose your response, not just react',
              plannedAt: '2020-01-01',
              status: 'planned',
            },
          ],
        },
      },
    });
    await page.goto('/habits/paradigms/teach');

    await expect(page.locator('.exercise-list__item')).toHaveCount(10);
    await expect(page.locator('app-exercise-list .exercise-list__item--warning')).toHaveCount(1);
    // Ten known rows: no search box, no sort toggle.
    await expect(page.locator('app-exercise-list .search')).toHaveCount(0);
    await expect(page.locator('app-exercise-list .sort')).toHaveCount(0);

    // Every row has a status chip; the overdue one says so in words, not only in colour, and
    // shows the key idea's first line.
    await expect(page.locator('.exercise-list__item .exercise-list__chip')).toHaveCount(10);
    const overdueRow = page.locator('.exercise-list__item--warning');
    await expect(overdueRow.locator('.exercise-list__chip--warning')).toHaveText(text.overdue);
    await expect(overdueRow).toContainText('Choose your response, not just react');
    await expect(
      page.locator('.exercise-list__item').first().locator('.exercise-list__chip'),
    ).toHaveText(text.notPlanned);

    // The editor is titled with the chapter's own name.
    await overdueRow.click();
    await expect(page.locator('app-exercise-page .editor-title')).toHaveText(text.h1Title);
  });

  test('accessibility: the exercise page and its open editor have no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/paradigms/teach');
    let results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.locator('app-exercise-list mat-nav-list button').first().click();
    await expect(page.locator('app-teach-item-form')).toBeVisible();
    results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
