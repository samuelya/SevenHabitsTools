import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * P/PC balance audit (issue #49): the reference **assessment** exercise (playbook §4). Happy path
 * from the habit hub — start an audit, add an over-used asset, name its maintenance action, mark
 * the exercise done, and confirm it survives a reload and shows on the hub. No `seedDocument`
 * call, so each project renders whichever language its own locale defaults to (`mobile-ar`/
 * `desktop-ar`, per `playwright.config.ts`), same as `e2e/paradigms-transition.spec.ts`.
 */

/** The stored audits' dates, as IndexedDB holds them (the document the JSON export writes). */
async function storedAuditDates(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('sevenhabits');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('documents').objectStore('documents').get('current');
          get.onsuccess = () => {
            db.close();
            const audits: { date: string }[] = get.result?.habits?.paradigms?.pcAudits ?? [];
            resolve(audits.map((audit) => audit.date));
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  return {
    checklistItem: t(locale, 'paradigmsPcBalance', 'checklist.named'),
    hubTitle: t(locale, 'habits', 'exercises.paradigms-pc-balance.shortTitle'),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
    summary: t(locale, 'paradigmsPcBalance', 'history.summary.overUsed.one', { count: 1 }),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

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

    // No zero counter before the first audit: the gate checklist is the only message (#215).
    await expect(page.locator('app-pc-balance-summary')).toHaveCount(0);
    await expect(page.locator('.done-checklist', { hasText: text.checklistItem })).toBeVisible();

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

    // The date is editable (issue #226): a native date input, filled as ISO `YYYY-MM-DD`.
    await form.locator('app-assessment-date-field input').fill('2026-03-14');
    // Stored when the user leaves the field (issue #226 review), not on each keystroke.
    await form.locator('app-assessment-date-field input').blur();

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
    // Date + result summary (issue #226), after a reload: the edited date was stored.
    const row = page.locator('.assessment-history-list__item');
    await expect(row).toContainText('14');
    await expect(row).toContainText('2026');
    await expect(row.locator('.assessment-history-list__summary')).toHaveText(text.summary);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.goto('/habits/paradigms');
    await expect(page.locator('app-habit-hub-page .hub-status')).toBeVisible();
  });

  // Issue #226 review: Chromium fires `input` and `change` for every segment typed, so saving on
  // those stored each in-between date (typing 31 Aug over 25 Sep passes through 3 Sep). Arrow keys
  // step the focused segment in every locale's field order, and every step is a valid past date.
  test('a date edited segment by segment is stored once, when the user leaves the field', async ({
    page,
  }) => {
    await page.goto('/habits/paradigms/pc-balance');
    await page.locator('.add-button').click();
    const form = page.locator('app-pc-balance-audit-form');
    await form.locator('.add-asset-row input[type="text"]').first().fill('Sleep');
    await form.locator('.add-asset-row button').first().click();

    const dateInput = form.locator('app-assessment-date-field input');
    const original = await dateInput.inputValue();
    await expect.poll(() => storedAuditDates(page)).toEqual([original]);

    await dateInput.focus();
    for (let step = 0; step < 3; step++) {
      await dateInput.press('ArrowDown');
    }
    const typed = await dateInput.inputValue();
    expect(typed).not.toBe(original);

    // Longer than the 500 ms save debounce: nothing in between has been stored.
    await page.waitForTimeout(1000);
    expect(await storedAuditDates(page)).toEqual([original]);

    await dateInput.blur();
    await expect.poll(() => storedAuditDates(page)).toEqual([typed]);
    await expect(dateInput).toHaveValue(typed);
  });

  // Bug #271: typing digits auto-advances to the next segment, and Chromium fires that `change`
  // with focus on `<body>`, so a "commit an unfocused change" path stored the in-between dates.
  // `01 01 2025` is 1 Jan 2025 in either day/month order, and each in-between date is in the past.
  test('a date typed digit by digit is stored once, when the user leaves the field', async ({
    page,
  }) => {
    await page.goto('/habits/paradigms/pc-balance');
    await page.locator('.add-button').click();
    const form = page.locator('app-pc-balance-audit-form');
    await form.locator('.add-asset-row input[type="text"]').first().fill('Sleep');
    await form.locator('.add-asset-row button').first().click();

    const dateInput = form.locator('app-assessment-date-field input');
    const original = await dateInput.inputValue();
    await expect.poll(() => storedAuditDates(page)).toEqual([original]);

    await dateInput.focus();
    await page.keyboard.type('01012025', { delay: 100 });
    await expect(dateInput).toHaveValue('2025-01-01');

    // Longer than the 500 ms save debounce: nothing in between has been stored.
    await page.waitForTimeout(1000);
    expect(await storedAuditDates(page)).toEqual([original]);

    await page.keyboard.press('Enter');
    await expect.poll(() => storedAuditDates(page)).toEqual(['2025-01-01']);
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
