import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
// Side-effect only: `DoneToggle`'s "Completed <time>" caption renders through `AppDatePipe` —
// see `transition-page.spec.ts`'s own import for the same reason.
import '../../features/settings/settings.model';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TeachItemForm } from './teach-item-form';
import teachRoutes from './teach.routes';
import { registerTeachModel, TEACH_ROUTE } from './teach.model';

/** `TEACH_ROUTE`, not '/' — same reasoning as `transition-page.spec.ts`'s own `LIST_URL`: this
 * page navigates absolutely, and mounting the feature anywhere but its real `ROUTE_REGISTRY`
 * prefix would hide the same nesting-depth bug the playbook's "Page layout" section documents. */
const LIST_URL = `/${TEACH_ROUTE}`;

function testRoutes(): Routes {
  return [{ path: TEACH_ROUTE, children: teachRoutes }];
}

async function setUp(
  options: { now?: string; attached?: boolean; url?: string } = {},
): Promise<RouterTestingHarness> {
  // Vitest here runs with `isolate: false` — see `exercise-kit.model.spec.ts` for why these
  // re-assert their registration instead of resetting it.
  registerExerciseKitModel();
  registerTeachModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(testRoutes(), withComponentInputBinding()),
      {
        provide: CLOCK,
        useValue: { now: () => new Date(options.now ?? '2026-01-10T00:00:00.000Z') },
      },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const harness = await RouterTestingHarness.create(options.url ?? LIST_URL);
  if (options.attached) {
    document.body.appendChild(harness.fixture.nativeElement);
  }
  return harness;
}

function pageInstance(harness: RouterTestingHarness): unknown {
  return harness.routeDebugElement!.componentInstance;
}

async function closeEditor(harness: RouterTestingHarness): Promise<void> {
  (harness.routeNativeElement!.querySelector('.editor-close') as HTMLButtonElement).click();
  await harness.fixture.whenStable();
}

async function selectChapter(harness: RouterTestingHarness, index: number): Promise<void> {
  const host = harness.routeNativeElement as HTMLElement;
  const buttons = host.querySelectorAll('app-exercise-list mat-nav-list button');
  (buttons[index] as HTMLButtonElement).focus();
  (buttons[index] as HTMLButtonElement).click();
  await harness.fixture.whenStable();
}

function itemForm(harness: RouterTestingHarness): TeachItemForm {
  return harness.routeDebugElement!.query(By.directive(TeachItemForm)).componentInstance;
}

describe('TeachPage', () => {
  it('renders the prompt card title and all ten chapters, with Mark done disabled', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;

    expect(host.textContent).toContain('Teach it to learn it');
    expect(host.querySelectorAll('app-exercise-list mat-nav-list button')).toHaveLength(10);
    const markDone = host.querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone.disabled).toBe(true);
  });

  it('opens a chapter with no entry yet in the full-screen editor, defaulted to "planned"', async () => {
    const harness = await setUp();
    await selectChapter(harness, 0);
    const host = harness.routeNativeElement as HTMLElement;

    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/h1`);
    expect(host.querySelector('app-teach-item-form')).not.toBeNull();
    expect(itemForm(harness).entry().status).toBe('planned');
    expect(itemForm(harness).entry().plannedAt).toBe('2026-01-12');
  });

  it('creates the chapter entry on first edit and shows it in the list, enabling Mark done once shared', async () => {
    const harness = await setUp();
    await selectChapter(harness, 0);
    const host = harness.routeNativeElement as HTMLElement;

    itemForm(harness).changed.emit({ keyIdea: 'Choose your response' });
    itemForm(harness).changed.emit({ status: 'shared' });
    harness.detectChanges();

    expect(host.querySelectorAll('app-exercise-list mat-nav-list button')[0].textContent).toContain(
      'Shared',
    );
    const markDone = host.querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone.disabled).toBe(false);
  });

  it('marks done and reopens through DoneToggle', async () => {
    const harness = await setUp();
    await selectChapter(harness, 0);
    itemForm(harness).changed.emit({ keyIdea: 'Choose your response', status: 'shared' });
    harness.detectChanges();
    const host = harness.routeNativeElement as HTMLElement;

    (host.querySelector('app-done-toggle button') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Reopen');
  });

  it('redirects to the list when :itemId is not one of the fixed chapter keys', async () => {
    const harness = await setUp();
    await harness.navigateByUrl(`${LIST_URL}/not-a-chapter`);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-teach-item-form')).toBeNull();
  });

  it('pre-selects the chapter from a "teach this" hub-action link\'s ?chapter= query param', async () => {
    const harness = await setUp({ url: `${LIST_URL}?chapter=h3` });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/h3`);
    expect(harness.routeNativeElement?.querySelector('app-teach-item-form')).not.toBeNull();
  });

  it('ignores an invalid ?chapter= query param and stays on the list', async () => {
    const harness = await setUp({ url: `${LIST_URL}?chapter=nope` });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}?chapter=nope`);
    expect(harness.routeNativeElement?.querySelector('app-teach-item-form')).toBeNull();
  });

  it('keeps the one page instance alive across opening and closing the editor', async () => {
    const harness = await setUp();
    const page = pageInstance(harness);

    await selectChapter(harness, 0);
    expect(pageInstance(harness)).toBe(page);

    await closeEditor(harness);
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(pageInstance(harness)).toBe(page);
  });

  it('reopens the editor on a fresh navigation straight to a chapter (deep link)', async () => {
    const harness = await setUp();

    await harness.navigateByUrl(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-teach-item-form')).toBeNull();

    await harness.navigateByUrl(`${LIST_URL}/h2`);
    expect(harness.routeNativeElement?.querySelector('app-teach-item-form')).not.toBeNull();
  });

  it('shows the summary counts for shared and overdue entries', async () => {
    const harness = await setUp();
    await selectChapter(harness, 0);
    itemForm(harness).changed.emit({ keyIdea: 'Choose your response', status: 'shared' });
    harness.detectChanges();

    const summaryText = harness.routeNativeElement?.querySelector('app-teach-summary')?.textContent;
    expect(summaryText).toContain('1');
    expect(summaryText).toContain('10');
  });

  it("updates a chapter's translated subtitle when the active language changes", async () => {
    const harness = await setUp();
    await selectChapter(harness, 0);
    itemForm(harness).changed.emit({ keyIdea: 'Choose your response', status: 'shared' });
    harness.detectChanges();
    const host = harness.routeNativeElement as HTMLElement;
    // The selected row's own CSS class, not a list position — English and Arabic sort the ten
    // translated chapter titles into a different order, so a row's *index* isn't stable across
    // the language switch this test makes, only its identity as "the selected one" is.
    const selectedRow = () =>
      host.querySelector('app-exercise-list .exercise-list__item--selected');

    expect(selectedRow()?.textContent).toContain('Shared');

    TestBed.inject(TranslocoService).setActiveLang('ar');
    harness.detectChanges();

    expect(selectedRow()?.textContent).toContain('تمت المشاركة');
  });
});
