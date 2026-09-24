import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import '../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { PcBalanceAuditForm } from './pc-balance-audit-form';
import { PcAsset, PcAudit, PcAuditFields } from './pc-balance.model';

/** Issue #223: suggested chips, Enter to add, the legend, the status gloss, the summary card only
 * once an asset exists, and removing an asset. */

const BUILT_IN_LABELS = {
  sleep: 'Sleep',
  exercise: 'Exercise',
  savings: 'Savings',
  incomeSkills: 'Income skills',
  partner: 'Partner',
  team: 'Team',
};

function asset(overrides: Partial<PcAsset> = {}): PcAsset {
  return { key: 'u1', name: 'My back', group: 'physical', p: 3, pc: 3, ...overrides };
}

function audit(overrides: Partial<PcAudit> = {}): PcAudit {
  return {
    id: 'a1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    date: '2026-01-01',
    assets: [],
    reflection: '',
    ...overrides,
  };
}

interface Harness {
  readonly fixture: ComponentFixture<PcBalanceAuditForm>;
  readonly host: HTMLElement;
  readonly emitted: Partial<PcAuditFields>[];
  readonly removeRequests: string[];
}

function setUp(initial: PcAudit): Harness {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-pc-balance')],
  });
  const fixture = TestBed.createComponent(PcBalanceAuditForm);
  fixture.componentRef.setInput('audit', initial);
  fixture.componentRef.setInput('builtInLabels', BUILT_IN_LABELS);
  fixture.detectChanges();
  const emitted: Partial<PcAuditFields>[] = [];
  const removeRequests: string[] = [];
  fixture.componentInstance.changed.subscribe((event) => emitted.push(event));
  fixture.componentInstance.assetRemoveRequested.subscribe((key) => removeRequests.push(key));
  return { fixture, host: fixture.nativeElement as HTMLElement, emitted, removeRequests };
}

function chipLabels(host: HTMLElement): string[] {
  return [...host.querySelectorAll('.suggested-chip__label')].map((chip) =>
    chip.textContent!.trim(),
  );
}

function typeName(harness: Harness, groupIndex: number, name: string): HTMLInputElement {
  const input = harness.host.querySelectorAll<HTMLInputElement>('.add-asset-row input')[groupIndex];
  input.value = name;
  input.dispatchEvent(new Event('input'));
  harness.fixture.detectChanges();
  return input;
}

function pressEnter(input: HTMLInputElement): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
  input.dispatchEvent(event);
  return event;
}

describe('PcBalanceAuditForm (#223)', () => {
  it('renders no summary card until an asset exists, then only the groups holding one', () => {
    const empty = setUp(audit());
    expect(empty.host.querySelector('.group-summary')).toBeNull();
    expect(empty.host.textContent).not.toContain('No assets yet');

    empty.fixture.componentRef.setInput(
      'audit',
      audit({ assets: [asset({ key: 'savings', name: '', group: 'financial' })] }),
    );
    empty.fixture.detectChanges();

    const rows = empty.host.querySelectorAll('.group-summary__item');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Financial');
  });

  it('starts every group with its two suggested chips, named for screen readers', () => {
    const { host } = setUp(audit());
    expect(chipLabels(host)).toEqual([
      'Sleep',
      'Exercise',
      'Savings',
      'Income skills',
      'Partner',
      'Team',
    ]);
    expect(host.querySelector('.suggested-chip')?.getAttribute('aria-label')).toBe('Add Sleep');
    expect(host.querySelector('.suggested-assets')?.getAttribute('aria-label')).toBe(
      'Suggestions: Physical',
    );
  });

  it('a chip adds its asset with the built-in key, and the chip goes', () => {
    const harness = setUp(audit());
    (harness.host.querySelectorAll('.suggested-chip')[3] as HTMLButtonElement).click();

    expect(harness.emitted).toEqual([
      { assets: [{ key: 'incomeSkills', name: '', group: 'financial', p: 3, pc: 3 }] },
    ]);
    harness.fixture.detectChanges();
    expect(chipLabels(harness.host)).not.toContain('Income skills');
    expect(
      harness.host.querySelector('[data-asset-key="incomeSkills"] .asset-title')?.textContent,
    ).toContain('Income skills');
  });

  it('Enter in the field adds the typed asset; a built-in label adds the built-in', () => {
    const harness = setUp(audit());
    const event = pressEnter(typeName(harness, 2, 'My friendship with Sam'));
    expect(event.defaultPrevented).toBe(true);
    expect(harness.emitted[0].assets![0]).toMatchObject({
      name: 'My friendship with Sam',
      group: 'human',
    });

    pressEnter(typeName(harness, 0, 'sleep'));
    expect(harness.emitted[1].assets![1]).toEqual({
      key: 'sleep',
      name: '',
      group: 'physical',
      p: 3,
      pc: 3,
    });
  });

  it('keeps the typed name until its asset is stored', () => {
    const harness = setUp(audit());
    const input = typeName(harness, 0, 'My back');
    pressEnter(input);
    harness.fixture.detectChanges();
    expect(input.value).toBe('My back');

    harness.fixture.componentRef.setInput('audit', audit({ assets: harness.emitted[0].assets }));
    harness.fixture.detectChanges();
    harness.fixture.detectChanges();
    expect(input.value).toBe('');
  });

  it('refuses a name already in the audit with an inline error, keeping the text', () => {
    const harness = setUp(audit({ assets: [asset({ key: 'sleep', name: '' })] }));
    const input = typeName(harness, 0, 'Sleep');
    pressEnter(input);
    harness.fixture.detectChanges();

    expect(harness.emitted).toEqual([]);
    expect(input.value).toBe('Sleep');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(harness.host.querySelector('#duplicate-physical')?.textContent).toContain(
      "You've already added that one.",
    );

    typeName(harness, 0, 'Sleep more');
    expect(harness.host.querySelector('#duplicate-physical')).toBeNull();
  });

  it('shows the legend once, above the first asset of the audit', () => {
    const empty = setUp(audit());
    expect(empty.host.querySelector('.rating-legend')).toBeNull();

    empty.fixture.componentRef.setInput(
      'audit',
      audit({
        assets: [
          asset({ key: 'team', name: '', group: 'human' }),
          asset({ key: 'savings', name: '', group: 'financial' }),
        ],
      }),
    );
    empty.fixture.detectChanges();

    const legends = empty.host.querySelectorAll('.rating-legend');
    expect(legends).toHaveLength(1);
    expect(legends[0].textContent?.trim()).toBe(
      'Getting out: how much you rely on it now · Putting in: how much you look after it',
    );
    expect(legends[0].nextElementSibling?.getAttribute('data-asset-key')).toBe('savings');
  });

  it('shows each status with a plain gloss on its first appearance only', () => {
    const { host } = setUp(
      audit({
        assets: [
          asset({ key: 'a', p: 5, pc: 1 }),
          asset({ key: 'b', name: 'Knees', p: 5, pc: 2 }),
          asset({ key: 'c', name: 'Car', group: 'financial', p: 3, pc: 3 }),
        ],
      }),
    );
    const indicator = (key: string) =>
      host.querySelector(`[data-asset-key="${key}"] .balance-indicator`)!;

    expect(indicator('a').textContent).toContain('Over-used (4)');
    expect(indicator('a').querySelector('.balance-gloss')?.textContent).toBe(
      'you get a lot out of it and put little back.',
    );
    expect(indicator('b').textContent).toContain('Over-used (3)');
    expect(indicator('b').querySelector('.balance-gloss')).toBeNull();
    expect(indicator('c').querySelector('.balance-gloss')?.textContent).toContain('about even');
  });

  it('asks how to look after an over-used asset above a labelled field it describes (#228)', () => {
    const { host } = setUp(audit({ assets: [asset({ p: 5, pc: 1 })] }));
    const prompt = host.querySelector('.action-prompt') as HTMLElement;
    expect(prompt.textContent?.trim()).toBe("What's one thing you'll do to look after it?");
    const field = host.querySelector('.asset-action textarea') as HTMLTextAreaElement;
    expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(prompt.id);
    expect(host.querySelector('.asset-action mat-label')?.textContent?.trim()).toBe(
      "How you'll look after it",
    );
  });

  it('asks the page to confirm removing an asset holding a rating or a typed name; removes an untouched suggested one', () => {
    const harness = setUp(
      audit({
        assets: [
          asset({ key: 'a', p: 4 }),
          asset({ key: 'b', name: 'Knees' }),
          asset({ key: 'sleep', name: '' }),
        ],
      }),
    );
    const removeButtons = () => harness.host.querySelectorAll<HTMLButtonElement>('.remove-asset');

    removeButtons()[0].click();
    removeButtons()[1].click();
    expect(harness.removeRequests).toEqual(['a', 'b']);
    expect(harness.emitted).toEqual([]);

    removeButtons()[2].click();
    expect(harness.emitted).toEqual([
      { assets: [asset({ key: 'a', p: 4 }), asset({ key: 'b', name: 'Knees' })] },
    ]);
  });

  describe('focus after a removal (F1)', () => {
    const rated = (key: string, name: string) => asset({ key, name, p: 5, pc: 1 });
    const addField = (harness: Harness) =>
      harness.host.querySelector<HTMLInputElement>('[data-add-group="physical"] input');

    async function requestRemoval(harness: Harness): Promise<void> {
      harness.host.querySelector<HTMLButtonElement>('.remove-asset')!.click();
      harness.fixture.detectChanges();
      await harness.fixture.whenStable();
    }

    async function settle(harness: Harness, next: PcAudit): Promise<void> {
      harness.fixture.componentRef.setInput('audit', next);
      harness.fixture.detectChanges();
      await harness.fixture.whenStable();
      harness.fixture.detectChanges();
    }

    it('moves focus to the add field once the confirmed asset has gone', async () => {
      const harness = setUp(audit({ assets: [rated('a', 'A'), rated('b', 'B')] }));
      await requestRemoval(harness);

      await settle(harness, audit({ assets: [rated('b', 'B')] }));

      expect(document.activeElement).toBe(addField(harness));
    });

    it('leaves focus alone after a Cancel, when the asset goes later for another reason', async () => {
      const harness = setUp(audit({ assets: [rated('a', 'A'), rated('b', 'B')] }));
      await requestRemoval(harness);
      harness.fixture.componentInstance.cancelAssetRemoval('a');

      await settle(harness, audit({ assets: [rated('b', 'B')] }));

      expect(document.activeElement).not.toBe(addField(harness));
    });

    it('leaves focus alone after a refused removal', async () => {
      const harness = setUp(audit({ assets: [rated('a', 'A'), rated('b', 'B')] }));
      await requestRemoval(harness);
      harness.fixture.componentRef.setInput('refusedEdits', 1);
      harness.fixture.detectChanges();
      await harness.fixture.whenStable();

      await settle(harness, audit({ assets: [rated('b', 'B')] }));

      expect(document.activeElement).not.toBe(addField(harness));
    });

    it('leaves focus alone when another audit opens without that asset', async () => {
      const harness = setUp(audit({ assets: [rated('a', 'A'), rated('b', 'B')] }));
      await requestRemoval(harness);

      await settle(harness, audit({ id: 'a2', assets: [rated('c', 'C')] }));

      expect(document.activeElement).not.toBe(addField(harness));
    });
  });

  it('offers no Remove on the only asset: an audit keeps at least one', () => {
    const { host } = setUp(audit({ assets: [asset()] }));
    expect(host.querySelector('.remove-asset')).toBeNull();
  });

  it('after a refused edit shows the stored assets again', () => {
    const harness = setUp(audit({ assets: [asset({ key: 'a' }), asset({ key: 'b', name: 'X' })] }));
    (harness.host.querySelectorAll('.suggested-chip')[0] as HTMLButtonElement).click();
    harness.fixture.detectChanges();
    expect(harness.host.querySelectorAll('.asset-row')).toHaveLength(3);

    harness.fixture.componentRef.setInput('refusedEdits', 1);
    harness.fixture.detectChanges();
    expect(harness.host.querySelectorAll('.asset-row')).toHaveLength(2);
  });
});
