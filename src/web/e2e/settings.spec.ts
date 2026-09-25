import { expect, test } from './fixtures';

/**
 * Regression test for #144: the Settings storage estimate is refreshed when the page opens (not
 * left over from the previous page load) and phrased as the app's own usage, never as a raw
 * "used / quota" byte pair — the number after the slash was the browser's per-origin quota, not
 * disk usage, and read like it on the owner's real device.
 */

/** No `seedDocument` call in this spec, so — same as `smoke.spec.ts`'s untranslated-key walk —
 * each project renders whichever language its own locale defaults to
 * (`mobile-ar`/`desktop-ar`, per `playwright.config.ts`). */
const FRIENDLY_USAGE_PATTERN: Record<'en' | 'ar', RegExp> = {
  en: /using (less than 1 KB|about)/,
  ar: /(أقل من كيلوبايت واحد|حوالي)/,
};

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

test.describe('settings storage estimate', () => {
  test('shows a friendly usage message, not a raw "used / quota" pair', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings');
    const storageSection = page.locator('#storage');
    await expect(storageSection).toBeVisible();

    await expect
      .poll(() => storageSection.textContent())
      .toMatch(FRIENDLY_USAGE_PATTERN[localeFor(testInfo.project.name)]);
    expect(await storageSection.textContent()).not.toMatch(/\d+(\.\d+)? ?[KMGT]?B ?\//);
  });
});
