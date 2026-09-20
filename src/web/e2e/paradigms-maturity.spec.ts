import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
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

/** 14 saved assessments: review round 1's own measured repro for a history column taller than the
 * page area at 1280x800. An empty or short history never reaches it. */
function longHistory(): {
  id: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  areas: [];
}[] {
  const now = '2026-01-01T00:00:00.000Z';
  return Array.from({ length: 14 }, (_, i) => ({
    id: `maturity-history-${i}`,
    createdAt: now,
    updatedAt: now,
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    areas: [] as [],
  }));
}

/** How much taller than its visible box `.page` (the shell's scroll container) is — 0 while the
 * split editor is the whole page area, which is the guarantee issue #213 restores. */
async function pageOverflow(page: Page): Promise<number> {
  return page.locator('main.page').evaluate((el) => el.scrollHeight - el.clientHeight);
}

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
    const assessments = longHistory();
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
      const hit = await page.evaluate(({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return { hitsSomething: element !== null, hitsForm: element?.closest('form') != null };
      }, point);
      // Both halves asserted, and `!= null` rather than `!== null`: `elementFromPoint` returns
      // `null` for a point outside the viewport, so the strict form turned `undefined !== null`
      // into `true` and reported "the footer isn't on screen at all" as "the footer hit-tests
      // into the editor form" (review round 3, finding 5).
      expect(hit.hitsSomething).toBe(true);
      expect(hit.hitsForm).toBe(false);
    }

    const markDoneButton = page.locator('app-done-toggle button');
    await expect(markDoneButton).toBeInViewport();

    // Review round 2's own finding, from the other direction: the split grid takes its height
    // from `.page` (the shell's scroll container) itself, so opening the editor must not make the
    // content area scrollable when it wasn't. A measured height that is even 16px too tall shows
    // up here as a scrollbar on `.page` and the bottom of the footer row below the fold.
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
  });

  // Review round 2, finding 2: the previous fix measured the *viewport*, not `.page`, so opening
  // an item after scrolling the history column sized the grid to `viewportHeight + scrollTop` —
  // the page stayed scrollable by that much and scrolling up carried the footer row, summary and
  // "Mark done" included, out of view. Bounding the grid by the scroll container instead leaves
  // nothing to overflow, so the browser clamps the scroll offset back to 0 on open.
  test('desktop split mode: opening an item after scrolling the history keeps the footer on screen', async ({
    page,
    seedDocument,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.startsWith('mobile'),
      'split mode only exists at or above HANDSET_QUERY',
    );
    await seedDocument({ habits: { paradigms: { maturity: longHistory() } } });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/habits/paradigms/maturity');
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(14);

    const scrollArea = page.locator('main.page');
    await scrollArea.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    // The list alone really is taller than the page area, i.e. the repro is set up.
    expect(await scrollArea.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await page.locator('.assessment-history-list__item').last().click();
    await expect(page.locator('app-maturity-assessment-form')).toBeVisible();

    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    expect(await scrollArea.evaluate((el) => el.scrollTop)).toBe(0);
    await expect(page.locator('app-exercise-page .footer-slot')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('app-done-toggle button')).toBeInViewport({ ratio: 1 });

    // Review round 3, finding 4: the same open makes `.body` a brand-new scroll container at
    // `scrollTop: 0` while `.page`'s own offset clamps back to 0, so the row just clicked was
    // carried off screen and the master-detail context was lost on every open-after-scroll.
    // `toBeInViewport` intersects with every ancestor clip, so a row scrolled out of `.body`
    // fails here even though it is inside the viewport's rectangle.
    const selectedRow = page.locator('.assessment-history-list__item[aria-pressed="true"]');
    await expect(selectedRow).toHaveCount(1);
    await expect(selectedRow).toBeInViewport({ ratio: 1 });
  });

  // Review round 2, finding 3: the shell renders the offline indicator, the read-only banner and
  // the PWA install banner above the toolbar, and all three appear and disappear at runtime —
  // none of them a `ViewportRuler.change()` trigger. Losing the network mid-edit shrinks `.page`;
  // the split grid has to follow, or the footer row is pushed below the fold. Taking the height
  // from `.page` in CSS makes that a plain relayout, with nothing to subscribe to.
  test('desktop split mode: the offline indicator appearing mid-edit keeps the footer on screen', async ({
    page,
    seedDocument,
    goOffline,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.startsWith('mobile'),
      'split mode only exists at or above HANDSET_QUERY',
    );
    const history = longHistory();
    await seedDocument({ habits: { paradigms: { maturity: history } } });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/habits/paradigms/maturity/${history[0].id}`);
    await expect(page.locator('app-maturity-assessment-form')).toBeVisible();

    const indicator = page.locator('app-offline-indicator .offline-indicator');
    await expect(indicator).toBeHidden();
    await goOffline();
    await expect(indicator).toBeVisible();

    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    await expect(page.locator('app-exercise-page .footer-slot')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('app-done-toggle button')).toBeInViewport({ ratio: 1 });
  });

  // Review round 3, finding 1: with the grid strictly bounded to `.page`, a *short* page area let
  // the footer row plus the 1rem gap eat the whole grid — row 1, and with it the `inset: 0`
  // editor panel, collapsed to 0px while the user was typing into it, and the bounded grid left
  // no page scroll to escape with. The real case is a landscape phone (844x390, above
  // `HANDSET_QUERY`, so it gets split mode) whose on-screen keyboard shrinks the viewport to
  // ~200px (`index.html`'s `interactive-widget=resizes-content`); 900x220 reproduces the same
  // page-area height without driving a keyboard. `--split-row-floor` (16rem) is the fix.
  test('desktop split mode: a short page area keeps the editor above its floor and the page scrollable', async ({
    page,
    seedDocument,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.startsWith('mobile'),
      'split mode only exists at or above HANDSET_QUERY',
    );
    const history = longHistory();
    await seedDocument({ habits: { paradigms: { maturity: history } } });
    await page.setViewportSize({ width: 900, height: 220 });
    await page.goto(`/habits/paradigms/maturity/${history[0].id}`);
    await expect(page.locator('app-maturity-assessment-form')).toBeVisible();

    const layout = await page.evaluate(() => {
      const rect = (selector: string) =>
        (document.querySelector(selector) as HTMLElement).getBoundingClientRect();
      const panel = rect('app-exercise-page .editor-panel');
      const footer = rect('app-exercise-page .footer-slot');
      const pageEl = document.querySelector('main.page') as HTMLElement;
      return {
        panelHeight: panel.height,
        panelBottom: panel.bottom,
        footerTop: footer.top,
        pageOverflow: pageEl.scrollHeight - pageEl.clientHeight,
        pageClient: pageEl.clientHeight,
      };
    });

    // The repro is real: the page area itself is far shorter than the floor (measured 156px here,
    // against a 151px footer), so this is the configuration that used to collapse row 1 to 0.
    expect(layout.pageClient).toBeLessThan(256);
    // 16rem, the measured floor (`exercise-page.scss`): the editor is still usable.
    expect(layout.panelHeight).toBeGreaterThanOrEqual(256);
    // And the escape hatch is back — the scaffold overflows `.page`, which scrolls again.
    expect(layout.pageOverflow).toBeGreaterThan(0);
    // The footer row starts below the editor instead of riding back over it: inside this grid its
    // own row is its sticky containing block, so it has nowhere to shift to.
    expect(layout.footerTop).toBeGreaterThanOrEqual(layout.panelBottom - 1);
  });

  // Review round 3, finding 2: the shell rule that lends the scaffold `.page`'s height
  // (`shell.scss`) keys on `<app-exercise-page>` being the routed host's own child. When a page
  // nests it deeper the rule stops matching and the grid is content-sized — and because the
  // editor panel is absolutely positioned, row 1 is then sized by the history column *alone*, so
  // the editor is clipped to that column's height (measured on `ba34b11`: a 190px panel around a
  // 3149px form), not left in "the pre-#213 layout" as the code and the playbook both claimed.
  // The only page in that shape is the dev-only `/dev/kit` route, which isn't registered in the
  // build this suite runs against (`route-registry.ts`), so the nesting is reproduced here in the
  // DOM: moving the routed host into a wrapper is exactly what makes `:has()` stop matching.
  test('desktop split mode: a page that nests the scaffold still gets a usable editor', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.startsWith('mobile'),
      'split mode only exists at or above HANDSET_QUERY',
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/habits/paradigms/maturity');
    await page.locator('.add-button').click();
    await expect(page.locator('app-maturity-assessment-form')).toBeVisible();

    await page.locator('app-maturity-page').evaluate((host) => {
      const wrapper = document.createElement('div');
      host.parentElement!.insertBefore(wrapper, host);
      wrapper.appendChild(host);
    });

    const layout = await page.evaluate(() => {
      const el = (selector: string) => document.querySelector(selector) as HTMLElement;
      const panel = el('app-exercise-page .editor-panel');
      const body = el('app-exercise-page .body');
      const firstSlot = body.firstElementChild!.getBoundingClientRect();
      const lastSlot = body.lastElementChild!.getBoundingClientRect();
      return {
        // Not `scrollHeight`: the column is stretched to the row, so that can never come out
        // below the floor. The slots' own extent is what row 1 used to be sized by.
        bodyContent: lastSlot.bottom - firstSlot.top,
        panelHeight: panel.getBoundingClientRect().height,
        panelContent: panel.scrollHeight,
      };
    });

    // The repro is real: an empty history is a column shorter than the floor (190px of content on
    // `ba34b11`, which is exactly what the editor was clipped to), and the form inside the editor
    // is many times taller than it.
    expect(layout.bodyContent).toBeLessThan(256);
    expect(layout.panelContent).toBeGreaterThan(1000);
    // The row floor holds the editor open even with no height coming down from `.page`.
    expect(layout.panelHeight).toBeGreaterThanOrEqual(256);
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
