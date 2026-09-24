import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TeachItemForm } from './teach-item-form';
import type { ExerciseGuideContent } from '../../shared/exercise-kit/exercise-guide/exercise-guide';
import {
  addSampleEntry,
  CHAPTER_STATUS_KINDS,
  guideForEntries,
  hubStatus,
  isComplete,
  isStarted,
  labelsFrom,
  sharedCount,
  summarize,
  teachSampleFromExample,
  toListItem,
  upsertEntry,
} from './teach.logic';
import { registerTeachModel, TEACH_MODEL_KEY, TEACH_ROUTE, TeachEntry } from './teach.model';
import teachRoutes from './teach.routes';

/** "Try this example" (issue #232), apart from `teach-page.spec.ts` and `teach.logic.spec.ts` to
 * keep every file under the 500-line rule: the page flow first, mounted at its real `TEACH_ROUTE`,
 * then the sample logic. */
const LIST_URL = `/${TEACH_ROUTE}`;

const EXAMPLE = {
  chapter: 'paradigms',
  keyIdea: 'How I see a problem shapes what I do.',
  person: 'My sister',
  status: 'shared',
};

async function setUp(): Promise<RouterTestingHarness> {
  registerExerciseKitModel();
  registerTeachModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter([{ path: TEACH_ROUTE, children: teachRoutes }], withComponentInputBinding()),
      { provide: CLOCK, useValue: { now: () => new Date('2026-01-10T00:00:00.000Z') } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: DeleteWithUndo, useValue: { confirmAndDelete: vi.fn() } },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

function promptCard(harness: RouterTestingHarness): ExercisePromptCard {
  return harness.routeDebugElement!.query(By.directive(ExercisePromptCard)).componentInstance;
}

async function tryExample(
  harness: RouterTestingHarness,
  sample: Record<string, unknown>,
): Promise<void> {
  promptCard(harness).exampleTried.emit(sample);
  harness.detectChanges();
  await harness.fixture.whenStable();
}

const NOW = new Date('2026-01-10T00:00:00.000Z');

/** In `CHAPTER_STATUS_KINDS` order. */
const STATUS_LABELS = CHAPTER_STATUS_KINDS.map((kind) => (kind === 'overdue' ? 'Overdue' : kind));

function entry(overrides: Partial<TeachEntry> = {}): TeachEntry {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    chapter: 'h1',
    keyIdea: 'Choose your response',
    plannedAt: '2026-01-03',
    status: 'planned',
    ...overrides,
  };
}

function store() {
  return TestBed.runInInjectionContext(() => featureStore<TeachEntry[]>(TEACH_MODEL_KEY));
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

describe('TeachPage "Try this example" (issue #232)', () => {
  it("fills the example's chapter as a sample and opens that chapter's editor", async () => {
    const harness = await setUp();
    await tryExample(harness, EXAMPLE);

    const entries = store().value();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ ...EXAMPLE, plannedAt: '2026-01-12', sample: true });
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/paradigms`);
    const form = harness.routeDebugElement!.query(By.directive(TeachItemForm));
    expect((form.componentInstance as TeachItemForm).entry().keyIdea).toBe(EXAMPLE.keyIdea);
  });

  it('shows the "Example" chip and counts toward nothing, until the first edit', async () => {
    const harness = await setUp();
    await tryExample(harness, EXAMPLE);

    const chipsOf = () =>
      [...host(harness).querySelectorAll('.exercise-list__chip')].map((chip) =>
        chip.textContent?.trim(),
      );
    expect(chipsOf()).toContain('Example');
    expect(host(harness).querySelector('app-teach-summary')).toBeNull();
    const markDone = () =>
      (host(harness).querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      );
    expect(markDone()).toBe('true');

    const form = harness.routeDebugElement!.query(By.directive(TeachItemForm));
    (form.componentInstance as TeachItemForm).changed.emit({ person: 'My brother' });
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect('sample' in store().value()[0]).toBe(false);
    expect(chipsOf()).not.toContain('Example');
    expect(host(harness).querySelector('app-teach-summary')).not.toBeNull();
    expect(markDone()).not.toBe('true');
  });

  it('Back skips the blank chapter editor it was tried from (replaceUrl)', async () => {
    const harness = await setUp();
    await harness.navigateByUrl(`${LIST_URL}/h1`);
    await tryExample(harness, EXAMPLE);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/paradigms`);

    const location = TestBed.inject(Location);
    location.back();
    expect(location.path()).not.toBe(`${LIST_URL}/h1`);
  });

  it("never overwrites a chapter's own entry, and the guide stops offering it", async () => {
    const harness = await setUp();
    const own: TeachEntry = {
      id: 'own',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      chapter: 'paradigms',
      keyIdea: 'My own words',
      plannedAt: '2026-01-20',
      status: 'planned',
    };
    store().update(() => [own]);
    harness.detectChanges();
    await harness.fixture.whenStable();
    const before = store().value();

    const guide = promptCard(harness).guide();
    expect(guide?.examples.length).toBeGreaterThan(0);
    expect(guide?.examples.every((example) => !('sample' in example) || !example.sample)).toBe(
      true,
    );

    await tryExample(harness, EXAMPLE);

    expect(store().value()).toBe(before);
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
  });
});

describe('samples (issue #232)', () => {
  const sample = (overrides: Partial<TeachEntry> = {}) =>
    entry({ sample: true, status: 'shared', ...overrides });

  it('counts toward nothing while flagged: started, shared count, hub, summary, done gate', () => {
    const entries = [sample({ status: 'planned', plannedAt: '2026-01-01' })];

    expect(isStarted(entries)).toBe(false);
    expect(sharedCount([sample()])).toBe(0);
    expect(hubStatus([sample()])).toBeNull();
    expect(summarize(entries, NOW)).toEqual({ shared: 0, overdue: 0, total: 10 });
    expect(isComplete([sample()])).toBe(false);
  });

  it('shows an "Example" chip before the status chip and never the done check', () => {
    const labels = labelsFrom(['h1'], ['Habit 1'], STATUS_LABELS, 'Example');
    const item = toListItem('h1', sample(), labels, NOW, (date) => date);

    expect(item.chips?.map((chip) => chip.label)).toEqual(['Example', 'shared']);
    expect(item.done).toBe(false);
    expect(item.deletable).toBe(true);
  });

  it('never warns "Overdue" while flagged: row and chip', () => {
    const labels = labelsFrom(['h1'], ['Habit 1'], STATUS_LABELS, 'Example');
    const item = toListItem('h1', sample({ status: 'planned' }), labels, NOW, (date) => date);

    expect(item.warning).toBe(false);
    expect(item.chips?.some((chip) => chip.warning)).toBe(false);
  });

  it("a shared example gets no sharedAt: it isn't a real share", () => {
    const [created] = addSampleEntry([], 'paradigms', { keyIdea: 'Idea', status: 'shared' }, NOW);

    expect(created.sample).toBe(true);
    expect(created.sharedAt).toBeUndefined();
  });

  it('the edit that clears the flag stamps sharedAt if the status is still shared', () => {
    const [created] = addSampleEntry([], 'paradigms', { keyIdea: 'Idea', status: 'shared' }, NOW);
    const later = new Date('2026-01-15T12:00:00.000Z');

    const [kept] = upsertEntry([created], 'paradigms', { person: 'Sam' }, later);
    expect(kept.sharedAt).toBe('2026-01-15');
    const [reopened] = upsertEntry([created], 'paradigms', { status: 'planned' }, later);
    expect(reopened.sharedAt).toBeUndefined();
  });

  it('any edit clears the flag, whichever field changed', () => {
    const [edited] = upsertEntry([sample()], 'h1', { status: 'skipped' }, NOW);

    expect(edited.status).toBe('skipped');
    expect('sample' in edited).toBe(false);
    expect(isStarted([edited])).toBe(true);
  });

  it("addSampleEntry creates the chapter's entry flagged as a sample", () => {
    const [created] = addSampleEntry([], 'paradigms', { keyIdea: 'Idea', status: 'planned' }, NOW);

    expect(created).toMatchObject({
      chapter: 'paradigms',
      keyIdea: 'Idea',
      status: 'planned',
      plannedAt: '2026-01-12',
      sample: true,
    });
  });

  it('addSampleEntry never touches a chapter that already has a live entry', () => {
    const own = entry({ chapter: 'paradigms' });

    expect(addSampleEntry([own], 'paradigms', { keyIdea: 'Idea', status: 'planned' }, NOW)).toEqual(
      [own],
    );
  });
});

describe('teachSampleFromExample (issue #232)', () => {
  const valid = { chapter: 'paradigms', keyIdea: 'Idea', status: 'shared', person: 'Sam' };

  it('maps a valid example to its chapter and fields, keeping only non-blank optional text', () => {
    expect(teachSampleFromExample({ ...valid, learned: ' ' })).toEqual({
      chapter: 'paradigms',
      fields: { keyIdea: 'Idea', status: 'shared', person: 'Sam' },
    });
  });

  it.each([
    ['null', null],
    ['an unknown chapter', { ...valid, chapter: 'h9' }],
    ['a blank key idea', { ...valid, keyIdea: ' ' }],
    ['an unknown status', { ...valid, status: 'done' }],
  ])('rejects %s', (_label, value) => {
    expect(teachSampleFromExample(value)).toBeNull();
  });
});

describe('guideForEntries (issue #232)', () => {
  const guide: ExerciseGuideContent = {
    inShort: 'x',
    howTo: ['y'],
    afterwards: 'z',
    examples: [
      { kind: 'card', title: 'A', fields: [], sample: { chapter: 'paradigms' } },
      { title: 'B', fields: [] },
    ],
  };

  it('keeps "Try this example" while the chapter has no live entry', () => {
    expect(guideForEntries(guide, [entry({ chapter: 'paradigms', deletedAt: 'x' })])).toBe(guide);
    expect(guideForEntries(null, [])).toBeNull();
  });

  it("drops it once the example's chapter has a live entry", () => {
    const result = guideForEntries(guide, [entry({ chapter: 'paradigms' })]);

    expect(result?.examples[0]).toMatchObject({ title: 'A', sample: undefined });
    expect(result?.examples[1]).toBe(guide.examples[1]);
  });
});
