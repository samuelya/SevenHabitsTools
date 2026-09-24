import {
  area,
  assessment,
  chip,
  chipLabel,
  chips,
  click,
  setUp,
  submitCustomName,
  typeCustomName,
} from './maturity-assessment-form.testing';

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
    const input = typeCustomName(setup, '  Volunteering ');
    submitCustomName(setup);

    expect(setup.emitted.at(-1)).toEqual([expect.objectContaining({ name: 'Volunteering' })]);
    expect(setup.emitted.at(-1)?.[0].key).toBeUndefined();
    expect(input.value).toBe('');
    expect(chip(setup.host, 'Volunteering').getAttribute('aria-pressed')).toBe('true');
  });

  it('builds each edit on the last one, even before the page has fed it back (#222 review)', () => {
    const setup = setUp(assessment(), { isNew: true, feedBack: false });
    chip(setup.host, 'Health').click();
    typeCustomName(setup, 'Volunteering');
    submitCustomName(setup);

    expect(setup.emitted.at(-1)?.map((a) => a.key ?? a.name)).toEqual(['health', 'Volunteering']);
  });

  it('refuses a name already in the list: keeps the text and says why until the next keystroke (#222 review)', () => {
    const setup = setUp(
      assessment({ areas: [area({ id: 'x1', key: undefined, name: 'Volunteering' })] }),
      {
        isNew: true,
      },
    );
    const input = typeCustomName(setup, 'volunteering');
    submitCustomName(setup);

    expect(setup.emitted).toHaveLength(0);
    expect(input.value).toBe('volunteering');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('maturity-custom-duplicate');
    expect(setup.host.querySelector('#maturity-custom-duplicate')?.textContent?.trim()).toBe(
      'That area is already in the list.',
    );

    typeCustomName(setup, 'volunteering abroad');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(setup.host.querySelector('#maturity-custom-duplicate')?.textContent?.trim()).toBe('');
  });

  it('a built-in name typed as a custom one adds that built-in, even one no longer suggested (#222 re-review R1)', () => {
    const setup = setUp(assessment(), { isNew: true });
    typeCustomName(setup, 'Community');
    submitCustomName(setup);

    expect(setup.emitted.at(-1)).toEqual([expect.objectContaining({ key: 'community' })]);
    expect(chip(setup.host, 'Community').getAttribute('aria-pressed')).toBe('true');
    expect(setup.host.querySelector('#maturity-custom-duplicate')?.textContent?.trim()).toBe('');
  });

  it('Continue with a built-in name typed and its chip unpressed adds it and continues (#222 re-review R1)', () => {
    const setup = setUp(assessment(), { isNew: true });
    typeCustomName(setup, 'health');
    click(setup, '.continue-button');

    expect(setup.emitted.at(-1)).toEqual([expect.objectContaining({ key: 'health' })]);
    expect(setup.continued()).toBe(1);
  });

  it('a built-in name already chosen is refused as a duplicate', () => {
    const setup = setUp(assessment(), { isNew: true });
    chip(setup.host, 'Health').click();
    setup.fixture.detectChanges();
    typeCustomName(setup, 'HEALTH');
    submitCustomName(setup);

    expect(setup.emitted).toHaveLength(1);
    expect(setup.host.querySelector('#maturity-custom-duplicate')?.textContent?.trim()).toBe(
      'That area is already in the list.',
    );
  });

  it('Continue adds a name still typed in "Add your own", then reports it (#222 review)', () => {
    const setup = setUp(assessment(), { isNew: true });
    typeCustomName(setup, 'Volunteering');
    click(setup, '.continue-button');

    expect(setup.emitted.at(-1)).toEqual([expect.objectContaining({ name: 'Volunteering' })]);
    expect(setup.continued()).toBe(1);
    expect(setup.host.querySelector('.rate-phase')).not.toBeNull();
  });

  it('Continue with a refused name stays on the chips with the error (#222 review)', () => {
    const setup = setUp(assessment({ areas: [area({ id: 'x1', key: 'work' })] }), { isNew: true });
    typeCustomName(setup, 'Work');
    click(setup, '.continue-button');

    expect(setup.continued()).toBe(0);
    expect(setup.host.querySelector('.areas-phase')).not.toBeNull();
    expect(setup.host.querySelector('#maturity-custom-duplicate')?.textContent?.trim()).toBe(
      'That area is already in the list.',
    );
  });

  it('clears the typed name when another assessment opens in the same form (#222 review)', () => {
    const setup = setUp(assessment(), { isNew: true });
    typeCustomName(setup, 'Volunteering');

    setup.fixture.componentRef.setInput('assessment', assessment({ id: 'a2' }));
    setup.fixture.detectChanges();

    expect((setup.host.querySelector('.custom-area input') as HTMLInputElement).value).toBe('');
  });

  it('asks the page to confirm unpressing an area that holds a level or a note (#222 review)', () => {
    const setup = setUp(
      assessment({
        areas: [
          area({ id: 'x1', key: 'work', level: 2 }),
          area({ id: 'x2', key: 'family', note: 'Weekends' }),
          area({ id: 'x3', key: 'health' }),
        ],
      }),
    );
    click(setup, '.change-areas');

    chip(setup.host, 'Work').click();
    chip(setup.host, 'Family').click();
    setup.fixture.detectChanges();
    expect(setup.removeRequests).toEqual(['x1', 'x2']);
    expect(setup.emitted).toHaveLength(0);

    chip(setup.host, 'Health').click();
    setup.fixture.detectChanges();
    expect(setup.emitted.at(-1)?.map((a) => a.id)).toEqual(['x1', 'x2']);
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

  it("a saved assessment's last area can't be unpressed: the chip says why (#222 re-review R3)", () => {
    const setup = setUp(assessment({ areas: [area({ id: 'only', level: 2 })] }));
    click(setup, '.change-areas');
    const work = chip(setup.host, 'Work');

    expect(work.getAttribute('aria-disabled')).toBe('true');
    expect(work.getAttribute('aria-describedby')).toBe('maturity-last-area');
    expect(setup.host.querySelector('#maturity-last-area')?.textContent?.trim()).toBe(
      'An assessment needs at least one area.',
    );
    work.click();
    setup.fixture.detectChanges();
    expect(setup.emitted).toHaveLength(0);
    expect(setup.removeRequests).toHaveLength(0);
    expect(chip(setup.host, 'Work').getAttribute('aria-pressed')).toBe('true');

    chip(setup.host, 'Family').click();
    setup.fixture.detectChanges();
    expect(chip(setup.host, 'Work').getAttribute('aria-disabled')).toBeNull();
  });

  it('a refused edit shows the stored areas again (#222 re-review R2)', () => {
    const setup = setUp(assessment({ areas: [area({ id: 'w' })] }), { feedBack: false });
    click(setup, '.change-areas');
    chip(setup.host, 'Family').click();
    setup.fixture.detectChanges();
    expect(chip(setup.host, 'Family').getAttribute('aria-pressed')).toBe('true');

    setup.fixture.componentRef.setInput('refusedEdits', 1);
    setup.fixture.detectChanges();

    expect(chip(setup.host, 'Family').getAttribute('aria-pressed')).toBe('false');
  });
});
