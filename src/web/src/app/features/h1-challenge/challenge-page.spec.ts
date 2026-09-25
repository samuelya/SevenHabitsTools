import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { AppDialog } from '../../core/layout/app-dialog';
import { CLOCK } from '../../core/time/clock';
// Side-effect only: `DoneToggle`'s caption and the date adapter read `settings` via `featureStore`.
import '../../features/settings/settings.model';
import {
  COMMITMENTS_MODEL_KEY,
  Commitment,
  registerCommitmentsModel,
} from '../../shared/commitments/commitments.model';
import { DELETE_CONFIRM_DIALOG_LOADER } from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { ChallengeCheckinForm } from './challenge-checkin-form';
import { ChallengeDayDetail } from './challenge-day-detail';
import { ChallengeStartForm } from './challenge-start-form';
import {
  CHALLENGE_MODEL_KEY,
  CHALLENGE_ROUTE,
  Challenge,
  registerChallengeModel,
} from './challenge.model';
import challengeRoutes from './challenge.routes';

const PAGE_URL = `/${CHALLENGE_ROUTE}`;
const START = '2026-03-01';
/** Local noon on day `n` of a test started on `START`, in any test time zone. */
const dayOf = (n: number): Date => new Date(2026, 2, n, 12);
const ALL_YES = { influence: true, promise: true, response: true, noBlame: true };

function testRoutes(): Routes {
  return [{ path: CHALLENGE_ROUTE, children: challengeRoutes }];
}

let now = dayOf(1);
let confirmStop = true;

async function setUp(at: Date, url = PAGE_URL): Promise<RouterTestingHarness> {
  now = at;
  registerExerciseKitModel();
  registerCommitmentsModel();
  registerChallengeModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(testRoutes(), withComponentInputBinding()),
      { provide: CLOCK, useValue: { now: () => now } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      {
        provide: AppDialog,
        useValue: { open: async () => ({ afterClosed: () => of(confirmStop) }) },
      },
      {
        provide: DELETE_CONFIRM_DIALOG_LOADER,
        useValue: async () => ({ DeleteConfirmDialog: class {} }),
      },
    ],
  });
  return RouterTestingHarness.create(url);
}

function seed(...records: Challenge[]): void {
  TestBed.runInInjectionContext(() =>
    featureStore<Challenge[]>(CHALLENGE_MODEL_KEY).update((current) => [...current, ...records]),
  );
}

function seedPromises(...records: Commitment[]): void {
  TestBed.runInInjectionContext(() =>
    featureStore<Commitment[]>(COMMITMENTS_MODEL_KEY).update((current) => [...current, ...records]),
  );
}

function stored(): Challenge[] {
  return TestBed.runInInjectionContext(() =>
    featureStore<Challenge[]>(CHALLENGE_MODEL_KEY).value(),
  );
}

function challenge(fields: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-01T08:00:00.000Z',
    startDate: START,
    status: 'active',
    checkins: [],
    ...fields,
  };
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

function text(harness: RouterTestingHarness): string {
  return host(harness).textContent ?? '';
}

function button(harness: RouterTestingHarness, label: string): HTMLButtonElement {
  return [...host(harness).querySelectorAll('button')].find((b) =>
    b.textContent?.includes(label),
  ) as HTMLButtonElement;
}

async function settle(harness: RouterTestingHarness): Promise<void> {
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
}

function markDone(harness: RouterTestingHarness): HTMLButtonElement {
  return host(harness).querySelector('app-done-toggle button') as HTMLButtonElement;
}

describe('ChallengePage', () => {
  beforeEach(() => {
    confirmStop = true;
  });

  it('shows the start form with no test, and "Start test" creates the running test', async () => {
    const harness = await setUp(dayOf(1));
    expect(text(harness)).toContain('Start a test');
    expect(host(harness).querySelector('app-challenge-summary')).toBeNull();
    const form = harness.routeDebugElement!.query(By.directive(ChallengeStartForm));
    (form.componentInstance as ChallengeStartForm).started.emit({
      startDate: '',
      focus: 'How I talk to my teenager.',
    });
    await settle(harness);
    expect(stored()).toEqual([
      expect.objectContaining({
        startDate: '2026-03-01',
        status: 'active',
        checkins: [],
        focus: 'How I talk to my teenager.',
      }),
    ]);
    expect(host(harness).querySelector('.day-title')?.textContent).toContain('Day 1 of 30');
    expect(host(harness).querySelectorAll('.strip .cell')).toHaveLength(30);
  });

  it("saves tonight's check-in on day 1 and shows the streak and count", async () => {
    const harness = await setUp(dayOf(1));
    seed(challenge());
    await settle(harness);
    const form = harness.routeDebugElement!.query(By.directive(ChallengeCheckinForm));
    (form.componentInstance as ChallengeCheckinForm).saved.emit({
      answers: ALL_YES,
      note: 'Asked what we could change.',
    });
    await settle(harness);
    expect(stored()[0].checkins).toEqual([
      { date: '2026-03-01', answers: ALL_YES, note: 'Asked what we could change.' },
    ]);
    expect(text(harness)).toContain('Saved. See you tomorrow.');
    expect(text(harness)).toContain('1-day streak');
    expect(text(harness)).toContain('Checked in 1 of 30 days');
    expect(text(harness)).not.toContain('Halfway');
  });

  it('marks a missed day skipped from its cell, on day 15, with the halfway note open', async () => {
    const harness = await setUp(dayOf(15));
    seed(challenge());
    await settle(harness);
    expect(host(harness).querySelector('.day-title')?.textContent).toContain('Day 15 of 30');
    expect(text(harness)).toContain("Fifteen days in. What's changed in where your energy goes?");
    expect(text(harness)).not.toContain('Finish test');

    host(harness).querySelectorAll<HTMLButtonElement>('.strip .cell')[2].click();
    await settle(harness);
    const detail = harness.routeDebugElement!.query(By.directive(ChallengeDayDetail));
    expect(detail).toBeTruthy();
    (detail.componentInstance as ChallengeDayDetail).skipped.emit('Ill in bed all day.');
    await settle(harness);
    expect(stored()[0].checkins).toEqual([
      { date: '2026-03-03', skipped: true, skipReason: 'Ill in bed all day.' },
    ]);
    expect(button(harness, 'Mark skipped')).toBeUndefined();
  });

  it('lists the promises due today read-only, or says there are none', async () => {
    const harness = await setUp(dayOf(15));
    seed(challenge());
    await settle(harness);
    expect(text(harness)).toContain('No promises due today. Make one in Your promises.');
    seedPromises({
      id: 'p1',
      createdAt: '2026-03-10T08:00:00.000Z',
      updatedAt: '2026-03-10T08:00:00.000Z',
      text: 'Call Mum',
      toWhom: 'self',
      status: 'open',
      dueDate: '2026-03-15',
    });
    await settle(harness);
    expect(host(harness).querySelector('.promise-list')?.textContent).toContain('Call Mum');
    expect(host(harness).querySelector('.promise-list')?.textContent).toContain('Open');
  });

  it('on day 30, finishing needs the final note, then completes and opens the gate', async () => {
    const harness = await setUp(dayOf(30));
    seed(challenge({ checkins: [{ date: '2026-03-29', answers: ALL_YES }] }));
    await settle(harness);
    expect(markDone(harness).getAttribute('aria-disabled')).toBe('true');
    const finish = button(harness, 'Finish test');
    expect(finish.getAttribute('aria-disabled')).toBe('true');
    finish.click();
    await settle(harness);
    expect(stored()[0].status).toBe('active');

    TestBed.runInInjectionContext(() =>
      featureStore<Challenge[]>(CHALLENGE_MODEL_KEY).update((list) =>
        list.map((c) => ({ ...c, finalNote: 'Fewer arguments.' })),
      ),
    );
    await settle(harness);
    button(harness, 'Finish test').click();
    await settle(harness);
    expect(stored()[0]).toMatchObject({ status: 'completed', endedOn: '2026-03-30' });
    expect(text(harness)).toContain('Start a test');
    expect(host(harness).querySelector('app-challenge-summary')?.textContent).toContain(
      'Checked in 1 of 30 days',
    );
    expect(text(harness)).toContain('Past tests');
    expect(markDone(harness).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('on day 31 there is no check-in, and Finish stays available', async () => {
    const harness = await setUp(dayOf(31));
    seed(challenge());
    await settle(harness);
    expect(host(harness).querySelector('.day-title')?.textContent).toContain('Day 30 of 30');
    expect(host(harness).querySelector('app-challenge-checkin-form')).toBeNull();
    expect(button(harness, 'Finish test')).toBeTruthy();
  });

  it('stops a test after the confirm, and never opens the gate with it', async () => {
    const harness = await setUp(dayOf(31));
    seed(challenge({ finalNote: 'x' }));
    await settle(harness);
    confirmStop = false;
    button(harness, 'Stop test').click();
    await settle(harness);
    expect(stored()[0].status).toBe('active');
    confirmStop = true;
    button(harness, 'Stop test').click();
    await settle(harness);
    expect(stored()[0]).toMatchObject({ status: 'stopped', endedOn: '2026-03-31' });
    expect(text(harness)).toContain('Start a test');
    expect(markDone(harness).getAttribute('aria-disabled')).toBe('true');
  });

  it('opens a past test read-only by its id', async () => {
    const harness = await setUp(dayOf(20));
    seed(
      challenge({
        id: 'old',
        startDate: '2026-01-01',
        status: 'stopped',
        endedOn: '2026-01-10',
        midNote: 'I catch myself faster.',
        checkins: [{ date: '2026-01-02', answers: ALL_YES }],
      }),
    );
    await harness.navigateByUrl(`${PAGE_URL}/old`);
    await settle(harness);
    expect(host(harness).querySelector('.viewed-heading')?.textContent).toContain('Stopped');
    expect(text(harness)).toContain('I catch myself faster.');
    expect(host(harness).querySelector('app-challenge-checkin-form')).toBeNull();
    expect(host(harness).querySelector('app-challenge-start-form')).toBeNull();
    expect(button(harness, 'Stop test')).toBeUndefined();
    host(harness).querySelectorAll<HTMLButtonElement>('.strip .cell')[1].click();
    await settle(harness);
    expect(host(harness).querySelector('app-challenge-day-detail')?.textContent).toContain('Yes');
    expect(button(harness, 'Mark skipped')).toBeUndefined();
  });
});
