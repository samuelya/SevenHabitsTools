import { BreakpointObserver } from '@angular/cdk/layout';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { of } from 'rxjs';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { AppDialog } from '../../core/layout/app-dialog';
import { CLOCK } from '../../core/time/clock';
import '../../model-registry';
import { DELETE_CONFIRM_DIALOG_LOADER } from '../../shared/exercise-kit/delete-with-undo';
import { MISSION_MODEL_KEY, Mission } from '../../shared/mission/mission.model';
import { MissionService } from '../../shared/mission/mission.service';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { MissionPage } from './mission-page';

/** Versions and review on the Mission page (issue #62), with a fixed `CLOCK`. */

const T = '2026-08-01T12:00:00.000Z';
const NOW = new Date('2026-09-26T09:00:00.000Z');

function record(fields: Partial<Mission> = {}): Mission {
  return {
    id: 'm1',
    createdAt: T,
    updatedAt: T,
    values: [],
    principles: [],
    roleLines: [],
    toBe: [],
    toDo: [],
    draft: 'I keep my word and call first.',
    checklist: {},
    versions: [
      { id: 'v1', savedAt: T, text: 'I keep my word.' },
      {
        id: 'v2',
        savedAt: '2026-08-20T12:00:00.000Z',
        text: 'I keep my word and call first.',
        note: 'Added the friend line.',
      },
    ],
    ...fields,
  };
}

const dialogOpen = vi.fn();

async function setUp(
  mission: Mission | null,
  confirm = true,
): Promise<{ fixture: ComponentFixture<MissionPage>; host: HTMLElement }> {
  dialogOpen.mockReset();
  dialogOpen.mockImplementation(async () => ({ afterClosed: () => of(confirm) }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTranslocoTesting(),
      provideTranslocoScope('h2-mission'),
      provideTranslocoScope('exercise-kit'),
      { provide: CLOCK, useValue: { now: () => NOW } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: AppDialog, useValue: { open: dialogOpen } },
      {
        provide: DELETE_CONFIRM_DIALOG_LOADER,
        useValue: () => Promise.resolve({ DeleteConfirmDialog: class {} }),
      },
      {
        provide: BreakpointObserver,
        useValue: {
          observe: () => of({ matches: false, breakpoints: {} }),
          isMatched: () => false,
        },
      },
    ],
  });
  if (mission) {
    TestBed.runInInjectionContext(() =>
      featureStore<Mission | null>(MISSION_MODEL_KEY).update(() => mission),
    );
  }
  const fixture = TestBed.createComponent(MissionPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

async function settle(fixture: ComponentFixture<MissionPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function button(host: HTMLElement, text: string): HTMLButtonElement {
  return [...host.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  )!;
}

const rows = (host: HTMLElement) => [...host.querySelectorAll<HTMLButtonElement>('.version-row')];
const service = () => TestBed.inject(MissionService);

describe('MissionPage versions and review (issue #62)', () => {
  it('shows neither section before the first version', async () => {
    const { host } = await setUp(record({ versions: [] }));
    expect(host.querySelector('app-mission-versions')).toBeNull();
    expect(host.querySelector('app-mission-review')).toBeNull();
    expect(host.querySelector('.due-banner')).toBeNull();
  });

  it('lists the versions newest first with date, words and note', async () => {
    const { host } = await setUp(record());
    const titles = rows(host).map((row) => row.querySelector('[matListItemTitle]')?.textContent);
    expect(titles.map((title) => title?.trim())).toEqual(['Version 2', 'Version 1']);
    expect(rows(host)[0].textContent).toContain('7 words');
    expect(rows(host)[0].textContent).toContain('Added the friend line.');
    expect(rows(host)[1].querySelector('.version-note')).toBeNull();
  });

  it('shows the tapped version read-only, and Compare only when there is a previous one', async () => {
    const { fixture, host } = await setUp(record());
    rows(host)[1].click();
    await settle(fixture);
    expect(rows(host)[1].getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.version-text')?.textContent).toBe('I keep my word.');
    expect(button(host, 'Restore')).toBeTruthy();
    expect(button(host, 'Compare')).toBeUndefined();

    rows(host)[0].click();
    await settle(fixture);
    expect(host.querySelector('.version-text')?.textContent).toBe('I keep my word and call first.');
    expect(button(host, 'Compare')).toBeTruthy();
  });

  it('compares with the previous version as ins/del with hidden prefixes and a summary', async () => {
    const { fixture, host } = await setUp(record());
    rows(host)[0].click();
    await settle(fixture);
    button(host, 'Compare').click();
    await settle(fixture);

    const ins = host.querySelector('.diff ins');
    expect(ins?.textContent).toBe('added: word and call first.');
    expect(ins?.querySelector('.visually-hidden')?.textContent).toBe('added: ');
    const del = host.querySelector('.diff del');
    expect(del?.textContent).toBe('removed: word.');
    expect(host.querySelector('.diff-summary')?.textContent?.trim()).toBe(
      '4 words added, 1 removed',
    );

    // Any two from the selects: the same version twice is no change.
    const from = host.querySelectorAll<HTMLSelectElement>('.compare-picks select')[0];
    from.value = 'v2';
    from.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(host.querySelector('.diff-summary')?.textContent?.trim()).toBe(
      'These two versions are the same.',
    );
    expect(host.querySelector('.diff ins, .diff del')).toBeNull();
  });

  it('restores without asking when the draft is the latest version', async () => {
    const { fixture, host } = await setUp(record());
    rows(host)[1].click();
    await settle(fixture);
    button(host, 'Restore').click();
    await settle(fixture);
    expect(dialogOpen).not.toHaveBeenCalled();
    expect(service().record()?.draft).toBe('I keep my word.');
    expect(service().record()?.versions).toHaveLength(2);
    expect(host.querySelector('.detail .status')?.textContent?.trim()).toBe(
      'Version 1 is now your draft.',
    );
  });

  it('asks before replacing an unsaved draft, and "Keep draft" keeps it', async () => {
    const { fixture, host } = await setUp(record({ draft: 'Something new.' }), false);
    rows(host)[1].click();
    await settle(fixture);
    button(host, 'Restore').click();
    await settle(fixture);
    await vi.waitFor(() => expect(dialogOpen).toHaveBeenCalledTimes(1));
    expect(dialogOpen.mock.calls[0][1].data).toEqual({
      title: 'Version 1',
      body: "Replace your current draft with this version? Your draft isn't saved as a version yet.",
      confirmLabel: 'Restore',
      cancelLabel: 'Keep draft',
    });
    await settle(fixture);
    expect(service().record()?.draft).toBe('Something new.');
  });

  it('replaces the unsaved draft once confirmed', async () => {
    const { fixture, host } = await setUp(record({ draft: 'Something new.' }), true);
    rows(host)[1].click();
    await settle(fixture);
    button(host, 'Restore').click();
    await vi.waitFor(() => expect(service().record()?.draft).toBe('I keep my word.'));
  });

  it('saves the note with the version and clears the field', async () => {
    const { fixture, host } = await setUp(record({ draft: 'I keep my word, always.' }));
    // Step 6 holds the note field.
    const header = host.querySelectorAll<HTMLElement>('.mat-step-header')[5];
    header.click();
    await settle(fixture);
    const note = host.querySelector<HTMLInputElement>('.note-field input')!;
    note.value = ' Added always. ';
    note.dispatchEvent(new Event('input'));
    button(host, 'Save version').click();
    await settle(fixture);
    expect(service().record()?.versions.at(-1)?.note).toBe('Added always.');
    expect(note.value).toBe('');
  });

  it('sets the interval and shows the next review date; off by default', async () => {
    const { fixture, host } = await setUp(record());
    const toggles = [...host.querySelectorAll('app-mission-review mat-button-toggle')];
    expect(toggles.map((toggle) => toggle.textContent?.trim())).toEqual([
      'Month',
      '3 months',
      'Year',
      'Off',
    ]);
    expect(host.querySelector('app-mission-review .review-date')).toBeNull();

    toggles[2].querySelector('button')!.click();
    await settle(fixture);
    expect(service().record()?.review).toEqual({ interval: 'yearly', nextAt: '2027-08-20' });
    expect(host.querySelector('app-mission-review .review-date')?.textContent).toContain(
      'Next review:',
    );
    expect(host.querySelector('.due-banner')).toBeNull();
  });

  it('shows the due banner when the date has come, and "Reviewed today" clears it', async () => {
    const { fixture, host } = await setUp(record({ review: { interval: 'monthly' } }));
    const banner = host.querySelector('.due-banner');
    expect(banner?.textContent).toContain('Time to reread your mission');

    button(banner as HTMLElement, 'Reviewed today').click();
    await settle(fixture);
    expect(service().record()?.review?.lastReviewedAt).toBe('2026-09-26');
    expect(host.querySelector('.due-banner')).toBeNull();
    expect(document.activeElement?.id).toBe('mission-review-title');
  });
});
