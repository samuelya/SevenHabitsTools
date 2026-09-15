import { TestBed } from '@angular/core/testing';
import { LOCAL_STORAGE } from '../../browser/local-storage';
import { FakeLocalStorage } from '../multi-tab/multi-tab.fakes';
import { CLOCK } from '../../time/clock';
import { ExportReminderDismissal } from './export-reminder-dismissal';

function setUp(options: { now?: string; storage?: FakeLocalStorage } = {}) {
  const storage = options.storage ?? new FakeLocalStorage();
  // Lets a single test call setUp() more than once, to simulate a fresh instance (e.g. after a
  // reload) reading the same underlying storage: TestBed only allows one configureTestingModule()
  // per already-instantiated module.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: LOCAL_STORAGE, useValue: storage },
      {
        provide: CLOCK,
        useValue: { now: () => new Date(options.now ?? '2026-01-01T12:00:00.000Z') },
      },
    ],
  });
  return { dismissal: TestBed.inject(ExportReminderDismissal), storage };
}

describe('ExportReminderDismissal', () => {
  it('starts not dismissed', () => {
    expect(setUp().dismissal.dismissed()).toBe(false);
  });

  it('dismiss() sets dismissed to true for the rest of the day', () => {
    const { dismissal } = setUp();

    dismissal.dismiss();

    expect(dismissal.dismissed()).toBe(true);
  });

  it('#153: a fresh instance (e.g. after a reload) still sees the dismissal, reading it from storage', () => {
    const storage = new FakeLocalStorage();
    setUp({ storage }).dismissal.dismiss();

    const { dismissal: afterReload } = setUp({ storage });

    expect(afterReload.dismissed()).toBe(true);
  });

  it('is no longer dismissed once the day has moved on', () => {
    const storage = new FakeLocalStorage();
    setUp({ now: '2026-01-01T12:00:00.000Z', storage }).dismissal.dismiss();

    const { dismissal: nextDay } = setUp({ now: '2026-01-02T12:00:00.000Z', storage });

    expect(nextDay.dismissed()).toBe(false);
  });
});
