import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { getRegisteredModels } from '../../core/data/registry';
import { CLOCK } from '../../core/time/clock';
// Side-effect only: `DoneToggle`'s caption and the date formats read `settings` via `featureStore`.
import '../../features/settings/settings.model';
import {
  ConfirmAndDeleteOptions,
  DeleteWithUndo,
} from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { LanguageItemForm } from './language-item-form';
import {
  LANGUAGE_MODEL_KEY,
  LANGUAGE_ROUTE,
  LanguageLog,
  registerLanguageModel,
} from './language.model';
import languageRoutes from './language.routes';

const LIST_URL = `/${LANGUAGE_ROUTE}`;
/** Local 09:00, so the local date is 2026-03-10 in any test time zone. */
const START = new Date(2026, 2, 10, 9);
const HOUR = 60 * 60 * 1000;

/** The fixed `CLOCK`'s time; a test moves it, then `showTab()` makes the page re-read it. */
let now = START;

function testRoutes(): Routes {
  return [{ path: LANGUAGE_ROUTE, children: languageRoutes }];
}

function fakeDeleteWithUndo() {
  const calls: ConfirmAndDeleteOptions[] = [];
  return {
    calls,
    confirmAndDelete: vi.fn(async (options: ConfirmAndDeleteOptions) => {
      calls.push(options);
    }),
  };
}

async function setUp(deleteWithUndo = fakeDeleteWithUndo()): Promise<RouterTestingHarness> {
  // Vitest runs with `isolate: false`: re-assert registrations instead of resetting them.
  registerExerciseKitModel();
  registerLanguageModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(testRoutes(), withComponentInputBinding()),
      { provide: CLOCK, useValue: { now: () => now } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: DeleteWithUndo, useValue: deleteWithUndo },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

function itemForm(harness: RouterTestingHarness): LanguageItemForm {
  return harness.routeDebugElement!.query(By.directive(LanguageItemForm)).componentInstance;
}

function stored(): LanguageLog {
  return TestBed.runInInjectionContext(() => featureStore<LanguageLog>(LANGUAGE_MODEL_KEY).value());
}

function click(harness: RouterTestingHarness, selector: string): void {
  (host(harness).querySelector(selector) as HTMLButtonElement).click();
  harness.detectChanges();
}

/** The tab coming back into view: the page re-reads `CLOCK` (`minuteClock()`). */
function showTab(harness: RouterTestingHarness): void {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  document.dispatchEvent(new Event('visibilitychange'));
  visibility.mockRestore();
  harness.detectChanges();
}

async function openDraft(harness: RouterTestingHarness): Promise<void> {
  const add = host(harness).querySelector('.add-button') as HTMLButtonElement;
  add.focus();
  add.click();
  await harness.fixture.whenStable();
}

async function emit(harness: RouterTestingHarness, fields: object): Promise<void> {
  itemForm(harness).changed.emit(fields);
  harness.detectChanges();
  await harness.fixture.whenStable();
}

/** Adds a phrase the way a user does: open the draft, type, then any further fields. */
async function addPhrase(harness: RouterTestingHarness, fields: object = {}): Promise<void> {
  await openDraft(harness);
  await emit(harness, { text: 'I have to stay late' });
  if (Object.keys(fields).length > 0) {
    await emit(harness, fields);
  }
}

function markDone(harness: RouterTestingHarness): HTMLButtonElement {
  return host(harness).querySelector('app-done-toggle button') as HTMLButtonElement;
}

function text(harness: RouterTestingHarness, selector: string): string {
  return host(harness).querySelector(selector)?.textContent?.trim() ?? '';
}

beforeEach(() => {
  now = START;
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

describe('LanguagePage', () => {
  it('renders the long title, the gloss, Start listening and the gate checklist', async () => {
    const harness = await setUp();

    expect(host(harness).textContent).toContain('Listen to your own words');
    expect(text(harness, '.prompt-gloss')).toContain('reactive language');
    expect(text(harness, '.start-day-button')).toContain('Start listening');
    expect(host(harness).querySelector('.day-banner')).toBeNull();
    expect(host(harness).querySelector('app-language-week')).toBeNull();
    expect(text(harness, 'app-done-toggle .done-checklist')).toContain(
      'Start a listening day and finish it',
    );
    expect(markDone(harness).getAttribute('aria-disabled')).toBe('true');
  });

  it('Start listening shows the banner in a polite live region that relays additions only', async () => {
    const harness = await setUp();

    click(harness, '.start-day-button');

    const region = host(harness).querySelector('.banner-region')!;
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-relevant')).toBe('additions');
    expect(text(harness, '.day-banner')).toContain('Listening day running: 24 h left.');
    expect(host(harness).querySelector('.start-day-button')).toBeNull();
    expect(host(harness).querySelector('.end-day-button')).not.toBeNull();
    expect(stored().listeningDays).toHaveLength(1);
  });

  it('a minute read that keeps the hours leaves the banner text node alone', async () => {
    const harness = await setUp();
    click(harness, '.start-day-button');
    const node = host(harness).querySelector('.day-banner span')!.firstChild!;
    const before = node.textContent;

    now = new Date(START.getTime() + 20 * 60 * 1000);
    showTab(harness);
    expect(host(harness).querySelector('.day-banner span')!.firstChild).toBe(node);
    expect(node.textContent).toBe(before);

    now = new Date(START.getTime() + 2 * HOUR);
    showTab(harness);
    expect(host(harness).querySelector('.day-banner span')!.firstChild).toBe(node);
    expect(node.textContent).toContain('22 h left');
  });

  it('phrases added while a day runs get its id; End day shows the summary and New day', async () => {
    const harness = await setUp();
    click(harness, '.start-day-button');
    const dayId = stored().listeningDays[0].id;

    await addPhrase(harness, { reframe: 'I choose to stay' });
    await addPhrase(harness, { kind: 'proactive' });
    expect(stored().phrases.map((p) => p.listeningDayId)).toEqual([dayId, dayId]);

    now = new Date(START.getTime() + 3 * HOUR);
    click(harness, '.end-day-button');

    expect(stored().listeningDays[0].endedAt).toBe(now.toISOString());
    expect(host(harness).querySelector('.day-banner')).toBeNull();
    expect(text(harness, '.day-summary')).toContain('Your listening day');
    expect(text(harness, '.day-summary')).toContain(
      '1 gave the choice away, 1 owned it. 1 rewritten.',
    );
    expect(host(harness).querySelector('.new-day-button')).not.toBeNull();
    expect(markDone(harness).getAttribute('aria-disabled')).not.toBe('true');

    click(harness, '.new-day-button');
    expect(stored().listeningDays).toHaveLength(2);
    expect(text(harness, '.day-banner')).toContain('24 h left');
  });

  it('the day ends by itself at startedAt + 24 h, with nothing stored', async () => {
    const harness = await setUp();
    click(harness, '.start-day-button');
    await addPhrase(harness, { reframe: 'I choose' });
    expect(markDone(harness).getAttribute('aria-disabled')).toBe('true');

    now = new Date(START.getTime() + 24 * HOUR - 1000);
    showTab(harness);
    expect(text(harness, '.day-banner')).toContain('1 h left');

    now = new Date(START.getTime() + 24 * HOUR);
    showTab(harness);
    expect(host(harness).querySelector('.day-banner')).toBeNull();
    expect(text(harness, '.day-summary')).toContain('1 gave the choice away');
    expect(stored().listeningDays[0].endedAt).toBeUndefined();
    expect(markDone(harness).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('a phrase added with no day running has no day id', async () => {
    const harness = await setUp();
    await addPhrase(harness);
    expect(stored().phrases[0]).not.toHaveProperty('listeningDayId');
  });

  it('Add opens a draft that stores nothing until "What you said" has text', async () => {
    const harness = await setUp();

    await openDraft(harness);
    await emit(harness, { kind: 'proactive' });
    await emit(harness, { context: 'Kitchen' });
    expect(stored().phrases).toEqual([]);

    await emit(harness, { context: '' });
    await emit(harness, { text: 'I' });
    expect(stored().phrases).toHaveLength(1);
    expect(stored().phrases[0]).toMatchObject({ text: 'I', kind: 'proactive' });
    // The emptied "Where" never reaches storage.
    expect(stored().phrases[0]).not.toHaveProperty('context');
    const model = getRegisteredModels().find((entry) => entry.key === LANGUAGE_MODEL_KEY)!;
    expect(model.validate?.(stored())).toBe(true);
  });

  it('shows the last 7 days and the streak once a counted phrase exists', async () => {
    const harness = await setUp();

    await addPhrase(harness, { kind: 'proactive' });

    const rows = host(harness).querySelectorAll('app-language-week tbody tr');
    expect(rows).toHaveLength(7);
    expect(rows[6].querySelectorAll('td')[1].textContent?.trim()).toBe('1');
    expect(text(harness, 'app-language-week caption')).toBe('Last 7 days');
    expect(text(harness, 'app-language-week .streak')).toBe('1-day streak');
  });

  it('"Try this example" adds a sample outside any day and opens it; it starts nothing', async () => {
    const harness = await setUp();
    click(harness, '.start-day-button');
    const card = harness.routeDebugElement!.query(By.directive(ExercisePromptCard));

    (card.componentInstance as ExercisePromptCard).exampleTried.emit({
      text: 'I have to stay late again, they never plan anything.',
      kind: 'reactive',
      reframe: "I'll stay till six tonight.",
    });
    await harness.fixture.whenStable();

    expect(stored().phrases).toHaveLength(1);
    expect(stored().phrases[0]).toMatchObject({ sample: true });
    expect(stored().phrases[0]).not.toHaveProperty('listeningDayId');
    expect(host(harness).querySelector('app-language-item-form')).not.toBeNull();
    expect(host(harness).querySelector('app-language-week')).toBeNull();
  });

  it('deleting asks DeleteWithUndo, then tombstones the phrase', async () => {
    const deleteWithUndo = fakeDeleteWithUndo();
    const harness = await setUp(deleteWithUndo);
    await addPhrase(harness);

    click(harness, 'app-language-item-form .delete-button');
    expect(deleteWithUndo.calls[0].deletedMessage).toBe('Phrase deleted');

    deleteWithUndo.calls[0].onConfirm();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(stored().phrases[0].deletedAt).toBeDefined();
    expect(host(harness).textContent).toContain('No phrases yet.');
  });
});
