import { DebugElement, EventEmitter, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSliderThumb } from '@angular/material/slider';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { PcBalancePage } from './pc-balance-page';
import { PC_BALANCE_MODEL_KEY, PcAudit } from './pc-balance.model';
import {
  ConfirmAndDeleteOptions,
  DeleteWithUndo,
} from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import pcBalanceRoutes from './pc-balance.routes';
import { PC_BALANCE_ROUTE, registerPcBalanceModel } from './pc-balance.model';

const LIST_URL = `/${PC_BALANCE_ROUTE}`;

function testRoutes(): Routes {
  return [{ path: PC_BALANCE_ROUTE, children: pcBalanceRoutes }];
}

/** Same shape as `paradigms-transition/transition-page.spec.ts`'s own fake — see its doc comment
 * for why the real `DeleteWithUndo` isn't used directly in a page spec. */
function fakeDeleteWithUndo(): {
  confirmAndDelete: ReturnType<typeof vi.fn>;
  calls: ConfirmAndDeleteOptions[];
} {
  const calls: ConfirmAndDeleteOptions[] = [];
  const confirmAndDelete = vi.fn(async (options: ConfirmAndDeleteOptions) => {
    calls.push(options);
  });
  return { confirmAndDelete, calls };
}

async function setUp(
  now = '2026-01-01T00:00:00.000Z',
  deleteWithUndo: ReturnType<typeof fakeDeleteWithUndo> = fakeDeleteWithUndo(),
): Promise<RouterTestingHarness> {
  // Vitest here runs with `isolate: false` (shared module state) — see `exercise-kit.model.spec.ts`.
  registerExerciseKitModel();
  registerPcBalanceModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(testRoutes(), withComponentInputBinding()),
      { provide: CLOCK, useValue: { now: () => new Date(now) } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: DeleteWithUndo, useValue: deleteWithUndo },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

async function addAudit(harness: RouterTestingHarness): Promise<void> {
  const host = harness.routeNativeElement as HTMLElement;
  (host.querySelector('.add-button') as HTMLButtonElement).click();
  await harness.fixture.whenStable();
}

/**
 * Adds an asset through the form and sets its P/PC sliders. `MatSlider`'s own pointer-drag
 * mechanics depend on real layout (`getBoundingClientRect`), which jsdom always reports as zero,
 * so driving a `mat-slider` the way a real user would (setting the native input's `.value` and
 * dispatching `input`) silently no-ops here — a jsdom limitation in Material's own component, not
 * this feature's code. Instead this emits directly on the `MatSliderThumb` directive's own
 * `valueChange` output, exactly what it emits internally in response to a real interaction —
 * exercising this page's own wiring of that output without depending on Material's pointer-based
 * internals, which are that library's concern to test, not this feature's.
 */
function setAssetSliders(
  harness: RouterTestingHarness,
  assetIndex: number,
  p: number,
  pc: number,
): void {
  const thumbs = harness.routeDebugElement!.queryAll(By.directive(MatSliderThumb));
  const pThumb = thumbs[assetIndex * 2].injector.get(MatSliderThumb);
  (pThumb.valueChange as EventEmitter<number>).emit(p);
  harness.detectChanges();
  const pcThumb = thumbs[assetIndex * 2 + 1].injector.get(MatSliderThumb);
  (pcThumb.valueChange as EventEmitter<number>).emit(pc);
  harness.detectChanges();
}

/** Adds an asset (always to the physical group's add row, the first on the page) with the given
 * P/PC. `assetIndex` is the asset's position among those already added through this helper, for
 * `setAssetSliders` to target the right pair of thumbs. */
function addAssetThroughForm(
  harness: RouterTestingHarness,
  assetIndex: number,
  name: string,
  p: number,
  pc: number,
): void {
  const host = harness.routeNativeElement as HTMLElement;
  const nameInput = host.querySelector('.add-asset-row input[type="text"]') as HTMLInputElement;
  nameInput.value = name;
  nameInput.dispatchEvent(new Event('input'));
  harness.detectChanges();
  (host.querySelector('.add-asset-row button') as HTMLButtonElement).click();
  harness.detectChanges();
  setAssetSliders(harness, assetIndex, p, pc);
}

describe('PcBalancePage', () => {
  it('renders the prompt card title', async () => {
    const harness = await setUp();
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain(
      'Audit your results and capacity',
    );
  });

  it('glosses "over-used" inline under the prompt on first use (#218)', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;

    expect(host.querySelector('.prompt')?.textContent).toContain('over-used');
    expect(host.querySelector('.prompt-gloss')?.textContent?.trim()).toBe(
      'Over-used: you get a lot out of it and put little back.',
    );
  });

  it('shows no summary card and the gate checklist until the first item exists (#215)', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;

    expect(host.querySelector('app-pc-balance-summary')).toBeNull();
    expect(host.querySelector('app-done-toggle .done-checklist')?.textContent).toContain(
      'Add an asset and name every one',
    );

    await addAudit(harness);
    harness.detectChanges();

    expect(host.querySelector('app-pc-balance-summary')).not.toBeNull();
  });

  it('starts with no history and Mark done disabled', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;
    expect(host.querySelectorAll('app-assessment-history-list button')).toHaveLength(0);
    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(true);
  });

  it('creating a new audit navigates to its child route and opens the editor', async () => {
    const harness = await setUp();
    await addAudit(harness);

    expect(TestBed.inject(Router).url).toMatch(new RegExp(`^${LIST_URL}/[^/]+$`));
    expect(
      (harness.routeNativeElement as HTMLElement).querySelector('app-pc-balance-audit-form'),
    ).not.toBeNull();
  });

  it('enables Mark done once every asset is complete, and disables it again for a new unresolved over-used one', async () => {
    const harness = await setUp();
    await addAudit(harness);
    addAssetThroughForm(harness, 0, 'Sleep', 3, 3);
    const host = harness.routeNativeElement as HTMLElement;

    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(false);

    // Adding a second, over-used asset with no action yet disables Mark done again: the audit
    // needs *every* over-used asset to have an action, not just one complete asset overall.
    addAssetThroughForm(harness, 1, 'Savings', 5, 1);
    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(true);
    expect(host.querySelector('.asset-action')).not.toBeNull();
  });

  it('requires a maintenance action before Mark done once every asset is over-used', async () => {
    const harness = await setUp();
    await addAudit(harness);
    addAssetThroughForm(harness, 0, 'Savings', 5, 1);
    const host = harness.routeNativeElement as HTMLElement;

    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(true);

    const textarea = host.querySelector('.asset-action textarea') as HTMLTextAreaElement;
    textarea.value = 'Automate a weekly transfer';
    textarea.dispatchEvent(new Event('input'));
    harness.detectChanges();

    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(false);
  });

  it('marks done and reopens through DoneToggle', async () => {
    const harness = await setUp();
    await addAudit(harness);
    addAssetThroughForm(harness, 0, 'Sleep', 3, 3);
    const host = harness.routeNativeElement as HTMLElement;

    (host.querySelector('app-done-toggle button') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Reopen');

    (host.querySelector('app-done-toggle button') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Mark done');
  });

  it('redirects to the history when :itemId is not a live audit', async () => {
    const harness = await setUp();
    await harness.navigateByUrl(`${LIST_URL}/not-a-real-id`);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-pc-balance-audit-form')).toBeNull();
  });

  it('pre-fills a new audit from the latest, with sliders reset to 3', async () => {
    const harness = await setUp();
    await addAudit(harness);
    addAssetThroughForm(harness, 0, 'Sleep', 5, 1); // over-used
    await harness.navigateByUrl(LIST_URL);
    expect(
      harness.routeNativeElement?.querySelectorAll(
        'app-assessment-history-list mat-nav-list .assessment-history-list__item',
      ),
    ).toHaveLength(1);

    // A second audit, in the same session — pre-filled from the only existing audit.
    await addAudit(harness);
    const host = harness.routeNativeElement as HTMLElement;
    expect(host.querySelectorAll('.asset-row')).toHaveLength(1);
    expect((host.querySelector('.asset-row input[type="text"]') as HTMLInputElement).value).toBe(
      'Sleep',
    );
    // Sliders reset to 3 (balanced), not carried over at 5/1 — no action field needed.
    expect(host.querySelector('.asset-action')).toBeNull();
  });

  it('deleting an audit asks DeleteWithUndo to confirm, then removes it and closes the editor', async () => {
    const deleteWithUndo = fakeDeleteWithUndo();
    const harness = await setUp(undefined, deleteWithUndo);
    await addAudit(harness);
    const host = harness.routeNativeElement as HTMLElement;

    (host.querySelector('.assessment-history-list__delete') as HTMLButtonElement).click();

    expect(deleteWithUndo.calls).toHaveLength(1);
    expect(deleteWithUndo.calls[0].deletedMessage).toBe('Audit deleted');

    deleteWithUndo.calls[0].onConfirm();
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-pc-balance-audit-form')).toBeNull();
    expect(
      harness.routeNativeElement?.querySelectorAll('.assessment-history-list__item'),
    ).toHaveLength(0);
  });

  it('restores the deleted audit when DeleteWithUndo reports Undo', async () => {
    const deleteWithUndo = fakeDeleteWithUndo();
    const harness = await setUp(undefined, deleteWithUndo);
    await addAudit(harness);
    (
      (harness.routeNativeElement as HTMLElement).querySelector(
        '.assessment-history-list__delete',
      ) as HTMLButtonElement
    ).click();
    deleteWithUndo.calls[0].onConfirm();
    harness.detectChanges();
    await harness.fixture.whenStable();

    deleteWithUndo.calls[0].onUndo();
    harness.detectChanges();
    await harness.navigateByUrl(LIST_URL);

    expect(
      harness.routeNativeElement?.querySelectorAll('.assessment-history-list__item'),
    ).toHaveLength(1);
  });
});

describe('PcBalancePage intro card (issue #216)', () => {
  function promptCardIn(debugElement: DebugElement): ExercisePromptCard {
    return debugElement.query(By.directive(ExercisePromptCard)).componentInstance;
  }

  it('starts expanded on a first visit, before anything is saved (desktop)', async () => {
    const harness = await setUp();
    expect(promptCardIn(harness.fixture.debugElement).expanded()).toBe(true);
  });

  it('starts collapsed on a later visit once a live audit exists (desktop)', async () => {
    await setUp();
    TestBed.runInInjectionContext(() =>
      featureStore<PcAudit[]>(PC_BALANCE_MODEL_KEY).update((current) => [
        ...current,
        newRecord(
          { date: '2026-01-01', assets: [], reflection: '' } as const,
          new Date('2026-01-01T00:00:00.000Z'),
        ),
      ]),
    );

    const fixture = TestBed.createComponent(PcBalancePage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(promptCardIn(fixture.debugElement).expanded()).toBe(false);
  });
});
