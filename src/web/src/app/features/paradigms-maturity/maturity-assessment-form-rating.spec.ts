import { area, assessment, chip, click, setUp } from './maturity-assessment-form.testing';

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

  it('Remove on a rated area asks the page to confirm; the view follows once it goes (#222 review)', () => {
    const setup = setUp(assessment({ areas: THREE }), { handset: true });
    click(setup, '.previous-area');
    expect(setup.host.querySelector('h4.area-name')?.textContent?.trim()).toBe('Work');

    click(setup, '.remove-area');
    expect(setup.removeRequests).toEqual(['x1']);
    expect(setup.emitted).toHaveLength(0);

    setup.setAreas(THREE.slice(1));
    expect(setup.host.querySelector('h4.area-name')?.textContent?.trim()).toBe('Family');
  });

  it('desktop: removing an earlier area keeps the same panel open (#222 review)', () => {
    const setup = setUp(assessment({ areas: THREE }));
    const expanded = () =>
      Array.from(setup.host.querySelectorAll('.area-panel'))
        .filter((panel) => panel.classList.contains('mat-expanded'))
        .map((panel) => panel.querySelector('.area-name')?.textContent?.trim());
    expect(expanded()).toEqual(['Family']);

    setup.setAreas(THREE.slice(1));
    expect(expanded()).toEqual(['Family']);
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

  it("a saved assessment's last area has no working Remove: it says why (#222 re-review R3)", () => {
    const setup = setUp(assessment({ areas: [area({ id: 'only', level: 2 })] }), {
      handset: true,
    });
    const remove = setup.host.querySelector('.remove-area') as HTMLButtonElement;

    expect(remove.getAttribute('aria-disabled')).toBe('true');
    remove.click();
    setup.fixture.detectChanges();
    expect(setup.emitted).toHaveLength(0);
    expect(setup.removeRequests).toHaveLength(0);
    expect(setup.host.querySelector('.rate-phase')).not.toBeNull();
  });

  it('a refused level or note shows the stored value again (#222 re-review R2)', async () => {
    const setup = setUp(assessment({ areas: [area({ id: 'w', note: 'Kept' })] }), {
      feedBack: false,
    });
    const options = setup.host.querySelectorAll<HTMLButtonElement>('.level-option button');
    const note = setup.host.querySelector('textarea') as HTMLTextAreaElement;
    options[1].click();
    note.value = 'Kept, and more';
    note.dispatchEvent(new Event('input'));
    setup.fixture.detectChanges();

    setup.fixture.componentRef.setInput('refusedEdits', 1);
    await setup.fixture.whenStable();

    expect(setup.host.querySelector('.area-level-summary')?.textContent?.trim()).toBe(
      'Not rated yet',
    );
    expect(
      Array.from(options).map((button) => button.getAttribute('aria-pressed') ?? 'false'),
    ).toEqual(['false', 'false', 'false']);
    expect(note.value).toBe('Kept');
  });
});
