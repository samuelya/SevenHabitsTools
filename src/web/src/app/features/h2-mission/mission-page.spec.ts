import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { of } from 'rxjs';
import type { Mock } from 'vitest';
import { DocumentStore } from '../../core/data/document.store';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { AppSnackbar } from '../../core/layout/app-snackbar';
import { CLOCK } from '../../core/time/clock';
// Every model and mission input, as the app registers them (the feeders are other features).
import '../../model-registry';
import { MAX_LINES } from '../../shared/mission/mission.logic';
import { MissionService } from '../../shared/mission/mission.service';
import { RolesService } from '../../shared/roles/roles.service';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { MissionPage } from './mission-page';

const T = '2026-09-20T10:00:00.000Z';
const rec = (id: string, fields: object) => ({ id, createdAt: T, updatedAt: T, ...fields });

type CopyMock = Mock<(text: string) => boolean>;

const snackbarOpen = vi.fn(async () => undefined);

interface Seed {
  readonly values?: readonly string[];
  readonly inspirations?: readonly object[];
  readonly principles?: readonly object[];
  readonly numerals?: 'western' | 'arabic';
}

async function setUp(
  seed: Seed = {},
  handset = false,
): Promise<{ fixture: ComponentFixture<MissionPage>; host: HTMLElement; copy: CopyMock }> {
  const state: BreakpointState = { matches: handset, breakpoints: {} };
  const copy: CopyMock = vi.fn<(text: string) => boolean>(() => true);
  snackbarOpen.mockClear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTranslocoTesting(),
      provideTranslocoScope('h2-mission'),
      provideTranslocoScope('exercise-kit'),
      { provide: CLOCK, useValue: { now: () => new Date('2026-09-26T09:00:00.000Z') } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: Clipboard, useValue: { copy } },
      // Stubbed: the real one lazy-loads MatSnackBar, which lands after this test's injector is gone.
      { provide: AppSnackbar, useValue: { open: snackbarOpen } },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of(state), isMatched: () => handset },
      },
    ],
  });
  TestBed.runInInjectionContext(() => {
    if (seed.values) {
      featureStore<object[]>('h2-long-view').update(() => [
        rec('lv1', {
          scenario: 'oneYear',
          date: '2026-09-20',
          answers: [{ promptKey: 'oneYear.who', text: 'My family', values: seed.values }],
        }),
      ]);
    }
    if (seed.principles) {
      featureStore<object[]>('h2-centres').update(() => [
        rec('c1', { date: '2026-09-20', ratings: {}, principles: seed.principles }),
      ]);
    }
    if (seed.numerals) {
      TestBed.inject(DocumentStore).update('settings', () => ({
        language: 'en',
        numerals: seed.numerals,
      }));
    }
    if (seed.inspirations) {
      featureStore<object[]>('h2-inspiration').update(() => [...seed.inspirations!]);
    }
  });
  const fixture = TestBed.createComponent(MissionPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, host: fixture.nativeElement as HTMLElement, copy };
}

const mission = () => TestBed.inject(MissionService);

/** A suggestion toggle: its text plus, while pressed, a check icon. */
function suggestion(host: HTMLElement, text: string): HTMLButtonElement {
  return [...host.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find((button) =>
    button.textContent?.includes(text),
  )!;
}

function buttonsWithText(host: HTMLElement, text: string): HTMLButtonElement[] {
  return [...host.querySelectorAll('button')].filter(
    (button) => button.textContent?.trim() === text,
  );
}

describe('MissionPage', () => {
  it('renders the long title and creates nothing until the first edit', async () => {
    const { host } = await setUp();
    expect(host.querySelector('h1')?.textContent).toContain(
      'Write your personal mission statement',
    );
    expect(host.textContent).toContain('No values yet.');
    expect(mission().record()).toBeNull();
  });

  it('offers the long view values as toggle buttons that copy the text on press', async () => {
    const { fixture, host } = await setUp({ values: ['presence', 'time'] });
    expect(host.textContent).toContain('From Your long view');
    expect(suggestion(host, 'presence').getAttribute('aria-pressed')).toBe('false');

    suggestion(host, 'presence').click();
    fixture.detectChanges();
    expect(mission().record()?.values).toEqual(['presence']);
    expect(suggestion(host, 'presence').getAttribute('aria-pressed')).toBe('true');

    suggestion(host, 'presence').click();
    fixture.detectChanges();
    expect(mission().record()?.values).toEqual([]);
  });

  it('keeps a suggested principle by its key and shows it in the current language', async () => {
    const { fixture, host } = await setUp({
      principles: [{ key: 'integrity' }, { name: 'keeping my word' }],
    });
    suggestion(host, 'Integrity').click();
    suggestion(host, 'keeping my word').click();
    fixture.detectChanges();
    expect(mission().record()?.principles).toEqual(['integrity', 'keeping my word']);

    TestBed.inject(TranslocoService).setActiveLang('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(suggestion(host, 'النزاهة').getAttribute('aria-pressed')).toBe('true');
    expect(suggestion(host, 'keeping my word').getAttribute('aria-pressed')).toBe('true');
    const own = [...host.querySelectorAll('.chip-label')].map((chip) => chip.textContent?.trim());
    expect(own).not.toContain('Integrity');
    expect(own).not.toContain('integrity');
    TestBed.inject(TranslocoService).setActiveLang('en');
  });

  it('shows a kept principle key its source no longer offers translated, typed ones as typed', async () => {
    const { fixture, host } = await setUp();
    mission().addLine('principles', 'courage');
    mission().addLine('principles', 'showing up');
    fixture.detectChanges();
    const own = () =>
      [...host.querySelectorAll('.chip-label')].map((chip) => chip.textContent?.trim());
    expect(own()).toEqual(['Courage', 'showing up']);

    TestBed.inject(TranslocoService).setActiveLang('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(own()).toEqual(['الشجاعة', 'showing up']);
    TestBed.inject(TranslocoService).setActiveLang('en');
  });

  it('shows the roles empty line with a link, then a line editor per active role', async () => {
    const { fixture, host } = await setUp();
    expect(host.textContent).toContain('No roles yet.');
    expect(host.querySelector('a[href="/habits/h2/roles"]')).not.toBeNull();

    TestBed.inject(RolesService).add({ name: 'Parent' });
    fixture.detectChanges();
    // The roles store adds the built-in renewal role with the first one the user names.
    const names = [...host.querySelectorAll('.role-name')].map((name) => name.textContent?.trim());
    expect(names).toContain('Parent');
    expect(host.textContent).toContain('In this role I want to be');
  });

  it('keeps a role row on screen until the step is left, even once archived and cleared', async () => {
    const { fixture, host } = await setUp();
    const roles = TestBed.inject(RolesService);
    const id = roles.add({ name: 'Coach' })!;
    mission().setRoleLine(id, 'show up');
    fixture.detectChanges();
    const names = () =>
      [...host.querySelectorAll('.role-name')].map((name) => name.textContent?.trim());

    roles.archive(id);
    mission().setRoleLine(id, '');
    fixture.detectChanges();
    expect(names()).toContain('Coach');

    // Retyping on the kept row writes the line again.
    mission().setRoleLine(id, 'show up again');
    fixture.detectChanges();
    expect(names()).toContain('Coach');
    mission().setRoleLine(id, '');
    fixture.detectChanges();

    (host.querySelectorAll('mat-step-header')[3] as HTMLElement).click();
    fixture.detectChanges();
    expect(names()).not.toContain('Coach');
  });

  it('counts the draft words on every keystroke, before the autosave', async () => {
    const { fixture, host } = await setUp();
    const field = host.querySelector('.draft-editor textarea') as HTMLTextAreaElement;
    field.value = 'one two three';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.querySelector('.draft-editor .word-count')?.textContent?.trim()).toBe('3 words');
    expect(mission().record()).toBeNull();
  });

  it('says when the collection filters match nothing and clears them', async () => {
    const { fixture, host } = await setUp({
      inspirations: [
        rec('i1', { text: 'Call first.', kind: 'idea', tags: ['friends'] }),
        rec('i2', { text: 'Be kind.', kind: 'saying', tags: ['work'] }),
      ],
    });
    const panel = host.querySelector('app-mission-collection') as HTMLElement;
    const chip = (text: string) =>
      [...panel.querySelectorAll('mat-chip-option')]
        .find((option) => option.textContent?.trim() === text)!
        .querySelector('button') as HTMLButtonElement;

    chip('An idea to try').click();
    fixture.detectChanges();
    chip('work').click();
    fixture.detectChanges();
    expect(panel.textContent).toContain('Nothing in your collection matches these filters.');
    expect(panel.querySelectorAll('.item')).toHaveLength(0);

    buttonsWithText(panel, 'Clear filters')[0].click();
    fixture.detectChanges();
    expect(panel.querySelectorAll('.item')).toHaveLength(2);
    expect(panel.textContent).not.toContain('Nothing in your collection matches');
  });

  it('keeps "All" selected when it is tapped again', async () => {
    const { fixture, host } = await setUp({
      inspirations: [
        rec('i1', { text: 'Call first.', kind: 'idea', tags: [] }),
        rec('i2', { text: 'Be kind.', kind: 'saying', tags: [] }),
      ],
    });
    const all = [...host.querySelectorAll('app-mission-collection mat-chip-option')].find(
      (option) => option.textContent?.trim() === 'All',
    )!;
    (all.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(all.querySelector('[role="option"]')?.getAttribute('aria-selected')).toBe('true');
    expect(host.querySelectorAll('app-mission-collection .item')).toHaveLength(2);
  });

  it('keeps a typed line that the full list refuses and shows the hint', async () => {
    const { fixture, host } = await setUp();
    for (let i = 0; i < MAX_LINES; i++) {
      mission().addLine('toBe', `quality ${i}`);
    }
    fixture.detectChanges();
    const lines = host.querySelector('app-mission-lines') as HTMLElement;
    const input = lines.querySelector('input') as HTMLInputElement;
    input.value = 'one more';
    input.dispatchEvent(new Event('input'));
    buttonsWithText(lines, 'Add line')[0].click();
    fixture.detectChanges();

    expect(mission().record()?.toBe).toHaveLength(MAX_LINES);
    expect(input.value).toBe('one more');
    expect(lines.textContent).toContain('Ten is plenty.');
  });

  it('adds a line and clears the field', async () => {
    const { fixture, host } = await setUp();
    const lines = host.querySelectorAll('app-mission-lines')[1] as HTMLElement;
    const input = lines.querySelector('input') as HTMLInputElement;
    input.value = ' teach what I know ';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mission().record()?.toDo).toEqual(['teach what I know']);
    expect(input.value).toBe('');
  });

  it('"Use this" appends the item as a paragraph and announces it', async () => {
    const { fixture, host } = await setUp({
      inspirations: [rec('i1', { text: 'Call first.', kind: 'idea', tags: ['friends'] })],
    });
    mission().edit({ draft: 'I want to be present.' });
    fixture.detectChanges();

    buttonsWithText(host, 'Use this')[0].click();
    fixture.detectChanges();

    expect(mission().record()?.draft).toBe('I want to be present.\n\nCall first.');
    const status = host.querySelector('.draft-editor .status') as HTMLElement;
    expect(status.textContent?.trim()).toBe('Added to the end of your draft.');
    expect(host.querySelector('app-mission-collection .used')?.textContent).toContain(
      'Added to the end of your draft.',
    );
  });

  it('collapses the collection on a handset and expands it from its heading toggle', async () => {
    const { fixture, host } = await setUp({}, true);
    const toggle = host.querySelector('.collection-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(host.textContent).toContain('Your collection is empty.');
    expect(host.querySelector('a[href="/habits/h2/inspiration"]')).not.toBeNull();
  });

  it('saves a version, says so, copies the statement and opens the gate', async () => {
    const { fixture, host, copy } = await setUp();
    const save = () => buttonsWithText(host, 'Save version')[0];
    expect(save().disabled).toBe(true);
    expect(host.textContent).toContain('Write your draft first, then save a version.');

    mission().edit({ draft: 'I keep my word.' });
    fixture.detectChanges();
    expect(save().disabled).toBe(false);
    save().click();
    fixture.detectChanges();

    expect(
      mission()
        .record()
        ?.versions.map((version) => version.text),
    ).toEqual(['I keep my word.']);
    expect(host.textContent).toContain('Version 1 saved.');
    expect(save().disabled).toBe(true);
    const markDone = host.querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone.getAttribute('aria-disabled')).not.toBe('true');

    buttonsWithText(host, 'Copy statement')[0].click();
    expect(copy).toHaveBeenCalledWith('I keep my word.');
    expect(snackbarOpen).toHaveBeenCalledWith('Copied.', '', { duration: 3000 });
  });

  it('writes the word count and the saved version in the chosen numerals', async () => {
    const { fixture, host } = await setUp({ numerals: 'arabic' });
    mission().edit({ draft: 'I keep my word.' });
    fixture.detectChanges();
    expect(host.textContent).toContain('٤ words');
    expect(host.textContent).not.toContain('4 words');

    buttonsWithText(host, 'Save version')[0].click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Version ١ saved.');
  });

  it('stores the review answers', async () => {
    const { fixture, host } = await setUp();
    const yes = [...host.querySelectorAll('.review-toggle')][3].querySelector(
      'button',
    ) as HTMLElement;
    yes.click();
    fixture.detectChanges();
    expect(mission().record()?.checklist).toEqual({ ownWords: true });
  });
});
