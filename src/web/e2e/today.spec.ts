import { expect, test } from './fixtures';

/**
 * Home as "Today" (issue #220), in both languages and at both viewport sizes: the first-run
 * paragraph, the Continue card (fully visible at 360×800, with margin), the progress rows, and the
 * paragraph disappearing after the first "Mark done" anywhere. Registry-driven cases (status line,
 * "All done for now") live in `src/app/features/home/home.spec.ts`.
 */

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

const TEXT = {
  en: {
    firstRun: 'This app follows the book, chapter by chapter.',
    continue: 'Continue: Your paradigm',
    markDone: 'Mark done',
    reopen: 'Reopen',
    home: 'Home',
  },
  ar: {
    firstRun: 'التطبيق ماشي مع الكتاب فصل بفصل.',
    continue: 'متابعة: إطارك الذهني',
    markDone: 'تحديد كمكتمل',
    reopen: 'إعادة فتح',
    home: 'الرئيسية',
  },
};

test.describe('Today', () => {
  test('first run: the paragraph, a Continue card to the first exercise and two progress rows', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    await page.goto('/');

    await expect(page.locator('.today-first-run')).toContainText(text.firstRun);
    const card = page.getByRole('link', { name: text.continue });
    await expect(card).toHaveAttribute('href', '/habits/paradigms/perception');
    const rows = page.locator('.today-progress a');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('href', '/habits/paradigms');
    await expect(rows.nth(1)).toHaveAttribute('href', '/habits/h1');
  });

  test('the Continue card is fully visible without scrolling, with the export reminder showing too', async ({
    page,
    seedDocument,
  }, testInfo) => {
    // Worst case above the card: the export reminder (edited, never exported, 7+ days old) and the
    // first-run paragraph.
    await seedDocument({
      meta: {
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        appVersion: '0.0.0',
        deviceId: '11111111-1111-4111-8111-111111111111',
      },
    });
    await page.goto('/');
    await expect(page.locator('app-export-reminder-banner')).toBeVisible();
    await expect(page.locator('.today-first-run')).toBeVisible();

    const card = page.locator('app-continue-card a');
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    const viewport = page.viewportSize()!;
    const bottomNav = page.locator('nav.bottom-nav');
    const visibleBottom = (await bottomNav.count())
      ? (await bottomNav.boundingBox())!.y
      : viewport.height;
    const scrollY = await page.evaluate(() => window.scrollY);
    testInfo.annotations.push({
      type: 'continue-card',
      description: `bottom ${Math.round(box.y + box.height)} of ${Math.round(visibleBottom)} visible`,
    });
    expect(scrollY).toBe(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    // At least 10% of the visible height to spare: CI's fonts render wider (and so taller when
    // wrapped) than a developer's machine.
    expect(box.y + box.height).toBeLessThanOrEqual(visibleBottom * 0.9);
  });

  test('the first-run paragraph is gone after the first "Mark done" anywhere', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    // One shared chapter meets the teach exercise's done gate.
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
              plannedAt: '2026-12-01',
              status: 'shared',
            },
          ],
        },
      },
    });
    await page.goto('/');
    await expect(page.locator('.today-first-run')).toBeVisible();

    await page.goto('/habits/paradigms/teach');
    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    const isMobile = testInfo.project.name.startsWith('mobile-');
    const nav = page.locator(isMobile ? 'nav.bottom-nav' : 'nav.side-nav__main');
    await nav.getByRole('link', { name: text.home, exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: text.continue })).toBeVisible();
    await expect(page.locator('.today-first-run')).toHaveCount(0);

    // Derived from the stored completion, so it stays gone after a reload too. Longer than the
    // 500 ms save debounce (`SAVE_DEBOUNCE_MS`) before relying on persisted state.
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByRole('link', { name: text.continue })).toBeVisible();
    await expect(page.locator('.today-first-run')).toHaveCount(0);
  });
});
