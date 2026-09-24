import { expect, test } from './fixtures';

/**
 * Issue #216, across the five Paradigms exercises: the intro card is expanded until the exercise
 * is started and collapsed afterwards (always collapsed on a phone), the primary action is on
 * screen without scrolling at 360x800 on a first and a later visit, and the desktop content
 * column is capped at a readable width by the kit scaffold. The Playwright projects run it at
 * 360/1280 in en/ar.
 */

const T = '2026-01-01T00:00:00.000Z';
const base = (id: string) => ({ id, createdAt: T, updatedAt: T });

const EXERCISES = [
  {
    route: 'transition',
    primary: '.add-button',
    seed: {
      scripts: [
        {
          ...base('11111111-1111-4111-8111-000000000001'),
          text: 'Silence means agreement',
          source: 'family',
          effect: 'harms',
          decision: 'keep',
        },
      ],
    },
  },
  {
    route: 'maturity',
    primary: '.add-button',
    seed: {
      maturity: [
        { ...base('11111111-1111-4111-8111-000000000002'), date: '2026-01-01', areas: [] },
      ],
    },
  },
  {
    route: 'pc-balance',
    primary: '.add-button',
    seed: {
      pcAudits: [
        {
          ...base('11111111-1111-4111-8111-000000000003'),
          date: '2026-01-01',
          assets: [],
          reflection: '',
        },
      ],
    },
  },
  {
    route: 'teach',
    primary: 'app-exercise-list .exercise-list__item >> nth=0',
    seed: {
      teach: [
        {
          ...base('11111111-1111-4111-8111-000000000004'),
          chapter: 'h1',
          keyIdea: 'Choose your response',
          plannedAt: '2026-02-01',
          status: 'planned',
        },
      ],
    },
  },
  {
    route: 'perception',
    primary: 'app-guided-stepper textarea >> nth=0',
    seed: {
      perception: {
        ...base('11111111-1111-4111-8111-000000000005'),
        firstView: 'A young woman',
        viewBRevealed: false,
        switchDifficulty: null,
        changeAttempts: [0, 1, 2].map(() => ({ text: '', kind: 'technique' })),
        difference: '',
        chain: { see: '', do: '', get: '' },
        chainAlt: { see: '', do: '', get: '' },
        reflection: '',
      },
    },
  },
];

const FROM: Record<'en' | 'ar', string> = {
  en: 'From: Paradigms and principles',
  ar: 'من فصل: الأطر الذهنية والمبادئ',
};

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

for (const exercise of EXERCISES) {
  for (const started of [false, true]) {
    test(`${exercise.route}: intro card and primary action on a ${started ? 'later' : 'first'} visit`, async ({
      page,
      seedDocument,
      isMobile,
    }, testInfo) => {
      const lang = localeFor(testInfo.project.name);
      await seedDocument({
        settings: { language: lang },
        habits: {
          paradigms: started ? exercise.seed : {},
          h1: {},
          h2: {},
          h3: {},
          h4: {},
          h5: {},
          h6: {},
          h7: {},
          interdependence: {},
        },
      });
      await page.goto(`/habits/paradigms/${exercise.route}`);

      const primary = page.locator(exercise.primary);
      // Fully on screen without scrolling: `toBeInViewport` also clips to `main.page`, the shell's
      // scroll container, so a row hidden under the bottom navigation fails here.
      await expect(primary).toBeInViewport({ ratio: 1 });

      const toggle = page.locator('app-exercise-prompt-card .toggle');
      const expanded = !isMobile && !started;
      await expect(toggle).toHaveAttribute('aria-expanded', String(expanded));

      if (!isMobile) {
        // The kit scaffold caps the column (72ch for the intro text, 640px for the rest); the page
        // area itself is wider at 1280px.
        const content = await page.locator('app-exercise-page .content-slot').boundingBox();
        const intro = await page.locator('app-exercise-page .intro-slot').boundingBox();
        const pageArea = await page.locator('main.page').boundingBox();
        expect(content!.width).toBeLessThanOrEqual(640);
        expect(intro!.width).toBeLessThan(pageArea!.width - 100);
      }

      if (expanded) {
        await expect(page.locator('app-exercise-prompt-card .chapter-reference')).toHaveText(
          FROM[lang],
        );
      }
    });
  }
}
