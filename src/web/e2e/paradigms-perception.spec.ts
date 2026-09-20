import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Paradigms & perception (issue #48, reworked by #212): the reference **worksheet** exercise
 * (playbook §4) — a single record filled through a fixed 3-step stepper, with no per-item
 * selection and no focus-mode editor at all. Happy path from the habit hub: read the two views,
 * reveal the alternative and rate how hard it was to switch, name 3 change attempts and tag them,
 * trace a see-do-get chain two ways, mark the exercise done, and confirm it survives a reload and
 * shows on the hub. No `seedDocument` call, so each project renders whichever language its own
 * locale defaults to (`mobile-ar`/`desktop-ar`, per `playwright.config.ts`), same as
 * `e2e/paradigms-transition.spec.ts`.
 */

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

/** The single step content wrapper Material marks as currently selected — `-current` on the
 * horizontal stepper (desktop), `-active` on the vertical one (mobile). Both orientations keep
 * every step's content in the DOM at once, so scoping to this (rather than a page-wide `:visible`
 * filter) is what makes "click the Next button for the step I'm on" unambiguous. */
function activeStepContent(page: Page) {
  return page.locator(
    '.mat-horizontal-stepper-content-current, .mat-vertical-content-container-active',
  );
}

const TEXT: Record<
  'en' | 'ar',
  {
    hubTitle: string;
    reveal: string;
    character: string;
    next: string;
    markDone: string;
    reopen: string;
    readMore: string;
    guideTitle: string;
    guideClose: string;
    checklistItem: string;
  }
> = {
  en: {
    hubTitle: 'Notice your paradigm',
    reveal: 'Show the other side',
    character: 'Real change',
    next: 'Next',
    markDone: 'Mark done',
    reopen: 'Reopen',
    readMore: 'Read more',
    guideTitle: 'How to do this exercise',
    guideClose: 'Close',
    checklistItem: "Write why you think they didn't wave back",
  },
  ar: {
    hubTitle: 'لاحظ إطارك الذهني',
    reveal: 'اعرض الوجه الآخر',
    character: 'تغيير حقيقي',
    next: 'التالي',
    markDone: 'وضع علامة تم',
    reopen: 'إعادة فتح',
    readMore: 'اقرأ المزيد',
    guideTitle: 'إزاي تعمل التمرين ده',
    guideClose: 'قفل',
    checklistItem: 'اكتب ليه تفتكر إنه ما ردش عليك',
  },
};

test.describe('paradigms & perception worksheet', () => {
  test('fills all three steps, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];

    await page.goto('/habits/paradigms');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/paradigms\/perception$/);

    // The first input of the current step is visible without scrolling at 360×800 (issue #212).
    await expect(page.locator('.step-two-views textarea')).toBeInViewport();

    // The unmet checklist is visible next to the disabled "Mark done" button before anything is
    // filled in.
    await expect(page.locator('.done-checklist', { hasText: text.checklistItem })).toBeVisible();

    // Step 1: two views.
    await page.locator('.step-two-views textarea').fill('They must be upset with me');
    const revealButton = page.locator('button', { hasText: text.reveal });
    await expect(revealButton).toBeEnabled();
    await revealButton.click();
    const slider = page.locator('.step-two-views input[matSliderThumb]');
    await slider.focus();
    await slider.press('ArrowUp');
    await slider.press('ArrowUp');
    await slider.press('ArrowUp');

    await page.locator('button:visible', { hasText: text.next }).click();

    // Step 2: 3 change attempts, tag the second one "Real change", plus the difference sentence.
    const attemptTextareas = page.locator('.step-character-technique textarea');
    await attemptTextareas.nth(0).fill('Tried a new morning routine');
    await attemptTextareas.nth(1).fill('Practiced listening before reacting');
    await attemptTextareas.nth(2).fill('Set a strict schedule');
    await page
      .locator('.kind-toggle')
      .nth(1)
      .locator('button', { hasText: text.character })
      .click();
    await attemptTextareas
      .nth(3)
      .fill('A quick fix fades once the effort stops; a real change sticks.');

    await page.locator('button:visible', { hasText: text.next }).click();

    // Step 3: the current chain, then the alternative one.
    const chainTextareas = page.locator('.step-see-do-get textarea');
    await chainTextareas.nth(0).fill('A distant coworker');
    await chainTextareas.nth(1).fill('I avoid them');
    await chainTextareas.nth(2).fill('A tense team');
    await chainTextareas.nth(3).fill('A distracted coworker');
    await chainTextareas.nth(4).fill('I check in with them');
    await chainTextareas.nth(5).fill('A trusted team');

    // The checklist disappears once every item is met.
    await expect(page.locator('.done-checklist')).toHaveCount(0);

    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    // Longer than the 500 ms save debounce (`SAVE_DEBOUNCE_MS`) — see `paradigms-transition`'s
    // own e2e spec for the same wait before relying on persisted state.
    await page.waitForTimeout(1000);
    await page.reload();

    // The first input of the current step is visible without scrolling on a second visit too.
    await expect(page.locator('.step-two-views textarea')).toBeInViewport();
    await expect(page.locator('.step-two-views textarea')).toHaveValue(
      'They must be upset with me',
    );
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.goto('/habits/paradigms');
    await expect(
      page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }),
    ).toBeVisible();
  });

  test('typing character by character never loses focus when a step completes mid-keystroke', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];

    // `fill()` sets a field's whole value in one shot and can't catch a step completing partway
    // through typing — a stepper step swapping its `@if`/`@else` template branch on completion
    // destroys and recreates the field being typed into (review finding on this PR). Every field
    // below is typed with `pressSequentially()` so each character fires its own `input` event, and
    // the very last character is the one that flips the step's `done` from `undefined` to `true`.
    await page.goto('/habits/paradigms/perception');

    // Step 1: a slider drag that completes the step (`switchDifficulty` rated) must not reset the
    // slider mid-drag.
    await page.locator('.step-two-views textarea').fill('They must be upset with me');
    await page.locator('button', { hasText: text.reveal }).click();
    const slider = page.locator('.step-two-views input[matSliderThumb]');
    await slider.focus();
    await slider.press('ArrowUp');
    await expect(slider).toBeFocused();
    await slider.press('ArrowUp');
    await slider.press('ArrowUp');
    await expect(slider).toBeFocused();

    // Scoped to the currently-active step's own content wrapper, not a page-wide `:visible`
    // filter: both orientations keep every step's content in the DOM at once (mobile is vertical,
    // desktop horizontal — Material marks exactly one "…-current"/"…-active" at a time), so a
    // global filter can match more than one "Next".
    await activeStepContent(page).getByRole('button', { name: text.next }).click();

    // Step 2: fill everything except the last character of the difference field, then type that
    // last character on its own — it's the one that completes the step.
    const attemptTextareas = page.locator('.step-character-technique textarea');
    await attemptTextareas.nth(0).fill('Tried a new morning routine');
    await attemptTextareas.nth(1).fill('Practiced listening before reacting');
    await attemptTextareas.nth(2).fill('Set a strict schedule');
    const difference = 'A quick fix fades once the effort stops; a real change sticks.';
    const differenceField = attemptTextareas.nth(3);
    await differenceField.fill(difference.slice(0, -1));
    await differenceField.pressSequentially(difference.slice(-1));
    await expect(differenceField).toBeFocused();
    await expect(differenceField).toHaveValue(difference);
    // The step really did complete — "Next" is still there and clickable, proving the stepper
    // itself survived too, not just the field.
    await activeStepContent(page).getByRole('button', { name: text.next }).click();

    // Step 3: same trick on the last field of the second (alt) chain.
    const chainTextareas = page.locator('.step-see-do-get textarea');
    await chainTextareas.nth(0).fill('A distant coworker');
    await chainTextareas.nth(1).fill('I avoid them');
    await chainTextareas.nth(2).fill('A tense team');
    await chainTextareas.nth(3).fill('A distracted coworker');
    await chainTextareas.nth(4).fill('I check in with them');
    const lastChainField = chainTextareas.nth(5);
    const lastChainValue = 'A trusted team';
    await lastChainField.fill(lastChainValue.slice(0, -1));
    await lastChainField.pressSequentially(lastChainValue.slice(-1));
    await expect(lastChainField).toBeFocused();
    await expect(lastChainField).toHaveValue(lastChainValue);

    // Deleting the last character un-completes the step (`true` → `undefined`) — typing it back in
    // one keystroke, on the same field, must not lose focus either.
    await lastChainField.press('Backspace');
    await expect(lastChainField).toBeFocused();
    await expect(lastChainField).toHaveValue(lastChainValue.slice(0, -1));
    await lastChainField.pressSequentially(lastChainValue.slice(-1));
    await expect(lastChainField).toBeFocused();
    await expect(lastChainField).toHaveValue(lastChainValue);
  });

  test('opens and closes the "Read more" guide, returning focus to the button', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];

    await page.goto('/habits/paradigms/perception');
    const readMoreButton = page.locator('button', { hasText: text.readMore });
    await readMoreButton.click();

    const dialog = page.locator('mat-dialog-container', { hasText: text.guideTitle });
    await expect(dialog).toBeVisible();

    // The close button is an icon button, named only by `aria-label` (no visible text).
    await dialog.getByRole('button', { name: text.guideClose }).click();
    await expect(dialog).toBeHidden();
    await expect(readMoreButton).toBeFocused();
  });

  test('accessibility: the worksheet page has no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/paradigms/perception');
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
