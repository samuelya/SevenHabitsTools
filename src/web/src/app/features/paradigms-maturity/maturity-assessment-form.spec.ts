import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { MaturityAssessmentForm } from './maturity-assessment-form';
import { MaturityArea, MaturityAssessment } from './maturity.model';

const LABELS = {
  work: 'Work',
  family: 'Family',
  money: 'Money',
  health: 'Health',
  learning: 'Learning',
  community: 'Community',
  friendships: 'Friendships',
};

function area(overrides: Partial<MaturityArea> = {}): MaturityArea {
  return { id: 'ar1', key: 'work', ...overrides };
}

function assessment(overrides: Partial<MaturityAssessment> = {}): MaturityAssessment {
  return {
    id: 'a1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    date: '2026-01-01',
    areas: [],
    ...overrides,
  };
}

interface Setup {
  readonly fixture: ComponentFixture<MaturityAssessmentForm>;
  readonly host: HTMLElement;
  /** Every `areas` value emitted, latest last. */
  readonly emitted: MaturityArea[][];
}

/** Mounts the form and, like the page, feeds each emitted change back in as the new value. */
function setUp(
  initial: MaturityAssessment,
  options: { handset?: boolean; isNew?: boolean } = {},
): Setup {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-maturity')],
  });
  const fixture = TestBed.createComponent(MaturityAssessmentForm);
  const emitted: MaturityArea[][] = [];
  let current = initial;
  fixture.componentRef.setInput('assessment', current);
  fixture.componentRef.setInput('builtInLabels', LABELS);
  fixture.componentRef.setInput('handset', options.handset ?? false);
  fixture.componentRef.setInput('isNew', options.isNew ?? false);
  fixture.componentInstance.changed.subscribe((fields) => {
    if (fields.areas) {
      emitted.push([...fields.areas]);
      current = { ...current, areas: fields.areas };
      fixture.componentRef.setInput('assessment', current);
    }
  });
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement, emitted };
}

function chips(host: HTMLElement): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('.area-chip'));
}

function chipLabel(button: HTMLButtonElement): string | undefined {
  return button.querySelector('.area-chip-label')?.textContent?.trim();
}

function chip(host: HTMLElement, label: string): HTMLButtonElement {
  const found = chips(host).find((button) => chipLabel(button) === label);
  if (!found) {
    throw new Error(`No chip "${label}"`);
  }
  return found;
}

function click(setup: Setup, selector: string): void {
  (setup.host.querySelector(selector) as HTMLElement).click();
  setup.fixture.detectChanges();
}

describe('MaturityAssessmentForm, phase 1: areas (#222)', () => {
  it('opens a new draft on the area chips: the six suggested areas, none pressed', () => {
    const { host } = setUp(assessment(), { isNew: true });

    expect(host.querySelector('.phase-title')?.textContent?.trim()).toBe(
      'Which areas do you want to rate?',
    );
    expect(chips(host).map(chipLabel)).toEqual([
      'Work',
      'Family',
      'Health',
      'Money',
      'Friendships',
      'Learning',
    ]);
    expect(chips(host).every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(
      true,
    );
  });

  it('adds an area when a chip is chosen and removes it when chosen again', () => {
    const setup = setUp(assessment(), { isNew: true });

    chip(setup.host, 'Family').click();
    setup.fixture.detectChanges();
    expect(setup.emitted.at(-1)?.map((a) => a.key)).toEqual(['family']);
    expect(chip(setup.host, 'Family').getAttribute('aria-pressed')).toBe('true');

    chip(setup.host, 'Family').click();
    setup.fixture.detectChanges();
    expect(setup.emitted.at(-1)).toEqual([]);
    expect(chip(setup.host, 'Family').getAttribute('aria-pressed')).toBe('false');
  });

  it('stays on the chips after the first chip, even once the draft is no longer new', () => {
    const setup = setUp(assessment(), { isNew: true });
    chip(setup.host, 'Work').click();
    setup.fixture.componentRef.setInput('isNew', false);
    setup.fixture.detectChanges();

    expect(setup.host.querySelector('.areas-phase')).not.toBeNull();
    expect(setup.host.querySelector('.rate-phase')).toBeNull();
  });

  it('adds a custom area from "Add your own" and clears the field', () => {
    const setup = setUp(assessment(), { isNew: true });
    const input = setup.host.querySelector('.custom-area input') as HTMLInputElement;
    input.value = '  Volunteering ';
    input.dispatchEvent(new Event('input'));
    (setup.host.querySelector('.custom-area') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    setup.fixture.detectChanges();

    expect(setup.emitted.at(-1)).toEqual([expect.objectContaining({ name: 'Volunteering' })]);
    expect(setup.emitted.at(-1)?.[0].key).toBeUndefined();
    expect(input.value).toBe('');
    expect(chip(setup.host, 'Volunteering').getAttribute('aria-pressed')).toBe('true');
  });

  it('adds nothing for a blank custom name', () => {
    const setup = setUp(assessment(), { isNew: true });
    click(setup, '.add-custom-area');
    expect(setup.emitted).toHaveLength(0);
  });

  it('needs at least one area to continue: Continue stays focusable, says why and does nothing', () => {
    const setup = setUp(assessment(), { isNew: true });
    const continueButton = setup.host.querySelector('.continue-button') as HTMLButtonElement;

    expect(continueButton.getAttribute('aria-disabled')).toBe('true');
    expect(continueButton.getAttribute('aria-describedby')).toBe('maturity-areas-required');
    expect(setup.host.querySelector('#maturity-areas-required')?.textContent?.trim()).toBe(
      'Choose at least one area to continue.',
    );

    click(setup, '.continue-button');
    expect(setup.host.querySelector('.areas-phase')).not.toBeNull();

    chip(setup.host, 'Work').click();
    setup.fixture.detectChanges();
    expect(continueButton.getAttribute('aria-disabled')).toBeNull();
    click(setup, '.continue-button');
    expect(setup.host.querySelector('.rate-phase')).not.toBeNull();
  });

  it('shows every area an existing assessment holds as a pressed chip, custom and unsuggested too', () => {
    const setup = setUp(
      assessment({
        areas: [
          area({ id: 'x1', key: 'work', level: 2 }),
          area({ id: 'x2', key: 'community' }),
          area({ id: 'x3', key: undefined, name: 'Volunteering' }),
        ],
      }),
    );
    click(setup, '.change-areas');

    const pressed = chips(setup.host)
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map(chipLabel);
    expect(pressed).toEqual(['Work', 'Community', 'Volunteering']);

    chip(setup.host, 'Community').click();
    expect(setup.emitted.at(-1)?.map((a) => a.id)).toEqual(['x1', 'x3']);
  });
});

describe('MaturityAssessmentForm, phase 2: rating (#222)', () => {
  const THREE = [
    area({ id: 'x1', key: 'work', level: 3 }),
    area({ id: 'x2', key: 'family' }),
    area({ id: 'x3', key: undefined, name: 'Volunteering' }),
  ];

  it('opens an existing assessment on rating, with the legend once, collapsed, naming the book terms', () => {
    const { host } = setUp(assessment({ areas: THREE }));

    expect(host.querySelector('.rate-phase')).not.toBeNull();
    expect(host.querySelectorAll('.maturity-legend')).toHaveLength(1);
    const legend = host.querySelector('.legend-list')?.textContent ?? '';
    for (const term of ['Dependence', 'Independence', 'Interdependence']) {
      expect(legend).toContain(term);
    }
    expect(legend).toContain('I wait for others');
  });

  it('rates each area with a three-segment control in plain words', () => {
    const setup = setUp(assessment({ areas: THREE }));
    const control = setup.host.querySelectorAll('.level-control')[1];
    const options = Array.from(control.querySelectorAll('.level-option button'));

    expect(options.map((button) => button.textContent?.trim())).toEqual([
      'I wait for others',
      'I handle it myself',
      'We do it together',
    ]);
    (options[0] as HTMLButtonElement).click();
    setup.fixture.detectChanges();

    expect(setup.emitted.at(-1)?.find((a) => a.id === 'x2')?.level).toBe(1);
  });

  it('desktop: one expansion panel per area, the first unrated open, levels summarised', () => {
    const { host } = setUp(assessment({ areas: THREE }));
    const panels = Array.from(host.querySelectorAll('.area-panel'));

    expect(panels).toHaveLength(3);
    expect(panels.map((panel) => panel.classList.contains('mat-expanded'))).toEqual([
      false,
      true,
      false,
    ]);
    expect(panels[0].querySelector('.area-level-summary')?.textContent?.trim()).toBe(
      'We do it together',
    );
    expect(panels[1].querySelector('.area-level-summary')?.textContent?.trim()).toBe(
      'Not rated yet',
    );
    expect(panels[2].querySelector('.area-name')?.textContent?.trim()).toBe('Volunteering');
  });

  it('phone: one area per screen, Previous/Next walk through them', () => {
    const setup = setUp(assessment({ areas: THREE }), { handset: true });
    const name = () => setup.host.querySelector('h4.area-name')?.textContent?.trim();
    const position = () => setup.host.querySelector('.area-position')?.textContent?.trim();

    expect(setup.host.querySelectorAll('.area-rating')).toHaveLength(1);
    expect(name()).toBe('Family');
    expect(position()).toBe('Area 2 of 3');

    click(setup, '.next-area');
    expect(name()).toBe('Volunteering');
    expect(setup.host.querySelector('.next-area')).toBeNull();

    click(setup, '.previous-area');
    click(setup, '.previous-area');
    expect(name()).toBe('Work');
    expect(setup.host.querySelector('.previous-area')).toBeNull();
  });

  it('phone: the area block is a polite live region, so the new area is announced', () => {
    const { host } = setUp(assessment({ areas: THREE }), { handset: true });
    const region = host.querySelector('.area-heading-block');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.querySelector('h4.area-name')).not.toBeNull();
  });

  it('removes an area with a secondary icon button named for it', () => {
    const setup = setUp(assessment({ areas: THREE }), { handset: true });
    const remove = setup.host.querySelector('.remove-area') as HTMLButtonElement;

    expect(remove.getAttribute('aria-label')).toBe('Remove this area: Family');
    remove.click();
    setup.fixture.detectChanges();

    expect(setup.emitted.at(-1)?.map((a) => a.id)).toEqual(['x1', 'x3']);
    expect(setup.host.querySelector('h4.area-name')?.textContent?.trim()).toBe('Volunteering');
  });

  it('returns to the chips once the last area is removed', () => {
    const setup = setUp(assessment({ areas: [area({ id: 'only' })] }), { handset: true });
    click(setup, '.remove-area');
    expect(setup.emitted.at(-1)).toEqual([]);
    expect(setup.host.querySelector('.areas-phase')).not.toBeNull();
  });

  it('edits the note of the matching area, with the example placeholder (#230)', () => {
    const setup = setUp(assessment({ areas: THREE }), { handset: true });
    const textarea = setup.host.querySelector('.area-note textarea') as HTMLTextAreaElement;

    expect(textarea.placeholder).toBe(
      'e.g. I still wait for my manager to tell me what to focus on.',
    );
    textarea.value = 'Feeling steadier lately';
    textarea.dispatchEvent(new Event('input'));

    expect(setup.emitted.at(-1)?.find((a) => a.id === 'x2')?.note).toBe('Feeling steadier lately');
  });

  it('Change areas goes back to the chips with the areas pressed', () => {
    const setup = setUp(assessment({ areas: THREE }));
    click(setup, '.change-areas');

    expect(setup.host.querySelector('.areas-phase')).not.toBeNull();
    expect(chip(setup.host, 'Family').getAttribute('aria-pressed')).toBe('true');
  });

  it('resets to the chips when a different, new assessment opens in the same form', () => {
    const setup = setUp(assessment({ areas: THREE }));
    expect(setup.host.querySelector('.rate-phase')).not.toBeNull();

    setup.fixture.componentRef.setInput('isNew', true);
    setup.fixture.componentRef.setInput('assessment', assessment({ id: 'a2', areas: THREE }));
    setup.fixture.detectChanges();

    expect(setup.host.querySelector('.areas-phase')).not.toBeNull();
  });
});
