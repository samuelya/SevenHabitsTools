import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Results and capacity (issue #223): suggested-asset chips stored by built-in key, Enter in a
 * group's field, the one-line legend, the status gloss, the maintenance prompt, no summary card
 * before the first asset, and audits from before #223 shown as they were. Runs in each project's
 * own language, like `paradigms-pc-balance.spec.ts`.
 */

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

const TEXT = {
  en: {
    chips: ['Sleep', 'Exercise', 'Savings', 'Income skills', 'Partner', 'Team'],
    legend: 'Getting out: how much you rely on it now · Putting in: how much you maintain it.',
    actionPrompt: "Name one thing you'll do to maintain it.",
    overGloss: 'you get a lot out of it and put little back.',
    duplicate: 'That asset is already in this audit.',
  },
  ar: {
    chips: ['النوم', 'الرياضة', 'المدخرات', 'مهارات الكسب', 'شريك الحياة', 'فريق العمل'],
    legend: 'الاستفادة: قد إيه بتعتمد عليه دلوقتي · الصيانة: قد إيه بتحافظ عليه.',
    actionPrompt: 'اكتب حاجة واحدة هتعملها عشان تحافظ عليه.',
    overGloss: 'بتاخد منه كتير وبترجّعله قليل.',
    duplicate: 'هذا الأصل موجود بالفعل في هذا التقييم.',
  },
} as const;

const PC_BALANCE_URL = '/habits/paradigms/pc-balance';
/** A saved audit's editor URL: the real id, not the draft's reserved `new` segment (#217). */
const SAVED_AUDIT_URL = /\/habits\/paradigms\/pc-balance\/(?!new$)[^/]+$/;

/** The stored audits (`habits.paradigms.pcAudits`) as IndexedDB holds them — the same document the
 * JSON export writes out. */
async function storedAudits(page: Page): Promise<{ assets: Record<string, unknown>[] }[] | null> {
  return page.evaluate(
    () =>
      new Promise<{ assets: Record<string, unknown>[] }[] | null>((resolve, reject) => {
        const open = indexedDB.open('sevenhabits');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('documents').objectStore('documents').get('current');
          get.onsuccess = () => {
            db.close();
            resolve(get.result?.habits?.paradigms?.pcAudits ?? null);
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

test.describe('Results and capacity: suggested assets (#223)', () => {
  test('a chip adds a stored built-in with its rating inline; Enter adds a typed asset; both survive a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    await page.goto(PC_BALANCE_URL);
    await page.locator('.add-button').click();
    const form = page.locator('app-pc-balance-audit-form');
    await expect(form).toBeVisible();

    // Empty audit: no summary card and no legend yet, two chips per group.
    await expect(form.locator('.group-summary')).toHaveCount(0);
    await expect(form.locator('.rating-legend')).toHaveCount(0);
    await expect(form.locator('.suggested-chip__label')).toHaveText([...text.chips]);

    await form.locator('.suggested-chip', { hasText: text.chips[0] }).click();
    await expect(page).toHaveURL(SAVED_AUDIT_URL);
    const sleep = form.locator('.asset-row[data-asset-key="sleep"]');
    await expect(sleep.locator('.asset-title')).toHaveText(text.chips[0]);
    // The rating control shows at once and takes focus: the chip that had it is gone.
    const [pThumb, pcThumb] = [
      sleep.locator('input[matSliderThumb]').nth(0),
      sleep.locator('input[matSliderThumb]').nth(1),
    ];
    await expect(pThumb).toBeFocused();
    await expect(form.locator('.rating-legend')).toHaveText(text.legend);
    await expect(form.locator('.group-summary')).toBeVisible();
    await expect(form.locator('.suggested-chip')).toHaveCount(5);

    const humanField = form.locator('.add-asset-row[data-add-group="human"] input');
    await humanField.fill('Sam');
    await humanField.press('Enter');
    await expect(form.locator('.asset-row')).toHaveCount(2);
    await expect(humanField).toHaveValue('');

    // Up/down step the same way in both directions (see paradigms-pc-balance.spec.ts).
    await pThumb.focus();
    await pThumb.press('ArrowUp');
    await pThumb.press('ArrowUp');
    await pcThumb.focus();
    await pcThumb.press('ArrowDown');
    await pcThumb.press('ArrowDown');
    await expect(sleep.locator('.balance-gloss')).toHaveText(text.overGloss);
    await expect(sleep.locator('.action-prompt')).toHaveText(text.actionPrompt);
    await sleep.locator('.asset-action textarea').fill('Lights out by 10pm');

    // No horizontal overflow at this project's width (360 px on the mobile projects).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Longer than the 500 ms save debounce (`document-persistence.ts`).
    await page.waitForTimeout(1000);
    const audits = await storedAudits(page);
    expect(audits).toHaveLength(1);
    expect(audits![0].assets[0]).toMatchObject({
      key: 'sleep',
      name: '',
      group: 'physical',
      p: 5,
      pc: 1,
      action: 'Lights out by 10pm',
    });
    expect(audits![0].assets[1]).toMatchObject({ name: 'Sam', group: 'human', p: 3, pc: 3 });

    await page.reload();
    await expect(sleep.locator('.asset-title')).toHaveText(text.chips[0]);
    await expect(form.locator('.suggested-chip', { hasText: text.chips[0] })).toHaveCount(0);
  });

  test('an audit from before #223 shows its typed assets as before, and a typed built-in name counts as that built-in', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    const id = '33333333-3333-4333-8333-333333333331';
    await seedDocument({
      habits: {
        paradigms: {
          pcAudits: [
            {
              id,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              date: '2026-01-01',
              assets: [
                {
                  key: '33333333-3333-4333-8333-3333333333a1',
                  name: 'Sleep',
                  group: 'physical',
                  p: 3,
                  pc: 3,
                },
                {
                  key: '33333333-3333-4333-8333-3333333333a2',
                  name: 'Health',
                  group: 'physical',
                  p: 4,
                  pc: 2,
                },
              ],
              reflection: '',
            },
          ],
        },
      },
    });
    await page.goto(`${PC_BALANCE_URL}/${id}`);
    const form = page.locator('app-pc-balance-audit-form');

    await expect(form.locator('.asset-row .asset-name input')).toHaveCount(2);
    await expect(form.locator('.asset-row .asset-name input').nth(0)).toHaveValue('Sleep');
    await expect(form.locator('.asset-row .asset-name input').nth(1)).toHaveValue('Health');
    // "Sleep" typed before #223 is the Sleep suggestion: its chip isn't offered again.
    await expect(form.locator('.suggested-chip')).toHaveCount(5);
    await expect(form.locator('.group-summary__item')).toHaveCount(1);

    const physicalField = form.locator('.add-asset-row[data-add-group="physical"] input');
    await physicalField.fill('health');
    await physicalField.press('Enter');
    await expect(form.locator('#duplicate-physical')).toHaveText(text.duplicate);
    await expect(physicalField).toHaveValue('health');
    await expect(form.locator('.asset-row')).toHaveCount(2);
  });
});
