import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Maturity continuum self-assessment (issue #50): the second **assessment** exercise (playbook
 * §4), reusing #49's `assessment-history.logic.ts`. Happy path from the habit hub — start an
 * assessment, rate every area, see the overall profile, mark the exercise done, and confirm it
 * survives a reload and shows on the hub. No `seedDocument` call, so each project renders
 * whichever language its own locale defaults to (`mobile-ar`/`desktop-ar`, per
 * `playwright.config.ts`), same as `e2e/paradigms-transition.spec.ts`.
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
    cancel: string;
    delete: string;
    undo: string;
  }
> = {
  en: {
    hubTitle: 'See where you stand on the growth continuum',
    markDone: 'Mark done',
    reopen: 'Reopen',
    cancel: 'Cancel',
    delete: 'Delete',
    undo: 'Undo',
  },
  ar: {
    hubTitle: 'اعرف موقعك على مسار النضج',
    markDone: 'وضع علامة تم',
    reopen: 'إعادة فتح',
    cancel: 'إلغاء',
    delete: 'حذف',
    undo: 'تراجع',
  },
};

test.describe('maturity continuum self-assessment', () => {
  test('rates every area, sees the overall profile, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    // Focus mode is a full-screen panel on handset that hides the footer (and its `DoneToggle`)
    // entirely while open (`showFooter`, `exercise-page.ts`) — the same layout `paradigms-
    // transition.spec.ts` accounts for, closing the editor before checking it.
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/paradigms');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/maturity$/);

    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/maturity\/[^/]+$/);
    const form = page.locator('app-maturity-assessment-form');
    await expect(form).toBeVisible();

    const rows = form.locator('.area-row');
    await expect(rows).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await rows.nth(i).locator('.level-option input[type="radio"]').first().check();
    }

    await expect(page.locator('app-maturity-result .profile')).toBeVisible();

    if (isMobile) {
      await page.goBack();
      await expect(page).toHaveURL(/\/habits\/paradigms\/maturity$/);
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
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.goto('/habits/paradigms');
    await expect(page.locator('app-habit-hub-page .hub-status')).toBeVisible();
  });

  test('accessibility: the assessment page and its open editor have no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/paradigms/maturity');
    const listResults = await new AxeBuilder({ page }).analyze();
    expect(
      listResults.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.locator('.add-button').click();
    await expect(page.locator('app-maturity-assessment-form')).toBeVisible();
    const editorResults = await new AxeBuilder({ page }).analyze();
    expect(
      editorResults.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });

  // Issue #213: desktop split mode used to let a tall editor grow the grid row past the
  // viewport, putting the sticky footer over the last field. The six built-in areas with a
  // filled-in note each (autosizing to its max rows, `cdkAutosizeMaxRows`) is the primary repro
  // for the shared fix (`exercise-page.scss`) — an *empty* form isn't tall enough at 1280x1500 to
  // reach the bug.
  test('desktop split mode: the footer never overlaps the last area note field', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.startsWith('mobile'),
      'split mode only exists at or above HANDSET_QUERY',
    );
    await page.setViewportSize({ width: 1280, height: 1500 });
    await page.goto('/habits/paradigms/maturity');

    await page.locator('.add-button').click();
    const form = page.locator('app-maturity-assessment-form');
    await expect(form).toBeVisible();

    const noteFields = form.locator('.area-row .area-note textarea');
    const areaCount = await noteFields.count();
    for (let i = 0; i < areaCount; i++) {
      await noteFields.nth(i).fill('one\ntwo\nthree\nfour\nfive\nsix\nseven');
    }

    const lastNote = form.locator('.area-row').last().locator('.area-note');
    await lastNote.scrollIntoViewIfNeeded();
    await expect(lastNote).toBeInViewport();

    const footerBox = await page.locator('app-exercise-page .footer-slot').boundingBox();
    const noteBox = await lastNote.boundingBox();
    expect(footerBox).not.toBeNull();
    expect(noteBox).not.toBeNull();
    // The two boxes never intersect: the note field's bottom edge stays above the footer's top.
    expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(footerBox!.y);
  });

  // Review round 1 on #213's PR: the first fix only bounded the *editor* column, so a `.body`
  // column (the history list) taller than the viewport reopened the same bug from the other side
  // — grew row 1 past the viewport and put the sticky footer over the still-visible editor
  // underneath. 14 saved assessments at 1280x800 is the review's own measured repro; an empty or
  // short history isn't tall enough to reach it.
  test('desktop split mode with a long history: the footer never overlaps the editor underneath', async ({
    page,
    seedDocument,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.startsWith('mobile'),
      'split mode only exists at or above HANDSET_QUERY',
    );
    const now = '2026-01-01T00:00:00.000Z';
    const assessments = Array.from({ length: 14 }, (_, i) => ({
      id: `maturity-history-${i}`,
      createdAt: now,
      updatedAt: now,
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      areas: [],
    }));
    await seedDocument({ habits: { paradigms: { maturity: assessments } } });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/habits/paradigms/maturity/${assessments[0].id}`);

    const form = page.locator('app-maturity-assessment-form');
    await expect(form).toBeVisible();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(14);

    const body = page.locator('app-exercise-page .body');
    // Confirms the repro is actually exercised — the list is taller than the space it's given, so
    // it scrolls on its own instead of growing row 1 (a vacuous pass here would mean the test
    // stopped reproducing the bug, the same trap review flagged on the transition/pc-balance
    // tests).
    const isBodyScrollable = await body.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(isBodyScrollable).toBe(true);

    const footerBox = await page.locator('app-exercise-page .footer-slot').boundingBox();
    expect(footerBox).not.toBeNull();
    // Same hit-test review used to catch the bug: nothing at the footer's own bar, checked at its
    // vertical mid-point and near its inline end, resolves to the editor form underneath it.
    for (const fraction of [0.5, 0.85]) {
      const point = {
        x: footerBox!.x + footerBox!.width * fraction,
        y: footerBox!.y + footerBox!.height / 2,
      };
      const hitsForm = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.closest('form') !== null,
        point,
      );
      expect(hitsForm).toBe(false);
    }

    const markDoneButton = page.locator('app-done-toggle button');
    await expect(markDoneButton).toBeInViewport();
  });

  // Issue #203: the shared delete pattern via the history's own bin button — Cancel leaves the
  // assessment in place, Delete tombstones it and offers Undo through the snackbar.
  test('deletes an assessment from the history, with a confirm dialog and an Undo snackbar', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    const isMobile = testInfo.project.name.startsWith('mobile');
    await page.goto('/habits/paradigms/maturity');

    await page.locator('.add-button').click();
    const form = page.locator('app-maturity-assessment-form');
    await expect(form).toBeVisible();
    if (isMobile) {
      await page.goBack();
    } else {
      await page.locator('app-exercise-page .editor-close').click();
    }
    await expect(form).not.toBeVisible();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(1);

    await page.locator('.assessment-history-list__delete').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Cancel leaves the assessment untouched.
    await page.getByRole('button', { name: text.cancel }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(1);

    // Delete tombstones it and offers Undo.
    await page.locator('.assessment-history-list__delete').click();
    await page.getByRole('button', { name: text.delete, exact: true }).click();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(0);
    const undoButton = page.getByRole('button', { name: text.undo });
    await expect(undoButton).toBeVisible();

    await undoButton.click();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(1);
  });
});
