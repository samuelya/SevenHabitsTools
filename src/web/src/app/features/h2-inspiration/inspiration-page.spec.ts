import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { DocumentStore } from '../../core/data/document.store';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import {
  ConfirmAndDeleteOptions,
  DeleteWithUndo,
} from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { InspirationFilters } from './inspiration-filters';
import { InspirationItemForm } from './inspiration-item-form';
import {
  INSPIRATION_MODEL_KEY,
  INSPIRATION_ROUTE,
  Inspiration,
  registerInspirationModel,
} from './inspiration.model';
import inspirationRoutes from './inspiration.routes';

const LIST_URL = `/${INSPIRATION_ROUTE}`;
const NOW = new Date(2026, 8, 10, 10, 0, 0);
const T0 = '2026-09-01T00:00:00.000Z';

interface Setup {
  harness: RouterTestingHarness;
  stored: () => readonly Inspiration[];
  deletes: ConfirmAndDeleteOptions[];
}

async function setUp(seed: Inspiration[] = [], url = LIST_URL): Promise<Setup> {
  registerExerciseKitModel();
  registerInspirationModel();
  const deletes: ConfirmAndDeleteOptions[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(
        [{ path: INSPIRATION_ROUTE, children: inspirationRoutes }] satisfies Routes,
        withComponentInputBinding(),
      ),
      { provide: CLOCK, useValue: { now: () => NOW } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      {
        provide: DeleteWithUndo,
        useValue: {
          confirmAndDelete: vi.fn(async (options: ConfirmAndDeleteOptions) => {
            deletes.push(options);
          }),
        },
      },
    ],
  });
  const store = TestBed.runInInjectionContext(() =>
    featureStore<readonly Inspiration[]>(INSPIRATION_MODEL_KEY),
  );
  if (seed.length) {
    store.update(() => seed);
  }
  const harness = await RouterTestingHarness.create(url);
  return { harness, stored: () => store.value(), deletes };
}

function item(id: string, fields: Partial<Inspiration> = {}): Inspiration {
  return {
    id,
    createdAt: T0,
    updatedAt: T0,
    text: `Line ${id}`,
    kind: 'saying',
    tags: [],
    ...fields,
  };
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

function form(harness: RouterTestingHarness): InspirationItemForm {
  return harness.routeDebugElement!.query(By.directive(InspirationItemForm)).componentInstance;
}

function filters(harness: RouterTestingHarness): InspirationFilters {
  return harness.routeDebugElement!.query(By.directive(InspirationFilters)).componentInstance;
}

async function settle(harness: RouterTestingHarness): Promise<void> {
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
}

function rows(harness: RouterTestingHarness): string[] {
  return [...host(harness).querySelectorAll('.exercise-list__item [matListItemTitle]')].map(
    (el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

function markDoneButton(harness: RouterTestingHarness): HTMLButtonElement {
  return host(harness).querySelector('app-done-toggle button') as HTMLButtonElement;
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

describe('InspirationPage', () => {
  it('renders the long title, the prompt and the empty list, with no filters or summary', async () => {
    const { harness } = await setUp();
    const text = host(harness).textContent ?? '';
    expect(text).toContain('Collect what inspires you');
    expect(text).toContain('Keep the lines, thoughts and ideas that move you');
    expect(text).toContain('Nothing collected yet.');
    expect(host(harness).querySelector('app-inspiration-filters')).toBeNull();
    expect(host(harness).querySelector('app-inspiration-summary')).toBeNull();
  });

  it('creates the item on the first typed character in the line, not on Add (#217)', async () => {
    const { harness, stored } = await setUp();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);

    form(harness).changed.emit({ kind: 'idea' });
    form(harness).changed.emit({ tags: ['Time'] });
    form(harness).changed.emit({ favourite: true });
    await settle(harness);
    expect(stored()).toEqual([]);

    form(harness).changed.emit({ text: 'B' });
    await settle(harness);
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ text: 'B', kind: 'idea', tags: ['time'], favourite: true });
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${stored()[0].id}`);
    expect(rows(harness)).toEqual(['B']);
  });

  it('leaves nothing behind when an untouched draft is closed', async () => {
    const { harness } = await setUp();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    form(harness).changed.emit({ tags: ['time'] });
    await TestBed.inject(Router).navigateByUrl(LIST_URL);
    await settle(harness);
    const doc = TestBed.inject(DocumentStore).document() as unknown as {
      habits?: { h2?: { inspirations?: unknown[] } };
    };
    expect(doc.habits?.h2?.inspirations ?? []).toEqual([]);
  });

  it("stars and unstars an item from its row, the star's pressed state following", async () => {
    const { harness, stored } = await setUp([item('a')]);
    await settle(harness);
    const star = () => host(harness).querySelector('.exercise-list__toggle') as HTMLButtonElement;
    expect(star().getAttribute('aria-pressed')).toBe('false');
    expect(star().getAttribute('aria-label')).toBe('Favourite');
    star().click();
    await settle(harness);
    expect(stored()[0].favourite).toBe(true);
    expect(star().getAttribute('aria-pressed')).toBe('true');
    star().click();
    await settle(harness);
    expect('favourite' in stored()[0]).toBe(false);
  });

  it('filters by kind, favourites and tag; the tag chips appear once a tag exists', async () => {
    const { harness } = await setUp([
      item('a', { text: 'Heard it', kind: 'saying', favourite: true }),
      item('b', { text: 'My thought', kind: 'thought' }),
    ]);
    await settle(harness);
    expect(host(harness).querySelector('.tag-filter')).toBeNull();

    filters(harness).kindChange.emit('thought');
    await settle(harness);
    expect(rows(harness)).toEqual(['My thought']);
    filters(harness).kindChange.emit(null);
    filters(harness).favouritesOnlyChange.emit(true);
    await settle(harness);
    expect(rows(harness)).toEqual(['Heard it']);
    filters(harness).kindChange.emit('idea');
    await settle(harness);
    expect(rows(harness)).toEqual([]);
    expect(host(harness).textContent).toContain('Nothing matches your search or filters.');
    filters(harness).kindChange.emit(null);
    filters(harness).favouritesOnlyChange.emit(false);

    await TestBed.inject(Router).navigateByUrl(`${LIST_URL}/b`);
    await settle(harness);
    form(harness).changed.emit({ tags: ['Family'] });
    await settle(harness);
    const tagChips = [...host(harness).querySelectorAll('.tag-filter mat-chip-option')];
    expect(tagChips.map((chip) => chip.textContent?.trim())).toEqual(['family']);
    filters(harness).tagChange.emit('family');
    await settle(harness);
    expect(rows(harness)).toEqual(['My thought']);
  });

  it('clears the tag filter once its tag is gone, and re-adding the tag does not re-filter', async () => {
    const { harness } = await setUp(
      [item('a', { text: 'Tagged', tags: ['time'] }), item('b', { text: 'Plain' })],
      `${LIST_URL}/a`,
    );
    await settle(harness);
    filters(harness).tagChange.emit('time');
    await settle(harness);
    expect(rows(harness)).toEqual(['Tagged']);

    form(harness).changed.emit({ tags: [] });
    await settle(harness);
    expect(rows(harness)).toEqual(['Plain', 'Tagged']);
    form(harness).changed.emit({ tags: ['time'] });
    await settle(harness);
    expect(rows(harness)).toEqual(['Plain', 'Tagged']);
    expect(filters(harness).tag()).toBeNull();
  });

  it('clears the filters when a new item is added, so it is never hidden by them', async () => {
    const { harness, stored } = await setUp([
      item('a', { text: 'Mine', kind: 'thought', tags: ['time'], favourite: true }),
    ]);
    await settle(harness);
    filters(harness).kindChange.emit('thought');
    filters(harness).favouritesOnlyChange.emit(true);
    filters(harness).tagChange.emit('time');
    await settle(harness);
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    form(harness).changed.emit({ text: 'New line' });
    await settle(harness);
    expect(stored()).toHaveLength(2);
    expect(rows(harness)).toEqual(['Mine', 'New line']);
    expect(filters(harness).kind()).toBeNull();
    expect(filters(harness).favouritesOnly()).toBe(false);
    expect(filters(harness).tag()).toBeNull();
  });

  it('gates Mark done on three items with a line, one of them tagged, with a summary', async () => {
    const { harness } = await setUp(
      [item('a', { favourite: true }), item('b'), item('c')],
      `${LIST_URL}/a`,
    );
    await settle(harness);
    expect(markDoneButton(harness).getAttribute('aria-disabled')).toBe('true');
    expect(host(harness).textContent).toContain('Tag one');
    const summary = host(harness).querySelector('app-inspiration-summary')?.textContent ?? '';
    expect(summary).toContain('3 in your collection');
    expect(summary).toContain('1 favourite');
    expect(summary).not.toContain('1 favourites');

    form(harness).changed.emit({ tags: ['time'] });
    await settle(harness);
    expect(markDoneButton(harness).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('"Try this example" adds a sample, counted toward nothing, and reopens it on a second try', async () => {
    const { harness, stored } = await setUp();
    const card = harness.routeDebugElement!.query(By.directive(ExercisePromptCard));
    const prompt = card.componentInstance as ExercisePromptCard;
    const sample = {
      text: 'Line',
      kind: 'saying',
      source: 'Uncle',
      tags: ['time'],
      favourite: true,
    };
    prompt.exampleTried.emit(sample);
    await settle(harness);
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ text: 'Line', sample: true, favourite: true });
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${stored()[0].id}`);
    expect(host(harness).querySelector('app-inspiration-summary')).toBeNull();

    prompt.exampleTried.emit(sample);
    await settle(harness);
    expect(stored()).toHaveLength(1);
  });

  it('deletes with undo', async () => {
    const { harness, stored, deletes } = await setUp([item('a')]);
    await settle(harness);
    (host(harness).querySelector('.exercise-list__delete') as HTMLButtonElement).click();
    await settle(harness);
    deletes[0].onConfirm();
    expect(stored()[0].deletedAt).toBe(NOW.toISOString());
    deletes[0].onUndo();
    expect(stored()[0].deletedAt).toBeUndefined();
  });

  it("follows a language switch in the row's kind chip", async () => {
    const { harness } = await setUp([item('a', { kind: 'idea' })]);
    await settle(harness);
    const subtitle = () =>
      host(harness).querySelector('.exercise-list__item .exercise-list__chip')?.textContent?.trim();
    expect(subtitle()).toBe('An idea to try');
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await settle(harness);
    expect(subtitle()).toBe('فكرة لأجرّبها');
    TestBed.inject(TranslocoService).setActiveLang('en');
  });
});
