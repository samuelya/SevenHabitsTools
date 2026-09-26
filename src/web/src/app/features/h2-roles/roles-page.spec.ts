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
import { ROLES_MODEL_KEY, Role, registerRolesModel } from '../../shared/roles/roles.model';
import { RolesService } from '../../shared/roles/roles.service';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { RolesItemForm } from './roles-item-form';
import { H2_ROLES_ROUTE, registerRolesExercise } from './roles.model';
import rolesRoutes from './roles.routes';

const LIST_URL = `/${H2_ROLES_ROUTE}`;
const NOW = new Date(2026, 2, 10, 10, 0, 0);
const T0 = '2026-03-01T00:00:00.000Z';

function testRoutes(): Routes {
  return [{ path: H2_ROLES_ROUTE, children: rolesRoutes }];
}

interface Setup {
  harness: RouterTestingHarness;
  service: RolesService;
  deletes: ConfirmAndDeleteOptions[];
}

/** Seeds the slice as stored, without `insert()`'s built-in side effect. */
async function setUp(seed: Role[] = [], url = LIST_URL): Promise<Setup> {
  registerExerciseKitModel();
  registerRolesModel();
  registerRolesExercise();
  const deletes: ConfirmAndDeleteOptions[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(testRoutes(), withComponentInputBinding()),
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
  if (seed.length) {
    TestBed.runInInjectionContext(() => featureStore<Role[]>(ROLES_MODEL_KEY).update(() => seed));
  }
  const service = TestBed.inject(RolesService);
  const harness = await RouterTestingHarness.create(url);
  return { harness, service, deletes };
}

function role(id: string, fields: Partial<Role> = {}): Role {
  return { id, createdAt: T0, updatedAt: T0, name: id, order: 0, ...fields };
}

const BUILT_IN = role('saw', { name: undefined, key: 'renewal', order: 0 });

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

function form(harness: RouterTestingHarness): RolesItemForm {
  return harness.routeDebugElement!.query(By.directive(RolesItemForm)).componentInstance;
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

describe('RolesPage', () => {
  it('renders the long title, the prompt, the gloss and the empty list', async () => {
    const { harness } = await setUp();
    const text = host(harness).textContent ?? '';
    expect(text).toContain('Name the roles you play');
    expect(text).toContain('List the parts you play in life');
    expect(text).toContain('no single one crowds out the rest');
    expect(text).toContain('No roles yet.');
    expect(host(harness).querySelector('app-roles-summary')).toBeNull();
  });

  it('creates the role and the built-in on the first typed character, not on Add (#217)', async () => {
    const { harness, service } = await setUp();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);
    expect(service.all()).toEqual([]);

    form(harness).changed.emit({ satisfaction: 4 });
    await settle(harness);
    expect(service.all()).toEqual([]);

    form(harness).changed.emit({ name: 'D' });
    await settle(harness);
    const saved = service.all().find((r) => r.name === 'D')!;
    expect(saved).toMatchObject({ satisfaction: 4, order: 1 });
    expect(service.all().map((r) => r.key ?? r.name)).toEqual(['renewal', 'D']);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${saved.id}`);
    await settle(harness);
    expect(rows(harness)).toEqual(['Sharpen the Saw (Built-in)', 'D']);
  });

  it('leaves nothing behind when an untouched draft is closed', async () => {
    const { harness } = await setUp();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    form(harness).changed.emit({ color: null });
    await settle(harness);
    await TestBed.inject(Router).navigateByUrl(LIST_URL);
    await settle(harness);
    const doc = TestBed.inject(DocumentStore).document() as unknown as {
      shared: { roles?: unknown[] };
    };
    expect(doc.shared.roles ?? []).toEqual([]);
  });

  it('shows the built-in read-only: no name field, archive or delete', async () => {
    const { harness } = await setUp([BUILT_IN, role('dad', { order: 1 })], `${LIST_URL}/saw`);
    await settle(harness);
    const editor = host(harness).querySelector('app-roles-item-form') as HTMLElement;
    expect(editor.textContent).toContain('Sharpen the Saw');
    expect(editor.textContent).toContain('This role comes with the app.');
    expect(editor.querySelector('input[required]')).toBeNull();
    expect(editor.querySelector('.archive')).toBeNull();
    expect(editor.querySelector('.delete-button')).toBeNull();
    const deleteButtons = host(harness).querySelectorAll('.exercise-list__delete');
    expect(deleteButtons).toHaveLength(1);
  });

  it('moves a role up from the editor, disabling Move up at the top', async () => {
    const { harness, service } = await setUp(
      [BUILT_IN, role('dad', { order: 1 })],
      `${LIST_URL}/dad`,
    );
    await settle(harness);
    const up = () => host(harness).querySelector('.move-up') as HTMLButtonElement;
    expect(up().disabled).toBe(false);
    up().click();
    await settle(harness);
    expect(service.active().map((r) => r.id)).toEqual(['dad', 'saw']);
    expect(up().disabled).toBe(true);
  });

  it('archives into a collapsed Archived group and back', async () => {
    const { harness, service } = await setUp(
      [BUILT_IN, role('dad', { order: 1 })],
      `${LIST_URL}/dad`,
    );
    await settle(harness);
    (host(harness).querySelector('.archive') as HTMLButtonElement).click();
    await settle(harness);
    expect(service.byId('dad')()?.archived).toBe(true);
    const toggle = host(harness).querySelector('.archived-toggle') as HTMLButtonElement;
    // Open while the archived role is being edited.
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await TestBed.inject(Router).navigateByUrl(LIST_URL);
    await settle(harness);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(rows(harness)).toEqual(['Sharpen the Saw (Built-in)']);
    toggle.click();
    await settle(harness);
    expect(rows(harness)).toEqual(['Sharpen the Saw (Built-in)', 'dad']);

    service.unarchive('dad');
    await settle(harness);
    expect(host(harness).querySelector('.archived-toggle')).toBeNull();
  });

  it('gates Mark done on three rated roles and a note, with a summary', async () => {
    const { harness } = await setUp([
      BUILT_IN,
      role('a', { order: 1, satisfaction: 3, note: 'Not yet.' }),
      role('b', { order: 2, satisfaction: 4 }),
    ]);
    await settle(harness);
    expect(markDoneButton(harness).getAttribute('aria-disabled')).toBe('true');
    const summary = host(harness).querySelector('app-roles-summary')?.textContent ?? '';
    expect(summary).toContain('3 roles, 2 rated');
    expect(summary).toContain('Average 3.5 of 5');
    expect(host(harness).textContent).toContain("Say how it's going (1–5)");
  });

  it('opens the gate once the third role is rated', async () => {
    const { harness } = await setUp(
      [
        BUILT_IN,
        role('a', { order: 1, satisfaction: 3, note: 'Not yet.' }),
        role('b', { order: 2, satisfaction: 4 }),
      ],
      `${LIST_URL}/saw`,
    );
    await settle(harness);
    form(harness).changed.emit({ satisfaction: 2 });
    await settle(harness);
    expect(markDoneButton(harness).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('warns past seven roles without blocking', async () => {
    const eight = Array.from({ length: 8 }, (_, i) => role(`r${i}`, { order: i }));
    const { harness } = await setUp(eight);
    await settle(harness);
    expect(host(harness).querySelector('.too-many-hint')?.textContent).toContain(
      'More than seven roles',
    );
  });

  it('"Try this example" adds a sample without the built-in, and reopens it on a second try', async () => {
    const { harness, service } = await setUp();
    const card = harness.routeDebugElement!.query(By.directive(ExercisePromptCard));
    const prompt = card.componentInstance as ExercisePromptCard;
    prompt.exampleTried.emit({ name: 'Dad', description: 'Being around, not just providing.' });
    await settle(harness);
    expect(service.all()).toHaveLength(1);
    expect(service.all()[0]).toMatchObject({ name: 'Dad', sample: true });
    expect(host(harness).querySelector('app-roles-summary')).toBeNull();

    prompt.exampleTried.emit({ name: 'Dad' });
    await settle(harness);
    expect(service.all()).toHaveLength(1);
  });

  it('deletes with undo through the service', async () => {
    const { harness, service, deletes } = await setUp([BUILT_IN, role('dad', { order: 1 })]);
    await settle(harness);
    (host(harness).querySelector('.exercise-list__delete') as HTMLButtonElement).click();
    await settle(harness);
    deletes[0].onConfirm();
    expect(service.byId('dad')()).toBeNull();
    deletes[0].onUndo();
    expect(service.byId('dad')()).not.toBeNull();
  });

  it('follows a language switch, the built-in label included', async () => {
    const { harness } = await setUp([BUILT_IN, role('dad', { order: 1, satisfaction: 3 })]);
    await settle(harness);
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await settle(harness);
    expect(host(harness).textContent).toContain('اشحذ المنشار');
    expect(host(harness).textContent).toContain('3 من 5');
    TestBed.inject(TranslocoService).setActiveLang('en');
  });
});
