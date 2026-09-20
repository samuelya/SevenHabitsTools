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
  {
    hubTitle: string;
    markDone: string;
    reopen: string;
    stopToggle: string;
    cancel: string;
    delete: string;
    undo: string;
  }
> = {
  en: {
    hubTitle: 'Become a transition person',
    markDone: 'Mark done',
    reopen: 'Reopen',
    stopToggle: 'Stop',
    cancel: 'Cancel',
    delete: 'Delete',
    undo: 'Undo',
  },
  ar: {
    hubTitle: 'كن حلقة انتقال إيجابية',
    markDone: 'وضع علامة تم',
    reopen: 'إعادة فتح',
    stopToggle: 'أوقفه',
    cancel: 'إلغاء',
    delete: 'حذف',
    undo: 'تراجع',
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

    const addButton = page.locator('.add-button');
    await addButton.click();
    // The selected script is the optional trailing segment `:itemId` on this page's own route
    // (issue #187, owner decision on #184).
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
      // exercise page (issue #187, owner decision on #184: option (b), the child segment).
      await page.goBack();
      await expect(page).toHaveURL(/\/habits\/paradigms\/transition$/);
      await expect(form).not.toBeVisible();
    } else {
      await page.locator('app-exercise-page .editor-close').click();
      await expect(page.locator('.editor-panel')).not.toBeVisible();
    }

    // Closing the editor is a param change on the page's own route, so the page instance survives
    // and the kit can hand focus back to the control that opened it, with the intro card still
    // collapsed (owner decision on #184). The sibling-route version rebuilt the page here, which
    // dropped focus to `<body>` and re-expanded the intro (issue #187).
    await expect(addButton).toBeFocused();
    await expect(page.locator('app-exercise-prompt-card .content')).toHaveCount(0);

    await expect(page.locator('app-transition-summary')).toBeVisible();
    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    // Longer than the 500 ms save debounce (`SAVE_DEBOUNCE_MS`, `document-persistence.ts`) — see
    // `e2e/multi-tab.spec.ts`'s own comment on the same wait before relying on persisted state.
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('.exercise-list__item')).toHaveCount(1);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.goto('/habits/paradigms');
    await expect(page.locator('app-habit-hub-page .hub-status')).toBeVisible();
  });

  test('layout: touch targets and a footer at the bottom edge of a short page', async ({
    page,
  }, testInfo) => {
    // Geometry the unit suite can't see: all three were shipped as "fixed" and measured wrong on
    // the real build (issues #193, #194, #195).
    const isMobile = testInfo.project.name.startsWith('mobile');
    await page.goto('/habits/paradigms/transition');

    if (isMobile) {
      // Full width below the handset breakpoint, not a left-aligned pill (#195).
      const addButton = await page.locator('.add-button').boundingBox();
      const contentSlot = await page.locator('app-exercise-page .content-slot').boundingBox();
      expect(addButton!.width).toBeGreaterThanOrEqual(contentSlot!.width - 1);
    }

    await page.locator('.add-button').click();
    const form = page.locator('app-transition-item-form');
    await expect(form).toBeVisible();

    // Every toggle meets the 44 px touch target (#194).
    const toggleHeights = await form
      .locator('mat-button-toggle')
      .evaluateAll((toggles) => toggles.map((toggle) => toggle.getBoundingClientRect().height));
    expect(toggleHeights.length).toBeGreaterThan(0);
    expect(Math.min(...toggleHeights)).toBeGreaterThanOrEqual(44);

    if (isMobile) {
      await page.goBack();
    } else {
      await page.locator('app-exercise-page .editor-close').click();
    }
    await expect(form).not.toBeVisible();

    // One script and a collapsed intro: the shortest the page ever gets, and the case where a
    // sticky footer alone stays in flow because nothing scrolls (#193).
    const footer = await page.locator('.footer-slot').boundingBox();
    const pageArea = await page.locator('main.page').boundingBox();
    expect(pageArea!.y + pageArea!.height - (footer!.y + footer!.height)).toBeLessThanOrEqual(24);
  });

  // Issue #213: the shared fix on `exercise-page.scss` applies to every split-mode editor, not
  // just the tall maturity form (`e2e/paradigms-maturity.spec.ts` has the primary repro).
  test('desktop split mode: the footer never overlaps the editor column', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.startsWith('mobile'),
      'split mode only exists at or above HANDSET_QUERY',
    );
    await page.setViewportSize({ width: 1280, height: 1500 });
    await page.goto('/habits/paradigms/transition');

    await page.locator('.add-button').click();
    const form = page.locator('app-transition-item-form');
    await expect(form).toBeVisible();

    const deleteButton = form.locator('.delete-button');
    await deleteButton.scrollIntoViewIfNeeded();

    const footerBox = await page.locator('app-exercise-page .footer-slot').boundingBox();
    const buttonBox = await deleteButton.boundingBox();
    expect(footerBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(footerBox!.y);
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

  test('accessibility: the open editor has no serious or critical violations', async ({ page }) => {
    // Focus mode is its own screen, with its own header, an `inert` page behind it and (on
    // handset) a CDK focus trap — none of which the list-only scan above reaches.
    await page.goto('/habits/paradigms/transition');
    await page.locator('.add-button').click();
    await expect(page.locator('app-transition-item-form')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });

  // Issue #203: the shared delete pattern via the list's own bin button — Cancel leaves the script
  // in place, Delete tombstones it and offers Undo through the snackbar.
  test('deletes a script from the list, with a confirm dialog and an Undo snackbar', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    const isMobile = testInfo.project.name.startsWith('mobile');
    await page.goto('/habits/paradigms/transition');

    await page.locator('.add-button').click();
    const form = page.locator('app-transition-item-form');
    await form.locator('textarea').first().fill('Old habit to remove');
    if (isMobile) {
      await page.goBack();
    } else {
      await page.locator('app-exercise-page .editor-close').click();
    }
    await expect(form).not.toBeVisible();
    await expect(page.locator('.exercise-list__item')).toHaveCount(1);

    const deleteButton = page.locator('.exercise-list__delete');
    // Reachable by keyboard, not just click — acceptance criteria's "bin button reachable by Tab".
    await deleteButton.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Cancel focused by default (acceptance criteria).
    await expect(page.getByRole('button', { name: text.cancel })).toBeFocused();

    // Cancel leaves the item untouched, and returns focus to the button that opened the dialog.
    await page.keyboard.press('Enter');
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.exercise-list__item')).toHaveCount(1);
    await expect(deleteButton).toBeFocused();

    // Delete tombstones it and offers Undo.
    await deleteButton.click();
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: text.cancel })).toBeFocused();
    // `toBeVisible()`/`toBeFocused()` only confirm the dialog is in the DOM and focused, not that
    // its CDK-driven enter transition (opacity/transform) has finished, or that Noto Sans Arabic
    // has finished loading — both leave axe scanning a not-yet-settled state (the Delete button
    // blended with the backdrop mid-transition; the still-loading fallback font's wider glyphs
    // briefly overflowing the dialog's content area, which `smoke.spec.ts`'s own `document.fonts
    // .ready` wait exists to rule out).
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
    await page.getByRole('button', { name: text.delete, exact: true }).click();
    await expect(page.locator('.exercise-list__item')).toHaveCount(0);
    const undoButton = page.getByRole('button', { name: text.undo });
    await expect(undoButton).toBeVisible();

    await undoButton.click();
    await expect(page.locator('.exercise-list__item')).toHaveCount(1);
  });
});
