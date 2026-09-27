import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * Your mission (issue #61). Happy path from the hub, with Habit 2's inputs seeded: keep a value
 * from a long view and add one of your own, keep a principle from Your centre, write a role line,
 * a "to be" line and the draft, borrow a line from the collection with "Use this", answer a review
 * question, save a version, check the hub's status, mark the exercise done and reload. Then #62:
 * save a second version with a note, compare it with the first, set a monthly rhythm, and with a
 * seeded overdue review see the page's banner and the hub's "Review due".
 */

function localeFor(testInfo: TestInfo): Locale {
  return testInfo.project.name.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const own = (key: string, params?: Record<string, string | number>) =>
    t(locale, 'h2Mission', key, params);
  return {
    hubTitle: t(locale, 'habits', 'exercises.h2-mission.shortTitle'),
    hubStatus: t(
      locale,
      'habits',
      `exercises.h2-mission.versionCount.${new Intl.PluralRules(locale).select(1)}`,
      { count: 1 },
    ),
    integrity: t(locale, 'exerciseKit', 'principle.integrity'),
    next: t(locale, 'exerciseKit', 'stepper.next'),
    useButton: own('panel.useButton'),
    usedText: own('panel.usedText'),
    yes: own('review.yes'),
    saveVersion: own('step6.saveVersionButton'),
    savedText: own('step6.savedText', { n: 1 }),
    checklistVersion: own('checklist.version'),
    savedSecond: own('step6.savedText', { n: 2 }),
    compare: own('versions.compareButton'),
    diffSummary: own('versions.diffSummaryText', {
      added: own(`versions.addedCountText.${new Intl.PluralRules(locale).select(4)}`, { count: 4 }),
      removed: own(`versions.removedCountText.${new Intl.PluralRules(locale).select(1)}`, {
        count: 1,
      }),
    }),
    monthly: own('interval.monthly'),
    dueTitle: own('review.dueTitle'),
    reviewed: own('review.reviewedButton'),
    reviewDue: t(
      locale,
      'habits',
      `exercises.h2-mission.reviewDue.${new Intl.PluralRules(locale).select(1)}`,
    ),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

const ROUTE = '/habits/h2/mission';
const T = '2026-09-20T08:00:00.000Z';
const BORROWED = 'Leave before you are tired.';

/** Values, principles, a role and a collection item: the inputs the mission pulls in. */
function inputs() {
  const base = (id: string) => ({ id, createdAt: T, updatedAt: T });
  return {
    shared: {
      roles: [
        {
          ...base('7c1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6'),
          name: 'Parent',
          color: 'blue',
          order: 0,
        },
      ],
    },
    habits: {
      paradigms: {},
      h1: {},
      h2: {
        longViews: [
          {
            ...base('8d2f3a4b-5c6d-4e7f-8a91-92b3c4d5e6f7'),
            scenario: 'funeral',
            date: '2026-09-20',
            answers: [
              { promptKey: 'funeral.family', text: 'She was there.', values: ['presence'] },
            ],
          },
        ],
        centres: [
          {
            ...base('9e3a4b5c-6d7e-4f80-9ba2-a3c4d5e6f708'),
            date: '2026-09-20',
            ratings: {},
            factors: {},
            principles: [{ key: 'integrity' }],
          },
        ],
        inspirations: [
          {
            ...base('af4b5c6d-7e8f-4091-8cb3-b4d5e6f70819'),
            text: BORROWED,
            kind: 'thought',
            tags: [],
          },
        ],
      },
      h3: {},
      h4: {},
      h5: {},
      h6: {},
      h7: {},
      interdependence: {},
    },
  };
}

function activeStep(page: Page) {
  return page.locator(
    '.mat-horizontal-stepper-content-current, .mat-vertical-content-container-active',
  );
}

/** Next moves the step on the next change detection (zoneless), not during the click, so wait
 * for something only the new step holds before touching it (`docs/testing.md`). */
async function toStep(page: Page, next: string, marker: string): Promise<void> {
  await activeStep(page).getByRole('button', { name: next }).click();
  await expect(activeStep(page).locator(marker).first()).toBeVisible();
}

test.describe('Your mission (h2-mission)', () => {
  test('builds a statement from the Habit 2 inputs, saves a version, marks done, and survives a reload', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    await seedDocument(inputs());

    await page.goto('/habits/h2');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h2\/mission$/);
    await expect(page.locator('.done-checklist', { hasText: text.checklistVersion })).toBeVisible();

    // Step 1: the long view's value, pressed, and one of the user's own.
    const presence = activeStep(page).locator('.suggestion', { hasText: 'presence' });
    await presence.click();
    await expect(presence).toHaveAttribute('aria-pressed', 'true');
    const ownValue = activeStep(page).locator('app-mission-chips mat-form-field input');
    await ownValue.fill('time');
    await ownValue.press('Enter');
    // The chip's label, not the row: the row's text also holds the remove icon's ligature.
    await expect(activeStep(page).locator('mat-chip-row .chip-label')).toHaveText(['time']);

    // Step 2: the principle chosen in Your centre, by its translated label.
    await toStep(page, text.next, '.suggestion');
    const integrity = activeStep(page).locator('.suggestion', { hasText: text.integrity });
    await integrity.click();
    await expect(integrity).toHaveAttribute('aria-pressed', 'true');

    // Step 3: one line for the seeded role.
    await toStep(page, text.next, '.role-line textarea');
    // Only the seeded role's section: the built-in renewal role may be listed as well.
    const parentLine = activeStep(page).locator('.role-line', { hasText: 'Parent' });
    await parentLine.locator('textarea').fill('The one who asks a second question.');

    // Step 4: a "to be" line.
    await toStep(page, text.next, 'app-mission-lines input');
    const beInput = activeStep(page).locator('app-mission-lines input').first();
    await beInput.fill('calm under pressure');
    await beInput.press('Enter');
    await expect(activeStep(page).locator('app-mission-lines .line-text')).toHaveText([
      'calm under pressure',
    ]);
    await expect(beInput).toHaveValue('');

    // Step 5: the draft, then a line borrowed from the collection.
    await toStep(page, text.next, '.draft-editor textarea');
    const draft = activeStep(page).locator('.draft-editor textarea');
    await draft.fill('I want to be present with the people I love.');
    await activeStep(page).getByRole('button', { name: text.useButton }).click();
    await expect(draft).toHaveValue(`I want to be present with the people I love.\n\n${BORROWED}`);
    await expect(activeStep(page).locator('.draft-editor .status')).toHaveText(text.usedText);
    await expect(activeStep(page).locator('app-mission-collection .used')).toBeVisible();

    // Step 6: one review answer, then save the first version.
    await toStep(page, text.next, '.review-toggle');
    await activeStep(page)
      .locator('.review-toggle')
      .first()
      .locator('mat-button-toggle', { hasText: text.yes })
      .locator('button')
      .click();
    await expect(activeStep(page).locator('.preview')).toContainText(BORROWED);
    const save = activeStep(page).getByRole('button', { name: text.saveVersion });
    await save.click();
    await expect(activeStep(page).locator('.saved')).toHaveText(text.savedText);
    await expect(save).toBeDisabled();

    // The hub's status, before Mark done (a done exercise shows its date instead). Longer than
    // the 500 ms save debounce, since `goto` reloads the app.
    await page.waitForTimeout(1000);
    await page.goto('/habits/h2');
    await expect(
      page
        .locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle })
        .locator('.hub-exercise-status'),
    ).toContainText(text.hubStatus);
    await page.goto(ROUTE);

    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();
    await expect(page.locator('.suggestion[aria-pressed="true"]')).toHaveCount(2);
    await expect(page.locator('.preview')).toContainText(BORROWED);

    // At 1280×800 the step's Next button can sit under the sticky footer, and axe then measures
    // its white label against the footer (color-contrast, 1.04:1). Centre it first. The kit has no
    // `scroll-padding` for that footer: a follow-up, not this exercise's layout.
    await activeStep(page)
      .locator('.step-actions')
      .evaluate((actions) => actions.scrollIntoView({ block: 'center' }));
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });

  test('saves a second version with a note, compares, sets a rhythm, and shows a due review (#62)', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    const mission = {
      id: 'b05c6d7e-8f90-4a1b-9dc4-c5e6f708192a',
      createdAt: T,
      updatedAt: T,
      values: [],
      principles: [],
      roleLines: [],
      toBe: [],
      toDo: [],
      draft: 'I keep my word and call first.',
      checklist: {},
      versions: [{ id: 'v1', savedAt: T, text: 'I keep my word.' }],
    };
    const withMission = (fields: object) => {
      const doc = inputs();
      return { ...doc, habits: { ...doc.habits, h2: { mission: { ...mission, ...fields } } } };
    };
    await seedDocument(withMission({}));
    await page.goto(ROUTE);

    // Step 6: a second version with a note.
    await page.locator('.mat-step-header').nth(5).click();
    const note = activeStep(page).locator('.note-field input');
    await expect(note).toBeVisible();
    await note.fill('Added the friend line.');
    await activeStep(page).getByRole('button', { name: text.saveVersion }).click();
    await expect(activeStep(page).locator('.saved')).toHaveText(text.savedSecond);
    await expect(note).toHaveValue('');

    // Versions: newest first, with its note; compare it with the first.
    const rows = page.locator('app-mission-versions .version-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Added the friend line.');
    await rows.first().click();
    await page.locator('app-mission-versions').getByRole('button', { name: text.compare }).click();
    await expect(page.locator('.diff-summary')).toHaveText(text.diffSummary);
    await expect(page.locator('.diff ins')).toHaveCount(1);
    await expect(page.locator('.diff del')).toHaveCount(1);

    // Review: monthly; the next date is a month away, so nothing is due yet.
    await page
      // Exact: "Month" is also inside "3 months" (and شهر inside أشهر).
      .locator('app-mission-review mat-button-toggle', {
        hasText: new RegExp(`^\\s*${text.monthly}\\s*$`),
      })
      .locator('button')
      .click();
    await expect(page.locator('app-mission-review .review-date')).toBeVisible();
    await expect(page.locator('.due-banner')).toHaveCount(0);

    await page
      .locator('app-mission-versions .compare')
      .evaluate((compare) => compare.scrollIntoView({ block: 'center' }));
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    // A review that came due while away: the banner on the page, "Review due" on the hub.
    await seedDocument(
      withMission({
        review: { interval: 'monthly', lastReviewedAt: '2020-01-01', nextAt: '2020-02-01' },
      }),
    );
    await page.goto('/habits/h2');
    await expect(
      page
        .locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle })
        .locator('.hub-exercise-status'),
    ).toContainText(text.reviewDue);
    await page.goto(ROUTE);
    const banner = page.locator('.due-banner');
    await expect(banner).toContainText(text.dueTitle);
    await banner.getByRole('button', { name: text.reviewed }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.locator('#mission-review-title')).toBeFocused();
  });
});
