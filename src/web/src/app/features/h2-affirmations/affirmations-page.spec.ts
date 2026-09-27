import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, isObservable, of } from 'rxjs';
import { DocumentStore } from '../../core/data/document.store';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { AppDialog } from '../../core/layout/app-dialog';
import { AppSnackbar } from '../../core/layout/app-snackbar';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import {
  ConfirmAndDeleteOptions,
  DeleteWithUndo,
} from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { AffirmationItemForm } from './affirmation-item-form';
import { PracticeDialogData } from './affirmation-practice';
import { uncheckedChecks } from './affirmations.logic';
import {
  AFFIRMATIONS_MODEL_KEY,
  AFFIRMATIONS_ROUTE,
  Affirmation,
  AffirmationChecks,
  registerAffirmationsModel,
} from './affirmations.model';
import affirmationsRoutes from './affirmations.routes';

const LIST_URL = `/${AFFIRMATIONS_ROUTE}`;
const NOW = new Date(2026, 8, 10, 10, 0, 0);
const TODAY = '2026-09-10';
const T0 = '2026-09-01T00:00:00.000Z';
const ALL: AffirmationChecks = {
  personal: true,
  positive: true,
  present: true,
  visual: true,
  emotional: true,
};

interface Setup {
  harness: RouterTestingHarness;
  stored: () => readonly Affirmation[];
  deletes: ConfirmAndDeleteOptions[];
  opened: { data?: PracticeDialogData }[];
  snackbar: { open: ReturnType<typeof vi.fn> };
}

/** `dialogResult` is what the practice dialog closes with: `undefined` for Escape/Close, anything
 * at all at runtime, or an observable that closes it when the test says so. */
async function setUp(
  seed: Affirmation[] = [],
  url = LIST_URL,
  dialogResult?: unknown,
): Promise<Setup> {
  registerExerciseKitModel();
  registerAffirmationsModel();
  const deletes: ConfirmAndDeleteOptions[] = [];
  const opened: { data?: PracticeDialogData }[] = [];
  const snackbar = { open: vi.fn(async () => ({})) };
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(
        [{ path: AFFIRMATIONS_ROUTE, children: affirmationsRoutes }] satisfies Routes,
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
      {
        provide: AppDialog,
        useValue: {
          open: vi.fn(async (_component: unknown, config: { data?: PracticeDialogData }) => {
            opened.push(config);
            return {
              afterClosed: () => (isObservable(dialogResult) ? dialogResult : of(dialogResult)),
            };
          }),
        },
      },
      { provide: AppSnackbar, useValue: snackbar },
    ],
  });
  const store = TestBed.runInInjectionContext(() =>
    featureStore<readonly Affirmation[]>(AFFIRMATIONS_MODEL_KEY),
  );
  if (seed.length) {
    store.update(() => seed);
  }
  const harness = await RouterTestingHarness.create(url);
  return { harness, stored: () => store.value(), deletes, opened, snackbar };
}

function affirmation(id: string, fields: Partial<Affirmation> = {}): Affirmation {
  return {
    id,
    createdAt: T0,
    updatedAt: T0,
    text: `I stay calm ${id}`,
    checks: ALL,
    practice: [],
    ...fields,
  };
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

function form(harness: RouterTestingHarness): AffirmationItemForm {
  return harness.routeDebugElement!.query(By.directive(AffirmationItemForm)).componentInstance;
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

function subtitles(harness: RouterTestingHarness): string[] {
  return [...host(harness).querySelectorAll('.exercise-list__item [matListItemLine]')].map(
    (el) => el.textContent?.trim() ?? '',
  );
}

function practiseButtons(harness: RouterTestingHarness): HTMLButtonElement[] {
  return [...host(harness).querySelectorAll<HTMLButtonElement>('.exercise-list__action')];
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

describe('AffirmationsPage', () => {
  it('renders the long title, the prompt, the gloss and the empty list, with no summary', async () => {
    const { harness } = await setUp();
    const text = host(harness).textContent ?? '';
    expect(text).toContain('Write it, then see it');
    expect(text).toContain('Pick a moment where you keep reacting');
    expect(text).toContain('Nothing yet. Think of the last time you reacted');
    expect(host(harness).querySelector('app-affirmations-summary')).toBeNull();
  });

  it('creates the affirmation on the first typed character, not on Add or a tick (#217)', async () => {
    const { harness, stored } = await setUp();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);

    form(harness).changed.emit({ checks: { ...uncheckedChecks(), personal: true } });
    await settle(harness);
    expect(stored()).toEqual([]);

    form(harness).changed.emit({ text: 'I' });
    await settle(harness);
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({
      text: 'I',
      checks: { ...uncheckedChecks(), personal: true },
      practice: [],
    });
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${stored()[0].id}`);
    expect(rows(harness)).toEqual(['I']);
    expect(subtitles(harness)).toEqual(['1 of 5']);
  });

  it('leaves nothing behind when an untouched draft is closed', async () => {
    const { harness } = await setUp();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    form(harness).changed.emit({ checks: { ...ALL } });
    await TestBed.inject(Router).navigateByUrl(LIST_URL);
    await settle(harness);
    const doc = TestBed.inject(DocumentStore).document() as unknown as {
      habits?: { h2?: { affirmations?: unknown[] } };
    };
    expect(doc.habits?.h2?.affirmations ?? []).toEqual([]);
  });

  it('offers Practise only on complete, active rows', async () => {
    const { harness } = await setUp([
      affirmation('a', { text: 'Complete' }),
      affirmation('b', { text: 'Four', checks: { ...ALL, emotional: false } }),
    ]);
    await settle(harness);
    expect(rows(harness)).toEqual(['Complete', 'Four']);
    expect(practiseButtons(harness).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Practise: Complete',
    ]);
    expect(subtitles(harness)).toEqual(['4 of 5']);
  });

  it('opens the practice view with the text, scene and remembered length, and logs Done', async () => {
    const { harness, stored, opened, snackbar } = await setUp(
      [affirmation('a', { text: 'I breathe out.', scene: 'Hallway', practiceSeconds: 120 })],
      LIST_URL,
      { seconds: 12, length: 30 },
    );
    await settle(harness);
    practiseButtons(harness)[0].click();
    await settle(harness);
    expect(opened[0].data).toEqual({ text: 'I breathe out.', scene: 'Hallway', length: 120 });
    expect(stored()[0].practice).toEqual([{ date: TODAY, seconds: 12 }]);
    expect(stored()[0].practiceSeconds).toBe(30);
    expect(subtitles(harness)).toEqual(['Practised today']);
    expect(snackbar.open).toHaveBeenCalledWith('Practised. See you tomorrow.', '', {
      duration: 3000,
    });
  });

  it('logs nothing when the practice view closes without Done (Escape, Close)', async () => {
    const { harness, stored, snackbar } = await setUp([affirmation('a')]);
    await settle(harness);
    const before = stored();
    practiseButtons(harness)[0].click();
    await settle(harness);
    expect(stored()).toBe(before);
    expect(snackbar.open).not.toHaveBeenCalled();
  });

  it('logs nothing for a malformed close value', async () => {
    for (const result of [
      '',
      { seconds: 3, length: 30 },
      { seconds: 31, length: 30 },
      { seconds: 12, length: 45 },
      { seconds: '12', length: 30 },
    ]) {
      const { harness, stored, snackbar } = await setUp([affirmation('a')], LIST_URL, result);
      await settle(harness);
      const before = stored();
      practiseButtons(harness)[0].click();
      await settle(harness);
      expect(stored()).toBe(before);
      expect(snackbar.open).not.toHaveBeenCalled();
      TestBed.resetTestingModule();
    }
  });

  it('ignores Practise while a practice dialog is opening or open: one dialog, one log', async () => {
    const closed = new Subject<unknown>();
    const { harness, stored, opened } = await setUp([affirmation('a')], LIST_URL, closed);
    await settle(harness);
    practiseButtons(harness)[0].click();
    practiseButtons(harness)[0].click();
    await settle(harness);
    practiseButtons(harness)[0].click();
    await settle(harness);
    expect(opened).toHaveLength(1);

    closed.next({ seconds: 20, length: 60 });
    closed.complete();
    await settle(harness);
    expect(stored()[0].practice).toEqual([{ date: TODAY, seconds: 20 }]);
    // Closed: the next Practise opens a dialog again.
    practiseButtons(harness)[0].click();
    await settle(harness);
    expect(opened).toHaveLength(2);
  });

  it('shows the summary and the streak once practised, and gates Mark done on a practice', async () => {
    const { harness } = await setUp([
      affirmation('a', {
        practice: [
          { date: '2026-09-08', seconds: 60 },
          { date: '2026-09-09', seconds: 60 },
        ],
      }),
      affirmation('b'),
    ]);
    await settle(harness);
    const summary = host(harness).querySelector('app-affirmations-summary')?.textContent ?? '';
    expect(summary).toContain('Practised 2 days');
    expect(summary).toContain('2-day streak');
    expect(subtitles(harness)[0]).toContain('Last practised');
    expect(markDoneButton(harness).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('keeps Mark done gated with only a complete, unpractised affirmation', async () => {
    const { harness } = await setUp([affirmation('a')]);
    await settle(harness);
    expect(markDoneButton(harness).getAttribute('aria-disabled')).toBe('true');
    expect(host(harness).textContent).toContain('Practise it once');
    expect(host(harness).querySelector('app-affirmations-summary')).toBeNull();
  });

  it('archives into a collapsed Archived group with no Practise, and unarchives', async () => {
    const { harness, stored } = await setUp(
      [affirmation('a', { text: 'Old' }), affirmation('b', { text: 'Kept' })],
      `${LIST_URL}/a`,
    );
    await settle(harness);
    form(harness).archivedChange.emit(true);
    await settle(harness);
    expect(stored()[0].archived).toBe(true);
    const toggle = host(harness).querySelector('#archived-toggle') as HTMLButtonElement;
    // Opened because the selected affirmation is archived, and kept open on closing the editor.
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await TestBed.inject(Router).navigateByUrl(LIST_URL);
    await settle(harness);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    await settle(harness);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(practiseButtons(harness)).toHaveLength(1);

    toggle.click();
    await settle(harness);
    // The archived row is listed, without a Practise button.
    expect(rows(harness)).toEqual(['Kept', 'Old']);
    expect(practiseButtons(harness)).toHaveLength(1);
    await TestBed.inject(Router).navigateByUrl(`${LIST_URL}/a`);
    await settle(harness);
    form(harness).archivedChange.emit(false);
    await settle(harness);
    expect('archived' in stored()[0]).toBe(false);
  });

  it('"Try this example" adds a sample with no log, counted nowhere, reopened on a second try', async () => {
    const { harness, stored } = await setUp();
    const card = harness.routeDebugElement!.query(By.directive(ExercisePromptCard));
    const prompt = card.componentInstance as ExercisePromptCard;
    const sample = { text: 'I let her finish.', checks: ALL, scene: 'The small room' };
    prompt.exampleTried.emit(sample);
    await settle(harness);
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ text: 'I let her finish.', sample: true, practice: [] });
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${stored()[0].id}`);
    expect(markDoneButton(harness).getAttribute('aria-disabled')).toBe('true');

    prompt.exampleTried.emit(sample);
    await settle(harness);
    expect(stored()).toHaveLength(1);
  });

  it('deletes with undo', async () => {
    const { harness, stored, deletes } = await setUp([affirmation('a')]);
    await settle(harness);
    (host(harness).querySelector('.exercise-list__delete') as HTMLButtonElement).click();
    await settle(harness);
    deletes[0].onConfirm();
    expect(stored()[0].deletedAt).toBe(NOW.toISOString());
    deletes[0].onUndo();
    expect(stored()[0].deletedAt).toBeUndefined();
  });

  it('follows a language switch in the row subtitle', async () => {
    const { harness } = await setUp([affirmation('a', { checks: { ...ALL, visual: false } })]);
    await settle(harness);
    expect(subtitles(harness)).toEqual(['4 of 5']);
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await settle(harness);
    expect(subtitles(harness)[0]).toContain('من');
    TestBed.inject(TranslocoService).setActiveLang('en');
  });
});
