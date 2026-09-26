import { Signal, TemplateRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { HABITS } from '../../core/habits/habits';
import { ExerciseGuideOpener } from '../../shared/exercise-kit/exercise-guide/exercise-guide-opener';
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

const H2_TEST_A: ExerciseRegistryEntry = {
  exerciseId: 'h2-test-a',
  habit: 'h2',
  titleKey: 'habits.paradigms.title',
  shortTitleKey: 'titles.about',
  icon: 'flag',
  route: 'habits/h2/test-a',
};

const H2_TEST_B: ExerciseRegistryEntry = {
  exerciseId: 'h2-test-b',
  habit: 'h2',
  titleKey: 'titles.plan',
  shortTitleKey: 'titles.plan',
  icon: 'flag',
  route: 'habits/h2/test-b',
};

describe('Habits feature', () => {
  it('shows Paradigms, Habit 1 and Habit 2 available, Habit 3 next up and the rest collapsed under one row (#219, #57, #59)', async () => {
    configureApp({ handset: false });
    const fixture = await renderShellAt('/habits');
    const host = fixture.nativeElement as HTMLElement;
    const transloco = TestBed.inject(TranslocoService);

    const items = [...host.querySelectorAll('app-habits-page a')];
    expect(items.map((item) => item.getAttribute('href'))).toEqual([
      '/habits/paradigms',
      '/habits/h1',
      '/habits/h2',
      '/habits/h3',
    ]);
    expect(items[0].querySelector('mat-progress-spinner')).toBeTruthy();
    expect(items[1].querySelector('mat-progress-spinner')).toBeTruthy();
    expect(items[2].querySelector('mat-progress-spinner')).toBeTruthy();
    expect(items[3].querySelector('.habit-coming-soon-chip')?.textContent?.trim()).toBe(
      transloco.translate('habits.hub.comingSoon'),
    );

    const toggle = host.querySelector('app-habits-page .habit-later-toggle') as HTMLButtonElement;
    expect(toggle.querySelector('.habit-title')?.textContent?.trim()).toBe(
      'Habits 4–7 and Interdependence: coming soon',
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('habits-later');
  });

  it('expands the collapsed row to every remaining habit, by its short title (#218, #219)', async () => {
    configureApp({ handset: false });
    const fixture = await renderShellAt('/habits');
    const host = fixture.nativeElement as HTMLElement;
    const transloco = TestBed.inject(TranslocoService);

    (host.querySelector('app-habits-page .habit-later-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(
      host.querySelector('app-habits-page .habit-later-toggle')?.getAttribute('aria-expanded'),
    ).toBe('true');
    const links = [...host.querySelectorAll('app-habits-page a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      HABITS.map((habit) => `/habits/${habit.id}`),
    );
    const titles = [...host.querySelectorAll('app-habits-page a .habit-title')].map((el) =>
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

  // 'paradigms' (#51's `paradigms-transition`), 'h1' (#57's `h1-commitments`) and 'h2' (#59's
  // `h2-roles`) now have real registered exercises, so they no longer show the empty state — same
  // reason `e2e/habits.spec.ts` picks a hub with none.
  it.each(
    HABITS.filter((habit) => !['paradigms', 'h1', 'h2'].includes(habit.id)).map(
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
      registerExercise(H2_TEST_A);
      registerExercise(H2_TEST_B);
    });

    afterEach(() => resetExerciseRegistryForTesting(snapshot));

    it('lists registered exercises with number, short title and status, and a Continue action to the first not-done one', async () => {
      configureApp({ handset: false });
      const fixture = await renderShellAt('/habits/h2');
      const host = fixture.nativeElement as HTMLElement;
      const transloco = TestBed.inject(TranslocoService);

      const links = [...host.querySelectorAll('app-habit-hub-page mat-nav-list a')];
      expect(links).toHaveLength(2);
      expect(links[0].getAttribute('href')).toBe('/habits/h2/test-a');
      // Chrome shows the short title only; the long one belongs to the exercise page (#218).
      expect(links[0].textContent).toContain(transloco.translate(H2_TEST_A.shortTitleKey));
      expect(links[0].textContent).not.toContain(transloco.translate(H2_TEST_A.titleKey));
      expect(links[0].querySelector('.hub-number')?.textContent?.trim()).toBe('1');
      // No summary line (#219); the status column is part of the link's accessible name.
      expect(links[0].querySelector('.hub-not-started')?.textContent?.trim()).toBe(
        transloco.translate('habits.hub.notStarted'),
      );

      const continueLink = host.querySelector('app-habit-hub-page .hub-continue');
      expect(continueLink?.getAttribute('href')).toBe('/habits/h2/test-a');
      expect(continueLink?.textContent?.trim()).toContain(
        transloco.translate('habits.hub.continueButton', {
          title: transloco.translate(H2_TEST_A.shortTitleKey),
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

      TestBed.inject(ExerciseProgress).markDone('h2-test-a');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      const links = [...host.querySelectorAll('app-habit-hub-page mat-nav-list a')];
      expect(links[0].querySelector('.hub-status')).toBeTruthy();
      expect(host.querySelector('app-habit-hub-page .hub-continue')?.getAttribute('href')).toBe(
        '/habits/h2/test-b',
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
      progress.markDone('h2-test-a');
      progress.markDone('h2-test-b');
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

      TestBed.inject(ExerciseProgress).markDone('h2-test-a');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      const h2Item = host.querySelector('app-habits-page a[href="/habits/h2"]') as HTMLElement;
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

  describe('hub order, status column and About this habit (#219)', () => {
    let exerciseSnapshot: ReturnType<typeof snapshotExerciseRegistryForTesting>;
    let actionSnapshot: ReturnType<typeof snapshotHubActionRegistryForTesting>;

    beforeEach(() => {
      exerciseSnapshot = snapshotExerciseRegistryForTesting();
      actionSnapshot = snapshotHubActionRegistryForTesting();
      resetExerciseRegistryForTesting();
      resetHubActionRegistryForTesting();
    });

    afterEach(() => {
      resetExerciseRegistryForTesting(exerciseSnapshot);
      resetHubActionRegistryForTesting(actionSnapshot);
    });

    function h4(exerciseId: string, extra: Partial<ExerciseRegistryEntry> = {}) {
      registerExercise({
        exerciseId,
        habit: 'h4',
        titleKey: 'titles.plan',
        shortTitleKey: 'titles.plan',
        icon: 'flag',
        route: `habits/h4/${exerciseId}`,
        ...extra,
      });
    }

    it('lists exercises and picks Continue in `order`, unordered ones last in registration order', async () => {
      h4('unordered');
      h4('second', { order: 20 });
      h4('first', { order: 10 });
      configureApp({ handset: false });
      const fixture = await renderShellAt('/habits/h4');
      const host = fixture.nativeElement as HTMLElement;

      const hrefs = [...host.querySelectorAll('app-habit-hub-page mat-nav-list a')].map((link) =>
        link.getAttribute('href'),
      );
      expect(hrefs).toEqual(['/habits/h4/first', '/habits/h4/second', '/habits/h4/unordered']);
      expect(host.querySelector('app-habit-hub-page .hub-continue')?.getAttribute('href')).toBe(
        '/habits/h4/first',
      );
    });

    it('shows Not started, In progress, the exercise text or the done date per row', async () => {
      h4('idle', { order: 10 });
      h4('started', { order: 20, isStarted: () => signal(true) });
      h4('counted', {
        order: 30,
        isStarted: () => signal(true),
        statusFactory: () =>
          signal<ExerciseHubStatus | null>({
            key: 'habits.exercises.paradigms-perception.stepsDone',
            count: 2,
            params: { total: 3 },
          }),
      });
      h4('finished', { order: 40, isStarted: () => signal(true) });
      configureApp({
        handset: false,
        providers: [
          { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
        ],
      });
      const fixture = await renderShellAt('/habits/h4');
      TestBed.inject(ExerciseProgress).markDone('finished');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      const statuses = [...host.querySelectorAll('app-habit-hub-page .hub-row-status')].map(
        (status) => status.textContent?.trim(),
      );
      expect(statuses[0]).toBe('Not started');
      expect(statuses[1]).toBe('In progress');
      expect(statuses[2]).toBe('2 of 3 steps');
      expect(statuses[3]).toMatch(/^check_circle\s+Completed /);
    });

    it('puts the hub actions after the list, as text buttons', async () => {
      h4('only', { order: 10 });
      registerHubAction({ id: 'teach', labelKey: 'nav.back', icon: 'campaign', route: 'x' });
      configureApp({ handset: false });
      const fixture = await renderShellAt('/habits/h4');
      const host = fixture.nativeElement as HTMLElement;

      const list = host.querySelector('app-habit-hub-page mat-nav-list') as Element;
      const action = host.querySelector('app-habit-hub-page .hub-action') as Element;
      expect(list.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(action.hasAttribute('mat-button')).toBe(true);
    });

    it('opens the intro in the guide dialog, titled About this habit', async () => {
      const open = vi.fn().mockResolvedValue(undefined);
      configureApp({
        handset: false,
        providers: [{ provide: ExerciseGuideOpener, useValue: { open } }],
      });
      const fixture = await renderShellAt('/habits/h1');
      const host = fixture.nativeElement as HTMLElement;
      const transloco = TestBed.inject(TranslocoService);

      const about = host.querySelector('app-habit-hub-page .hub-about') as HTMLButtonElement;
      expect(about.getAttribute('aria-label')).toBe('About this habit');
      about.click();

      expect(open).toHaveBeenCalledTimes(1);
      const [content, , options] = open.mock.calls[0] as [
        { inShort: string },
        unknown,
        { title: string; extra: unknown },
      ];
      expect(content.inShort).toBe(transloco.translate('habits.about.h1.inShort'));
      expect(content.inShort).not.toBe('habits.about.h1.inShort');
      expect(options.title).toBe('About this habit');
      expect(options.extra).toBeInstanceOf(TemplateRef);
    });

    it('About this habit lists the exercises in order with their hub status (#230)', async () => {
      h4('second', { order: 20, shortTitleKey: 'titles.about', isStarted: () => signal(true) });
      h4('first', { order: 10 });
      configureApp({ handset: false });
      const fixture = await renderShellAt('/habits/h4');
      const host = fixture.nativeElement as HTMLElement;

      (host.querySelector('app-habit-hub-page .hub-about') as HTMLButtonElement).click();
      const dialog = await vi.waitFor(() => {
        const found = document.querySelector('app-exercise-guide');
        expect(found?.querySelector('.about-exercise')).toBeTruthy();
        return found as HTMLElement;
      });
      fixture.detectChanges();

      const rowTitles = Array.from(host.querySelectorAll('.hub-exercise .hub-exercise-title')).map(
        (title) => title.textContent?.trim(),
      );
      const aboutTitles = Array.from(
        dialog.querySelectorAll('.about-exercise .hub-exercise-title'),
      ).map((title) => title.textContent?.trim());
      expect(aboutTitles).toEqual(rowTitles);
      const rowStatuses = Array.from(host.querySelectorAll('.hub-exercise .hub-row-status')).map(
        (status) => status.textContent?.trim(),
      );
      const aboutStatuses = Array.from(
        dialog.querySelectorAll('.about-exercise .hub-row-status'),
      ).map((status) => status.textContent?.trim());
      expect(aboutStatuses).toEqual(rowStatuses);
      expect(dialog.querySelector('.about-exercises-title')?.textContent?.trim()).toBe(
        'Exercises in this habit',
      );
    });
  });
});
