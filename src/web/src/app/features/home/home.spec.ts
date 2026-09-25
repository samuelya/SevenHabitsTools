import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { DocumentStore } from '../../core/data/document.store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import {
  ExerciseRegistryEntry,
  registerExercise,
  resetExerciseRegistryForTesting,
  snapshotExerciseRegistryForTesting,
} from '../../shared/exercise-kit/exercise-registry';
import { configureApp, renderShellAt } from '../../testing/app-test-setup';

const H2_MISSION: ExerciseRegistryEntry = {
  exerciseId: 'h2-mission',
  habit: 'h2',
  titleKey: 'titles.about',
  shortTitleKey: 'titles.about',
  icon: 'flag',
  route: 'habits/h2/mission',
  order: 10,
  isStarted: () => signal(true),
  statusFactory: () =>
    signal({
      key: 'habits.exercises.paradigms-perception.stepsDone',
      count: 2,
      params: { total: 3 },
    }),
};

const H2_ROLES: ExerciseRegistryEntry = {
  exerciseId: 'h2-roles',
  habit: 'h2',
  titleKey: 'titles.plan',
  shortTitleKey: 'titles.plan',
  icon: 'flag',
  route: 'habits/h2/roles',
  order: 20,
};

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('Today (home, #220)', () => {
  let snapshot: ReturnType<typeof snapshotExerciseRegistryForTesting>;

  beforeEach(() => {
    snapshot = snapshotExerciseRegistryForTesting();
    resetExerciseRegistryForTesting();
    registerExercise(H2_MISSION);
    registerExercise(H2_ROLES);
    configureApp({
      handset: true,
      providers: [
        { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      ],
    });
  });

  afterEach(() => resetExerciseRegistryForTesting(snapshot));

  it('on first run shows the paragraph, a Continue card with progress, and one visually hidden h1', async () => {
    const fixture = await renderShellAt('/');
    const host = fixture.nativeElement as HTMLElement;
    const transloco = TestBed.inject(TranslocoService);

    expect(text(host.querySelector('.today-first-run'))).toBe(transloco.translate('home.firstRun'));
    const headings = host.querySelectorAll('app-home-page h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].classList).toContain('visually-hidden');
    expect(text(headings[0])).toBe(transloco.translate('home.heading'));

    const card = host.querySelector('app-continue-card a');
    expect(card?.getAttribute('href')).toBe('/habits/h2/mission');
    const label = transloco.translate('habits.hub.continueButton', {
      title: transloco.translate('titles.about'),
    });
    expect(text(card)).toContain(label);
    expect(text(card)).toContain(transloco.translate('habits.h2.shortTitle'));
    expect(text(card)).toContain('2 of 3 steps');
  });

  it('shows one progress row per available habit and one for the next one, never all nine', async () => {
    const fixture = await renderShellAt('/');
    const host = fixture.nativeElement as HTMLElement;
    const transloco = TestBed.inject(TranslocoService);

    const rows = [...host.querySelectorAll('.today-progress a')];
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(['/habits/h2', '/habits/h3']);
    expect(text(rows[0].querySelector('.habit-progress-count'))).toBe(
      transloco.translate('habits.progress', { done: 0, total: 2 }),
    );
    expect(text(rows[1].querySelector('.today-habit__coming-soon'))).toBe(
      transloco.translate('habits.hub.comingSoon'),
    );
  });

  it('drops the first-run paragraph after the first Mark done and moves Continue on', async () => {
    const fixture = await renderShellAt('/');
    const host = fixture.nativeElement as HTMLElement;

    TestBed.inject(ExerciseProgress).markDone('h2-mission');
    fixture.detectChanges();

    expect(host.querySelector('.today-first-run')).toBeNull();
    const card = host.querySelector('app-continue-card a');
    expect(card?.getAttribute('href')).toBe('/habits/h2/roles');
    // Not started: no progress line.
    expect(card?.querySelector('.continue-card__detail')).toBeNull();
  });

  it('renders the Continue detail and progress counts in Eastern Arabic-Indic digits (#229 F-F2)', async () => {
    const fixture = await renderShellAt('/');
    const host = fixture.nativeElement as HTMLElement;

    TestBed.inject(DocumentStore).update('settings', (settings) => ({
      ...(settings as object),
      numerals: 'arabic',
    }));
    fixture.detectChanges();

    expect(text(host.querySelector('app-continue-card .continue-card__detail'))).toMatch(/٢.*٣/);
    expect(text(host.querySelector('.today-progress .habit-progress-count'))).toMatch(/٠.*٢/);
  });

  it('keeps the paragraph hidden after a reopen, since a completion record still exists', async () => {
    const fixture = await renderShellAt('/');
    const progress = TestBed.inject(ExerciseProgress);

    progress.markDone('h2-mission');
    progress.reopen('h2-mission');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.today-first-run')).toBeNull();
  });

  it('replaces the card with "All done for now" naming the next habit once everything is done', async () => {
    const fixture = await renderShellAt('/');
    const host = fixture.nativeElement as HTMLElement;
    const transloco = TestBed.inject(TranslocoService);

    const progress = TestBed.inject(ExerciseProgress);
    progress.markDone('h2-mission');
    progress.markDone('h2-roles');
    fixture.detectChanges();

    expect(host.querySelector('app-continue-card')).toBeNull();
    expect(text(host.querySelector('.today-all-done'))).toBe(
      transloco.translate('home.allDoneNextUp', {
        habit: transloco.translate('habits.h3.title'),
      }),
    );
  });
});
