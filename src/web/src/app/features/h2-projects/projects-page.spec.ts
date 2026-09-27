import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { DocumentStore } from '../../core/data/document.store';
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
import { ProjectItemForm } from './project-item-form';
import { Project, registerProjectsModel } from '../../shared/projects/projects.model';
import { ProjectsService } from '../../shared/projects/projects.service';
import { PROJECTS_ROUTE, registerProjectsExercise } from './projects.model';
import projectsRoutes from './projects.routes';

const LIST_URL = `/${PROJECTS_ROUTE}`;
const NOW = new Date(2026, 8, 10, 10, 0, 0);
const T0 = '2026-09-01T00:00:00.000Z';

interface Setup {
  harness: RouterTestingHarness;
  stored: () => readonly Project[];
  deletes: ConfirmAndDeleteOptions[];
}

async function setUp(seed: Project[] = [], url = LIST_URL): Promise<Setup> {
  registerExerciseKitModel();
  registerProjectsModel();
  registerProjectsExercise();
  const deletes: ConfirmAndDeleteOptions[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(
        [{ path: PROJECTS_ROUTE, children: projectsRoutes }] satisfies Routes,
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
  const service = TestBed.inject(ProjectsService);
  if (seed.length) {
    service.update(() => seed);
  }
  const harness = await RouterTestingHarness.create(url);
  return { harness, stored: () => service.value(), deletes };
}

function project(id: string, fields: Partial<Project> = {}): Project {
  return {
    id,
    createdAt: T0,
    updatedAt: T0,
    name: `Project ${id}`,
    desiredResult: 'It went well.',
    criteria: [],
    steps: [
      { key: `${id}-1`, text: 'First', done: true },
      { key: `${id}-2`, text: 'Second', done: false },
    ],
    status: 'underWay',
    ...fields,
  };
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

function form(harness: RouterTestingHarness): ProjectItemForm {
  return harness.routeDebugElement!.query(By.directive(ProjectItemForm)).componentInstance;
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

function headings(harness: RouterTestingHarness): string[] {
  return [...host(harness).querySelectorAll('.group-legend')].map(
    (el) => el.textContent?.trim() ?? '',
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

describe('ProjectsPage', () => {
  it('renders the long title, the prompt, the gloss and the empty list, with no summary', async () => {
    const { harness } = await setUp();
    const text = host(harness).textContent ?? '';
    expect(text).toContain('Picture the result, then plan the steps');
    expect(text).toContain("Pick something you'll have to do soon");
    expect(text).toContain('everything is created twice');
    expect(text).toContain("No projects yet. What's coming up in the next few weeks?");
    expect(headings(harness)).toEqual([]);
    expect(host(harness).querySelector('app-projects-summary')).toBeNull();
  });

  it('creates the project on the first typed character in the name, not on Add (#217)', async () => {
    const { harness, stored } = await setUp();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);

    form(harness).changed.emit({ status: 'underWay' });
    form(harness).changed.emit({ deadline: '' });
    await settle(harness);
    expect(stored()).toEqual([]);

    form(harness).changed.emit({ name: 'M' });
    await settle(harness);
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ name: 'M', status: 'underWay', criteria: [], steps: [] });
    expect('deadline' in stored()[0]).toBe(false);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${stored()[0].id}`);
    expect(rows(harness)).toEqual(['M']);
  });

  it('leaves nothing behind when an untouched draft is closed', async () => {
    const { harness } = await setUp();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    form(harness).changed.emit({ criteria: [''] });
    await TestBed.inject(Router).navigateByUrl(LIST_URL);
    await settle(harness);
    const doc = TestBed.inject(DocumentStore).document() as unknown as {
      habits?: { h2?: { projects?: unknown[] } };
    };
    expect(doc.habits?.h2?.projects ?? []).toEqual([]);
  });

  it('shows progress and deadline in the row, and flags an overdue project', async () => {
    const { harness } = await setUp([
      project('a', { deadline: '2026-09-09' }),
      project('b', { steps: [] }),
    ]);
    await settle(harness);
    expect(rows(harness)).toEqual(['Overdue: Project a', 'Project b']);
    expect(subtitles(harness)[0]).toMatch(/^1 of 2 steps · Sep 9, 2026$/);
  });

  it('groups Under way and a collapsed Finished group, with no heading for an empty group', async () => {
    const { harness } = await setUp([project('a'), project('b', { status: 'dropped' })]);
    await settle(harness);
    expect(headings(harness)).toEqual(['Under way', 'expand_more Finished']);
    const toggle = host(harness).querySelector('#finished-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(rows(harness)).toEqual(['Project a']);
    toggle.click();
    await settle(harness);
    expect(rows(harness)).toEqual(['Project a', 'Project b']);
  });

  it('keeps Finished collapsed when the user closes it and the selection leaves a finished project', async () => {
    const { harness } = await setUp(
      [project('a'), project('b', { status: 'done' })],
      `${LIST_URL}/b`,
    );
    await settle(harness);
    const toggle = () => host(harness).querySelector('#finished-toggle') as HTMLButtonElement;
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    toggle().click();
    await settle(harness);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    await TestBed.inject(Router).navigateByUrl(`${LIST_URL}/a`);
    await settle(harness);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    await TestBed.inject(Router).navigateByUrl(LIST_URL);
    await settle(harness);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    await TestBed.inject(Router).navigateByUrl(`${LIST_URL}/b`);
    await settle(harness);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('shows only Finished when nothing is under way', async () => {
    const { harness } = await setUp([project('a', { status: 'done' })]);
    await settle(harness);
    expect(headings(harness)).toEqual(['expand_more Finished']);
    expect(host(harness).textContent).not.toContain('No projects yet');
  });

  it('shows the summary once a counted project exists and gates Mark done on a Done project', async () => {
    const { harness, stored } = await setUp(
      [project('a'), project('b', { steps: [] })],
      `${LIST_URL}/a`,
    );
    await settle(harness);
    const summary = () => host(harness).querySelector('app-projects-summary')?.textContent ?? '';
    expect(summary()).toContain('2 projects, 0 done');
    expect(summary()).toContain('1 of 2 steps done');
    expect(markDoneButton(harness).getAttribute('aria-disabled')).toBe('true');
    expect(host(harness).textContent).toContain('Finish the project');

    form(harness).changed.emit({ status: 'done' });
    await settle(harness);
    expect(stored()[0].status).toBe('done');
    expect(summary()).toContain('2 projects, 1 done');
    expect(markDoneButton(harness).getAttribute('aria-disabled')).not.toBe('true');
    // The project just finished moves to the Finished group, opened because it is selected.
    const toggle = host(harness).querySelector('#finished-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('"Try this example" adds a sample due in 14 days, counted nowhere, reopened on a second try', async () => {
    const { harness, stored } = await setUp();
    const card = harness.routeDebugElement!.query(By.directive(ExercisePromptCard));
    const prompt = card.componentInstance as ExercisePromptCard;
    const sample = {
      name: 'Lunch',
      desiredResult: 'Everyone there.',
      criteria: ['All came.'],
      deadline: true,
      steps: [{ text: 'Ask', done: false }],
      status: 'planning',
    };
    prompt.exampleTried.emit(sample);
    await settle(harness);
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ name: 'Lunch', sample: true, deadline: '2026-09-24' });
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${stored()[0].id}`);
    expect(host(harness).querySelector('app-projects-summary')).toBeNull();

    prompt.exampleTried.emit(sample);
    await settle(harness);
    expect(stored()).toHaveLength(1);
  });

  it('deletes with undo', async () => {
    const { harness, stored, deletes } = await setUp([project('a')]);
    await settle(harness);
    (host(harness).querySelector('.exercise-list__delete') as HTMLButtonElement).click();
    await settle(harness);
    deletes[0].onConfirm();
    expect(stored()[0].deletedAt).toBe(NOW.toISOString());
    deletes[0].onUndo();
    expect(stored()[0].deletedAt).toBeUndefined();
  });

  it('uses the singular for one step in the row and the summary, in en and ar', async () => {
    const { harness } = await setUp([
      project('a', { steps: [{ key: 'a-1', text: 'Only', done: false }] }),
    ]);
    await settle(harness);
    const summary = () => host(harness).querySelector('app-projects-summary')?.textContent ?? '';
    expect(subtitles(harness)).toEqual(['0 of 1 step']);
    expect(summary()).toContain('1 project, 0 done');
    expect(summary()).toContain('0 of 1 step done');
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await settle(harness);
    expect(subtitles(harness)[0]).toContain('من خطوة واحدة');
    expect(summary()).toContain('مشروع واحد، تم منه');
    expect(summary()).toContain('من خطوة واحدة');
    TestBed.inject(TranslocoService).setActiveLang('en');
  });

  it('follows a language switch in the row subtitle', async () => {
    const { harness } = await setUp([project('a')]);
    await settle(harness);
    expect(subtitles(harness)).toEqual(['1 of 2 steps']);
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await settle(harness);
    expect(subtitles(harness)[0]).toContain('من خطوتين');
    TestBed.inject(TranslocoService).setActiveLang('en');
  });
});
