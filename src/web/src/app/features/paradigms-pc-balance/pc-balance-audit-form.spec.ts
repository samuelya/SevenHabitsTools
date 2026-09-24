import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import '../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { PcBalanceAuditForm } from './pc-balance-audit-form';
import { PcAsset, PcAudit } from './pc-balance.model';

function asset(overrides: Partial<PcAsset> = {}): PcAsset {
  return { key: 'k1', name: 'Sleep', group: 'physical', p: 3, pc: 3, ...overrides };
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

const BUILT_IN_LABELS = {
  sleep: 'Sleep',
  exercise: 'Exercise',
  savings: 'Savings',
  incomeSkills: 'Income skills',
  partner: 'Partner',
  team: 'Team',
};

function setUp(initial: PcAudit) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-pc-balance')],
  });
  const fixture = TestBed.createComponent(PcBalanceAuditForm);
  fixture.componentRef.setInput('audit', initial);
  fixture.componentRef.setInput('builtInLabels', BUILT_IN_LABELS);
  fixture.detectChanges();
  return fixture;
}

describe('PcBalanceAuditForm', () => {
  it('shows the audit date in an editable date field (issue #226)', () => {
    const fixture = setUp(audit());
    const input = fixture.nativeElement.querySelector(
      'app-assessment-date-field input',
    ) as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe(audit().date);
  });

  it('emits a date edit through `changed` (issue #226)', () => {
    const fixture = setUp(audit());
    const changes: unknown[] = [];
    fixture.componentInstance.changed.subscribe((change) => changes.push(change));
    const input = fixture.nativeElement.querySelector(
      'app-assessment-date-field input',
    ) as HTMLInputElement;

    input.value = '2025-12-31';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));

    expect(changes).toEqual([{ date: '2025-12-31' }]);
  });

  it('renders one asset row per live asset, grouped', () => {
    const fixture = setUp(
      audit({
        assets: [
          asset({ key: 'k1', group: 'physical', name: 'Sleep' }),
          asset({ key: 'k2', group: 'financial', name: 'Savings' }),
        ],
      }),
    );
    const rows = fixture.nativeElement.querySelectorAll('.asset-row');
    expect(rows).toHaveLength(2);
  });

  it('adds a typed asset to the given group', () => {
    const fixture = setUp(audit());
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));
    const host = fixture.nativeElement as HTMLElement;

    const nameInput = host.querySelector('.add-asset-row input[type="text"]') as HTMLInputElement;
    nameInput.value = 'My back';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (host.querySelector('.add-asset-row button') as HTMLButtonElement).click();

    expect(emitted).toHaveLength(1);
    const assets = (emitted[0] as { assets: PcAsset[] }).assets;
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ name: 'My back', group: 'physical', p: 3, pc: 3 });
  });

  it('does not add an asset with a blank name', () => {
    const fixture = setUp(audit());
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));

    (fixture.nativeElement.querySelector('.add-asset-row button') as HTMLButtonElement).click();

    expect(emitted).toHaveLength(0);
  });

  it('gives every free-text field an example placeholder, per group for asset names (#230)', () => {
    const fixture = setUp(audit({ assets: [asset({ p: 5, pc: 1, name: '' })] }));
    const element = fixture.nativeElement as HTMLElement;
    const placeholders = (selector: string) =>
      [...element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(selector)].map(
        (field) => field.placeholder,
      );

    expect(placeholders('.asset-row .asset-name input')).toEqual(['e.g. My back']);
    expect(placeholders('.add-asset-row input')).toEqual([
      'e.g. My back',
      'e.g. My savings',
      'e.g. My friendship with Sam',
    ]);
    expect(placeholders('.asset-action textarea')).toEqual([
      'e.g. A 20-minute walk before work, three days a week.',
    ]);
    expect(placeholders('app-reflection-editor textarea')[0]).toContain('e.g. ');

    // Each add-asset field and the notes field is described by the question above it (#228).
    const promptsOf = (selector: string) =>
      [...element.querySelectorAll(selector)].map((field) =>
        (field.getAttribute('aria-describedby') ?? '')
          .split(' ')
          .map((id) => element.querySelector(`#${id}.field-prompt`)?.textContent?.trim())
          .find(Boolean),
      );
    expect(promptsOf('.add-asset-row input')).toEqual(
      Array(3).fill('What else here do you count on?'),
    );
    expect(promptsOf('app-reflection-editor textarea')).toEqual([
      'What stands out when you look at the whole picture?',
    ]);
  });

  it('shows the balance indicator and hides the action field while not over-used', () => {
    const fixture = setUp(audit({ assets: [asset({ p: 3, pc: 3 })] }));
    const row = fixture.nativeElement.querySelector('.asset-row') as HTMLElement;
    expect(row.querySelector('.balance-indicator')?.textContent).toContain('0');
    expect(row.querySelector('.asset-action')).toBeNull();
  });

  it('requires an action once the asset is over-used, shown after the field is touched', () => {
    const fixture = setUp(audit({ assets: [asset({ p: 5, pc: 1 })] }));
    const row = fixture.nativeElement.querySelector('.asset-row') as HTMLElement;
    const textarea = row.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(row.querySelector('.field-error')).toBeNull();

    textarea.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(row.querySelector('.field-error')).not.toBeNull();
  });

  it('emits the edited action for the matching asset', () => {
    const fixture = setUp(audit({ assets: [asset({ key: 'k1', p: 5, pc: 1 })] }));
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'Sleep by 10pm';
    textarea.dispatchEvent(new Event('input'));

    const assets = (emitted[0] as { assets: PcAsset[] }).assets;
    expect(assets[0].action).toBe('Sleep by 10pm');
  });

  it('removes an untouched suggested asset at once', () => {
    const fixture = setUp(
      audit({ assets: [asset({ key: 'sleep', name: '' }), asset({ key: 'k2', name: 'other' })] }),
    );
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));

    (fixture.nativeElement.querySelector('.remove-asset') as HTMLButtonElement).click();

    const assets = (emitted[0] as { assets: PcAsset[] }).assets;
    expect(assets).toHaveLength(1);
    expect(assets[0].key).toBe('k2');
  });

  it('emits the edited reflection with its audit id', () => {
    const fixture = setUp(audit());
    const emitted: unknown[] = [];
    fixture.componentInstance.reflectionChanged.subscribe((event) => emitted.push(event));

    fixture.componentInstance['onReflectionChanged']('a1', 'Noticing a pattern.');

    expect(emitted).toEqual([{ auditId: 'a1', reflection: 'Noticing a pattern.' }]);
  });

  it('shows no reflection status until the first keystroke, then the reported outcome (#215)', () => {
    const fixture = setUp(audit({ reflection: 'An older reflection.' }));
    const host = fixture.nativeElement as HTMLElement;
    const status = () => host.querySelector('app-reflection-editor .status')?.textContent?.trim();

    expect(status()).toBe('');
    expect(host.querySelector('app-reflection-editor .hint')).toBeNull();

    const textarea = host.querySelector('app-reflection-editor textarea') as HTMLTextAreaElement;
    textarea.value = 'A new reflection.';
    textarea.dispatchEvent(new Event('input'));
    fixture.componentInstance.reportReflectionSaveOutcome('a1', true);
    fixture.detectChanges();

    expect(status()).toBe('Saved');
  });

  it("switching audits flushes a pending reflection under the old audit's id and drops its status", () => {
    vi.useFakeTimers();
    try {
      const fixture = setUp(audit({ id: 'a1' }));
      const host = fixture.nativeElement as HTMLElement;
      const status = () => host.querySelector('app-reflection-editor .status')?.textContent?.trim();
      const emitted: unknown[] = [];
      fixture.componentInstance.reflectionChanged.subscribe((event) => emitted.push(event));

      const textarea = host.querySelector('app-reflection-editor textarea') as HTMLTextAreaElement;
      textarea.value = 'Typed into a1.';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(status()).not.toBe('');

      fixture.componentRef.setInput('audit', audit({ id: 'a2', reflection: 'Kept for a2.' }));
      fixture.detectChanges();

      expect(emitted).toEqual([{ auditId: 'a1', reflection: 'Typed into a1.' }]);
      expect(status()).toBe('');
      expect(
        (host.querySelector('app-reflection-editor textarea') as HTMLTextAreaElement).value,
      ).toBe('Kept for a2.');

      fixture.componentInstance.reportReflectionSaveOutcome('a1', true);
      fixture.detectChanges();
      expect(status()).toBe('');

      vi.advanceTimersByTime(2000);
      expect(emitted).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets touched state when a different audit is bound', () => {
    const fixture = setUp(audit({ id: 'a1', assets: [asset({ key: 'k1', p: 5, pc: 1 })] }));
    (fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement).dispatchEvent(
      new Event('blur'),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.field-error')).not.toBeNull();

    fixture.componentRef.setInput(
      'audit',
      audit({ id: 'a2', assets: [asset({ key: 'k2', p: 5, pc: 1 })] }),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.field-error')).toBeNull();
  });
});
