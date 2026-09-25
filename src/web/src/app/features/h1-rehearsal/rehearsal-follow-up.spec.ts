import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { RehearsalFollowUpForm } from './rehearsal-follow-up';
import { FollowUpKept, FollowUpResult, RehearsalFollowUp } from './rehearsal.model';

interface FollowUpInternals {
  onHappenedChange(happened: boolean): void;
  onResultChange(result: FollowUpResult): void;
  onKeptChange(kept: FollowUpKept): void;
  save(): void;
}

function setUp(followUp?: RehearsalFollowUp) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('h1-rehearsal')],
  });
  const fixture = TestBed.createComponent(RehearsalFollowUpForm);
  fixture.componentRef.setInput('recordId', 'r1');
  fixture.componentRef.setInput('followUp', followUp);
  fixture.detectChanges();
  const saved: RehearsalFollowUp[] = [];
  fixture.componentInstance.saved.subscribe((value) => saved.push(value));
  const form = fixture.componentInstance as unknown as FollowUpInternals;
  const act = (change: (f: FollowUpInternals) => void) => {
    change(form);
    fixture.detectChanges();
  };
  return { fixture, element: fixture.nativeElement as HTMLElement, saved, act };
}

function checked(element: HTMLElement, groupLabel: string): string | undefined {
  const group = element.querySelector(`mat-radio-group[aria-labelledby="${groupLabel}"]`);
  return group?.querySelector('.mat-mdc-radio-checked')?.textContent?.trim();
}

describe('RehearsalFollowUpForm', () => {
  it('asks only "Did it happen?" until it is answered, with no Save', () => {
    const { element } = setUp();

    expect(element.querySelector('legend')?.textContent).toContain('Afterwards');
    expect(element.textContent).toContain('Did it happen?');
    expect(element.textContent).not.toContain('How you responded');
    expect(element.querySelector('.save-button')).toBeNull();
  });

  it('"Not yet" saves only that', () => {
    const { element, saved, act } = setUp();

    act((f) => f.onHappenedChange(false));
    expect(element.textContent).not.toContain('How you responded');
    (element.querySelector('.save-button') as HTMLButtonElement).click();
    expect(saved).toEqual([{ happened: false }]);
  });

  it('pre-selects the promise answer from the result: Kept, Broken, or nothing for Partly', () => {
    const { element, act } = setUp();
    act((f) => f.onHappenedChange(true));

    act((f) => f.onResultChange('chosen'));
    expect(checked(element, 'kept-label')).toBe('Kept');
    act((f) => f.onResultChange('reacted'));
    expect(checked(element, 'kept-label')).toBe('Broken');
    act((f) => f.onResultChange('partly'));
    expect(checked(element, 'kept-label')).toBeUndefined();
  });

  it('requires Kept or Broken before it saves, and says so', () => {
    const { element, saved, act } = setUp();
    act((f) => f.onHappenedChange(true));
    act((f) => f.onResultChange('partly'));

    act((f) => f.save());
    expect(saved).toEqual([]);
    expect(element.querySelector('#kept-error')?.textContent).toContain('Pick Kept or Broken.');

    act((f) => f.onKeptChange('kept'));
    expect(element.querySelector('#kept-error')).toBeNull();
    act((f) => f.save());
    expect(saved).toEqual([{ happened: true, result: 'partly', kept: 'kept' }]);
  });

  it('emits nothing until Save, and starts again from the stored follow-up for another rehearsal', () => {
    const { fixture, element, saved, act } = setUp({
      happened: true,
      result: 'chosen',
      kept: 'kept',
    });
    expect(checked(element, 'result-label')).toBe('As I planned');

    act((f) => f.onResultChange('reacted'));
    expect(saved).toEqual([]);

    fixture.componentRef.setInput('recordId', 'r2');
    fixture.componentRef.setInput('followUp', undefined);
    fixture.detectChanges();
    expect(element.textContent).not.toContain('How you responded');
  });
});
