import { expect, test } from './fixtures';

/**
 * Issue #119: a GitHub row in the desktop side-nav footer, and the same link (with a visible
 * label) on the About page for mobile, where the side-nav footer isn't shown. Issue #135
 * repositions the footer to the bottom of the sidenav and restyles the row to match the main
 * nav. `/about` already gets an accessibility scan from `smoke.spec.ts`'s per-page loop, which
 * now also covers this link since it renders unconditionally on that page.
 */

const REPO_URL = 'https://github.com/samuelya/SevenHabitsTools';

/** How close the GitHub row's bottom edge must be to the sidenav's bottom edge to call it "pinned". */
const PIN_TOLERANCE_PX = 24;

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
    await expect(link).toHaveAttribute('aria-label', 'GitHub, opens in a new tab');
    await expect(link.locator('svg')).toBeVisible();
  });

  test('desktop: the footer, with the GitHub row, is pinned to the bottom of the sidenav', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('desktop-'), 'Desktop-only entry point.');

    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 1280, height: 500 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const sidenav = page.locator('mat-sidenav');
      const link = page.locator('nav.side-nav__footer a[href="' + REPO_URL + '"]');
      await expect(link).toBeVisible();

      const [sidenavBox, linkBox] = await Promise.all([sidenav.boundingBox(), link.boundingBox()]);
      expect(sidenavBox).not.toBeNull();
      expect(linkBox).not.toBeNull();
      const gap = sidenavBox!.y + sidenavBox!.height - (linkBox!.y + linkBox!.height);
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(PIN_TOLERANCE_PX);

      // The footer never overlaps the main nav above it.
      const footerBox = await page.locator('nav.side-nav__footer').boundingBox();
      const mainBox = await page.locator('nav.side-nav__main').boundingBox();
      expect(footerBox!.y).toBeGreaterThanOrEqual(mainBox!.y + mainBox!.height);
    }
  });

  test('desktop: no stray line is rendered under the active About row', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('desktop-'), 'Desktop-only entry point.');

    await page.goto('/about');
    const footer = page.locator('nav.side-nav__footer');
    // The only rule (border) in the footer is the one divider above it, between the main nav
    // and the footer; the active About row itself has no border, outline or box-shadow other
    // than a keyboard focus-visible ring, which isn't showing here (it wasn't tabbed to).
    const about = footer.locator('a[href="/about"]');
    const style = await about.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { outline: cs.outlineStyle, border: cs.borderStyle, boxShadow: cs.boxShadow };
    });
    expect(style.outline).toBe('none');
    expect(style.border).toBe('none');
    expect(style.boxShadow).toBe('none');

    const dividers = await footer.locator('mat-divider, hr').count();
    expect(dividers).toBe(0);
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
