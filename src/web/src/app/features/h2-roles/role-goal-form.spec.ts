import { TestBed } from '@angular/core/testing';
import '../../features/settings/settings.model';
import { RoleGoal } from '../../shared/roles/role-goals.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { GoalAction, GoalActionEvent } from './goals.logic';
import { RoleGoalForm } from './role-goal-form';
import { RoleGoalsSection } from './role-goals-section';

function goal(overrides: Partial<RoleGoal> = {}): RoleGoal {
  return {
    id: 'g1',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    roleId: 'r1',
    what: 'One evening a week',
    horizon: 'year',
    status: 'open',
    steps: [],
    ...overrides,
  };
}

function setUp(value: RoleGoal, inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  const fixture = TestBed.createComponent(RoleGoalForm);
  fixture.componentRef.setInput('goal', value);
  for (const [name, input] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, input);
  }
  fixture.detectChanges();
  const actions: GoalAction[] = [];
  fixture.componentInstance.action.subscribe((action) => actions.push(action));
  return { fixture, actions, el: fixture.nativeElement as HTMLElement };
}

function type(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

describe('RoleGoalForm', () => {
  it('gives every free-text field its label, prompt and the guide example as placeholder', () => {
    const { el } = setUp(goal({ steps: [{ key: 's1', text: '', done: false }] }));
    const text = el.textContent ?? '';
    expect(text).toContain('In this role, what do you want to be true a while from now?');
    expect(text).toContain('Why this, and why now?');
    expect(text).toContain("What will you see or hear when you've got there?");
    expect(text).toContain("What's the first small thing? Up to five.");
    const placeholders = [...el.querySelectorAll('input[type="text"], textarea')].map((field) =>
      field.getAttribute('placeholder'),
    );
    expect(placeholders).toEqual([
      "e.g. One evening a week that's just us, phones away.",
      "e.g. She's twelve. In a few years she won't want to.",
      'e.g. She suggests what we do, not me.',
      'e.g. Ask her which evening works.',
    ]);
  });

  it('emits text edits; a blank what shows the error and keeps what was typed', () => {
    const { fixture, actions, el } = setUp(goal());
    const what = el.querySelector<HTMLTextAreaElement>('.what-field')!;
    type(what, '');
    fixture.detectChanges();
    expect(actions).toEqual([{ kind: 'edit', edit: { what: '' } }]);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Write what you want to reach first.',
    );
    expect(what.value).toBe('');
    type(el.querySelector<HTMLTextAreaElement>('.why-field')!, 'Because');
    type(el.querySelector<HTMLInputElement>('.how-field')!, 'She asks');
    expect(actions.slice(1)).toEqual([
      { kind: 'edit', edit: { why: 'Because' } },
      { kind: 'edit', edit: { how: 'She asks' } },
    ]);
  });

  it('always renders the error live region, empty until needed', () => {
    const { el } = setUp(goal());
    expect(el.querySelector('[role="alert"]')?.textContent?.trim()).toBe('');
    expect(el.querySelector('.hint[aria-live="polite"]')).not.toBeNull();
  });

  it('emits a new horizon, nothing for the current one, and shows the stored one after', () => {
    const { fixture, actions, el } = setUp(goal());
    const toggles = el.querySelectorAll<HTMLButtonElement>('mat-button-toggle button');
    toggles[0].click();
    toggles[2].click();
    fixture.detectChanges();
    expect(actions).toEqual([{ kind: 'edit', edit: { horizon: 'fiveYears' } }]);
    // Not applied (the input didn't change): the toggle shows the stored horizon again.
    expect(toggles[0].getAttribute('aria-pressed')).toBe('true');
    expect(toggles[2].getAttribute('aria-pressed')).toBe('false');
  });

  it('hides steps, status and the rest of a draft until it is saved', () => {
    const { el } = setUp(goal({ what: '' }), { saved: false });
    expect(el.querySelector('.add-step')).toBeNull();
    expect(el.querySelector('.reached')).toBeNull();
    expect(el.querySelector('.delete-goal')).not.toBeNull();
  });

  it('edits, toggles and removes steps; a refused toggle shows the stored state', () => {
    const { fixture, actions, el } = setUp(
      goal({ steps: [{ key: 's1', text: 'Ask her', done: false }] }),
    );
    type(el.querySelector<HTMLInputElement>('.step-field input')!, 'Ask her tonight');
    const checkbox = el.querySelector<HTMLInputElement>('.step-done input')!;
    checkbox.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.remove-step')!.click();
    expect(actions).toEqual([
      { kind: 'editStep', key: 's1', text: 'Ask her tonight' },
      { kind: 'toggleStep', key: 's1', done: true },
      { kind: 'removeStep', key: 's1' },
    ]);
    expect(checkbox.checked).toBe(false);
  });

  it('disables "Add step" with the hint at five steps', () => {
    const steps = Array.from({ length: 5 }, (_, i) => ({ key: `s${i}`, text: 'x', done: false }));
    const { actions, el } = setUp(goal({ steps }));
    const add = el.querySelector<HTMLButtonElement>('.add-step')!;
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(el.textContent).toContain('Five is plenty. Finish one before adding more.');
    add.click();
    expect(actions).toEqual([]);
  });

  it('offers Reached and Drop while open, Reopen with the date once resolved', () => {
    const open = setUp(goal());
    open.el.querySelector<HTMLButtonElement>('.reached')!.click();
    open.el.querySelector<HTMLButtonElement>('.dropped')!.click();
    expect(open.actions).toEqual([
      { kind: 'status', status: 'reached' },
      { kind: 'status', status: 'dropped' },
    ]);
    TestBed.resetTestingModule();
    const resolved = setUp(goal({ status: 'reached', resolvedOn: '2026-03-10' }));
    expect(resolved.el.querySelector('.reached')).toBeNull();
    expect(resolved.el.querySelector('.status-text')?.textContent).toContain('Reached');
    expect(resolved.el.querySelector('.status-text')?.textContent).toContain('2026');
    resolved.el.querySelector<HTMLButtonElement>('.reopen')!.click();
    expect(resolved.actions).toEqual([{ kind: 'reopen' }]);
  });
});

describe('RoleGoalsSection', () => {
  function section(goals: RoleGoal[], inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    const fixture = TestBed.createComponent(RoleGoalsSection);
    fixture.componentRef.setInput('roleId', 'r1');
    fixture.componentRef.setInput('goals', goals);
    for (const [name, input] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, input);
    }
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the empty prompt and "Add goal" with no goals', () => {
    const { fixture, el } = section([]);
    let added = 0;
    fixture.componentInstance.added.subscribe(() => added++);
    expect(el.textContent).toContain('No goals yet.');
    el.querySelector<HTMLButtonElement>('.add-goal')!.click();
    expect(added).toBe(1);
  });

  it('expands one goal, closes it on a second press, and passes its actions on with its id', () => {
    const { fixture, el } = section([goal(), goal({ id: 'g2', what: 'Two' })], {
      expandedId: 'g1',
    });
    const expanded: (string | null)[] = [];
    const events: GoalActionEvent[] = [];
    fixture.componentInstance.expandedChange.subscribe((id) => expanded.push(id));
    fixture.componentInstance.goalAction.subscribe((event) => events.push(event));
    const headers = el.querySelectorAll<HTMLButtonElement>('.goal-header');
    expect(headers[0].getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelectorAll('app-role-goal-form')).toHaveLength(1);
    headers[0].click();
    headers[1].click();
    el.querySelector<HTMLButtonElement>('.reached')!.click();
    expect(expanded).toEqual([null, 'g2']);
    expect(events).toEqual([{ goalId: 'g1', action: { kind: 'status', status: 'reached' } }]);
  });
});
