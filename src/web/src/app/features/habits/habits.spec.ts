import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { HABITS } from '../../core/habits/habits';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import {
  ExerciseHubStatus,
  ExerciseRegistryEntry,
  registerExercise,
  resetExerciseRegistryForTesting,
  snapshotExerciseRegistryForTesting,
} from '../../shared/exercise-kit/exercise-registry';
import {
  registerHubAction,
  resetHubActionRegistryForTesting,
  snapshotHubActionRegistryForTesting,
} from '../../shared/exercise-kit/hub-action-registry';
import { configureApp, renderShellAt } from '../../testing/app-test-setup';
import { ComingSoonExercise, HABIT_HUB_COMING_SOON } from './habit-hub-coming-soon';

const H2_MISSION: ExerciseRegistryEntry = {
  exerciseId: 'h2-mission',
  habit: 'h2',
  titleKey: 'habits.paradigms.title',
  shortTitleKey: 'titles.about',
  summaryKey: 'nav.back',
  icon: 'flag',
  route: 'habits/h2/mission',
};

const H2_ROLES: ExerciseRegistryEntry = {
  exerciseId: 'h2-roles',
  habit: 'h2',
  titleKey: 'titles.plan',
  shortTitleKey: 'titles.plan',
  summaryKey: 'nav.back',
  icon: 'flag',
  route: 'habits/h2/roles',
};

describe('Habits feature', () => {
  it('lists every habit hub', async () => {
    configureApp({ handset: false });
    const fixture = await renderShellAt('/habits');
    const host = fixture.nativeElement as HTMLElement;

    const items = [...host.querySelectorAll('app-habits-page a')];
    expect(items.length).toBe(HABITS.length);
    expect(items[1].getAttribute('href')).toBe('/habits/h1');
  });

  it('lists every habit by its short title, not the long one (#218)', async () => {
    configureApp({ handset: false });
    const fixture = await renderShellAt('/habits');
    const host = fixture.nativeElement as HTMLElement;
    const transloco = TestBed.inject(TranslocoService);

    const titles = [...host.querySelectorAll('app-habits-page [matListItemTitle]')].map((el) =>
      el.textContent?.trim(),
    );
    expect(titles).toEqual(HABITS.map((habit) => transloco.translate(habit.shortTitleKey)));
    expect(titles[5]).toBe('5 · Understand first');
  });

  it('uses the short title for the hub page title and keeps the long one in its h1 (#218)', async () => {
    configureApp({ handset: false });
    const fixture = await renderShellAt('/habits/h5');
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[data-testid="page-title"]')?.textContent?.trim()).toBe(
      '5 · Understand first',
    );
    expect(host.querySelector('app-habit-hub-page h1')?.textContent?.trim()).toBe(
      'Habit 5: Seek first to understand, then to be understood',
    );
  });

  // 'paradigms' now has a real registered exercise (#51's `paradigms-transition`), so it no
  // longer shows the empty state — same reason `e2e/habits.spec.ts` picks a hub with none.
  it.each(
    HABITS.filter((habit) => habit.id !== 'paradigms').map(
      (habit) => [habit.id, habit.titleKey] as const,
    ),
  )(
    'renders the %s hub with its title and empty state when nothing is registered',
    async (id, titleKey) => {
      configureApp({ handset: true });
      const fixture = await renderShellAt(`/habits/${id}`);
      const host = fixture.nativeElement as HTMLElement;

      const expected = TestBed.inject(TranslocoService).translate(titleKey);
      expect(host.querySelector('app-habit-hub-page h1')?.textContent?.trim()).toBe(expected);
      expect(host.querySelector('app-habit-hub-page')?.textContent).toContain('coming soon');
    },
  );

  it('lists the real paradigms-transition exercise on the paradigms hub (#51)', async () => {
    configureApp({ handset: false });
    const fixture = await renderShellAt('/habits/paradigms');
    const host = fixture.nativeElement as HTMLElement;

    // The paradigms hub has grown more real exercises since #51 (#49, #50), so this looks up the
    // link by its own `href` rather than assuming it's first on the page — registration order
    // among them isn't this test's concern, only that transition's own link is there and correct.
    const link = host.querySelector(
      'app-habit-hub-page mat-nav-list a[href="/habits/paradigms/transition"]',
    );
    expect(link).not.toBeNull();
  });

  it('does not match unknown habit ids', async () => {
    configureApp({ handset: false });
    await renderShellAt('/habits/h9');
    expect(TestBed.inject(Router).url).toBe('/');
  });

  describe('with exercises registered', () => {
    let snapshot: ReturnType<typeof snapshotExerciseRegistryForTesting>;

    beforeEach(() => {
      snapshot = snapshotExerciseRegistryForTesting();
      resetExerciseRegistryForTesting();
      registerExercise(H2_MISSION);
      registerExercise(H2_ROLES);
    });

    afterEach(() => resetExerciseRegistryForTesting(snapshot));

    it('lists registered exercises with title, summary and a Continue action to the first not-done one', async () => {
      configureApp({ handset: false });
      const fixture = await renderShellAt('/habits/h2');
      const host = fixture.nativeElement as HTMLElement;
      const transloco = TestBed.inject(TranslocoService);

      const links = [...host.querySelectorAll('app-habit-hub-page mat-nav-list a')];
      expect(links).toHaveLength(2);
      expect(links[0].getAttribute('href')).toBe('/habits/h2/mission');
      // Chrome shows the short title only; the long one belongs to the exercise page (#218).
      expect(links[0].textContent).toContain(transloco.translate(H2_MISSION.shortTitleKey));
      expect(links[0].textContent).not.toContain(transloco.translate(H2_MISSION.titleKey));
      expect(links[0].textContent).toContain(transloco.translate(H2_MISSION.summaryKey));

      const continueLink = host.querySelector('app-habit-hub-page .hub-continue');
      expect(continueLink?.getAttribute('href')).toBe('/habits/h2/mission');
      expect(continueLink?.textContent?.trim()).toContain(
        transloco.translate('habits.hub.continueButton', {
          title: transloco.translate(H2_MISSION.shortTitleKey),
        }),
      );
    });

    it('shows a done badge and moves Continue to the next exercise once one is marked done', async () => {
      configureApp({
        handset: false,
        providers: [
          { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
        ],
      });
      const fixture = await renderShellAt('/habits/h2');

      TestBed.inject(ExerciseProgress).markDone('h2-mission');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      const links = [...host.querySelectorAll('app-habit-hub-page mat-nav-list a')];
      expect(links[0].querySelector('.hub-status')).toBeTruthy();
      expect(host.querySelector('app-habit-hub-page .hub-continue')?.getAttribute('href')).toBe(
        '/habits/h2/roles',
      );
    });

    it('has no Continue action once every exercise is done', async () => {
      configureApp({
        handset: false,
        providers: [
          { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
        ],
      });
      const fixture = await renderShellAt('/habits/h2');

      const progress = TestBed.inject(ExerciseProgress);
      progress.markDone('h2-mission');
      progress.markDone('h2-roles');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelector('app-habit-hub-page .hub-continue')).toBeNull();
    });

    it('shows a progress ring and count on the overview page', async () => {
      configureApp({
        handset: false,
        providers: [
          { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
        ],
      });
      const fixture = await renderShellAt('/habits');

      TestBed.inject(ExerciseProgress).markDone('h2-mission');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      const h2Index = HABITS.findIndex((habit) => habit.id === 'h2');
      const h2Item = [...host.querySelectorAll('app-habits-page a')][h2Index];
      expect(h2Item.querySelector('mat-progress-spinner')).toBeTruthy();
      expect(h2Item.querySelector('.habit-progress-count')?.textContent?.trim()).toBe(
        TestBed.inject(TranslocoService).translate('habits.progress', { done: 1, total: 2 }),
      );
    });
  });

  describe('hub actions and status (#52)', () => {
    let actionSnapshot: ReturnType<typeof snapshotHubActionRegistryForTesting>;
    let exerciseSnapshot: ReturnType<typeof snapshotExerciseRegistryForTesting>;

    beforeEach(() => {
      actionSnapshot = snapshotHubActionRegistryForTesting();
      resetHubActionRegistryForTesting();
      exerciseSnapshot = snapshotExerciseRegistryForTesting();
      resetExerciseRegistryForTesting();
    });

    afterEach(() => {
      resetHubActionRegistryForTesting(actionSnapshot);
      resetExerciseRegistryForTesting(exerciseSnapshot);
    });

    it('renders every registered hub action on every habit hub, with query params built from that habit', async () => {
      registerHubAction({
        id: 'teach-this',
        labelKey: 'nav.back',
        icon: 'campaign',
        route: 'habits/paradigms-teach/teach',
        queryParams: (habit) => ({ chapter: habit }),
      });
      configureApp({ handset: false });
      const fixture = await renderShellAt('/habits/h3');
      const host = fixture.nativeElement as HTMLElement;

      const action = host.querySelector('app-habit-hub-page .hub-action') as HTMLAnchorElement;
      expect(action).not.toBeNull();
      expect(action.getAttribute('href')).toBe('/habits/paradigms-teach/teach?chapter=h3');
    });

    it("renders a registered exercise's status factory output next to it", async () => {
      // A real plural-shaped key (`habits.exercises.paradigms-teach.sharedCount`, issue #52) —
      // `AppPluralPipe` needs `.one`/`.other` categories to resolve, which a plain string key
      // (e.g. `nav.back`) doesn't have.
      const status = signal<ExerciseHubStatus | null>({
        key: 'habits.exercises.paradigms-teach.sharedCount',
        count: 2,
      });
      registerExercise({
        exerciseId: 'h3-example',
        habit: 'h3',
        titleKey: 'titles.paradigms',
        shortTitleKey: 'titles.paradigms',
        summaryKey: 'nav.back',
        icon: 'flag',
        route: 'habits/h3/example',
        statusFactory: (): Signal<ExerciseHubStatus | null> => status,
      });
      configureApp({ handset: false });
      const fixture = await renderShellAt('/habits/h3');
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelector('app-habit-hub-page .hub-exercise-status')).not.toBeNull();
    });
  });

  describe('coming soon', () => {
    const comingSoon: ComingSoonExercise[] = [{ habit: 'h3', shortTitleKey: 'titles.journal' }];

    it('previews a feature-flagged, unregistered exercise as coming soon', async () => {
      configureApp({
        handset: false,
        providers: [{ provide: HABIT_HUB_COMING_SOON, useValue: comingSoon }],
      });
      const fixture = await renderShellAt('/habits/h3');
      const host = fixture.nativeElement as HTMLElement;
      const transloco = TestBed.inject(TranslocoService);

      const item = host.querySelector('app-habit-hub-page .hub-coming-soon');
      expect(item?.textContent).toContain(transloco.translate('titles.journal'));
      expect(item?.textContent).toContain(transloco.translate('habits.hub.comingSoon'));
      expect(host.querySelector('app-habit-hub-page')?.textContent).not.toContain(
        transloco.translate('habits.hub.noExercises'),
      );
    });
  });
});
