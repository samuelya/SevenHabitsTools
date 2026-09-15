import { expect, test } from './fixtures';

/**
 * Issue #119: a GitHub icon link in the desktop side-nav footer, and the same link (with a
 * visible label) on the About page for mobile, where the side-nav footer isn't shown. `/about`
 * already gets an accessibility scan from `smoke.spec.ts`'s per-page loop, which now also covers
 * this link since it renders unconditionally on that page.
 */

const REPO_URL = 'https://github.com/samuelya/SevenHabitsTools';

test.describe('GitHub link', () => {
  test('desktop: is visible in the side-nav footer with the right attributes', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('desktop-'), 'Desktop-only entry point.');

    await page.goto('/');
    const link = page.locator('nav.side-nav__footer a[href="' + REPO_URL + '"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('aria-label', 'Source code on GitHub');
    await expect(link.locator('svg')).toBeVisible();
  });

  test('mobile: is visible on the About page with a visible label', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile-'), 'Mobile-only entry point.');

    await page.goto('/about');
    const link = page.locator('app-about-page a[href="' + REPO_URL + '"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link.getByText('GitHub')).toBeVisible();
  });
});
