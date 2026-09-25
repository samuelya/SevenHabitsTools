import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { ChallengeCheckinForm, CheckInSubmission } from './challenge-checkin-form';
import type { CheckIn } from './challenge.model';

function setUp(checkin?: CheckIn): ComponentFixture<ChallengeCheckinForm> {
  TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  const fixture = TestBed.createComponent(ChallengeCheckinForm);
  fixture.componentRef.setInput('date', '2026-03-12');
  fixture.componentRef.setInput('checkin', checkin);
  fixture.detectChanges();
  return fixture;
}

function el(fixture: ComponentFixture<ChallengeCheckinForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function toggles(fixture: ComponentFixture<ChallengeCheckinForm>): HTMLButtonElement[] {
  return [...el(fixture).querySelectorAll<HTMLButtonElement>('mat-slide-toggle button')];
}

describe('ChallengeCheckinForm', () => {
  it('asks the four questions as switches labelled by their prompt, plus the note triple', () => {
    const fixture = setUp();
    const text = el(fixture).textContent ?? '';
    expect(toggles(fixture)).toHaveLength(4);
    expect(text).toContain('Did you put your energy into things you can affect?');
    expect(text).toContain('Did you get through the day without blaming anyone?');
    expect(text).toContain('One line about today. What did you do differently?');
    expect(el(fixture).querySelector('textarea')?.getAttribute('placeholder')).toBe(
      "e.g. Didn't join the moaning about the new rota. Asked what we could change instead.",
    );
    expect(el(fixture).querySelector('.saved-line')?.textContent?.trim()).toBe('');
  });

  it('emits the answers and note on Save', () => {
    const fixture = setUp();
    const saved: CheckInSubmission[] = [];
    fixture.componentInstance.saved.subscribe((value) => saved.push(value));
    toggles(fixture)[0].click();
    toggles(fixture)[3].click();
    const note = el(fixture).querySelector('textarea') as HTMLTextAreaElement;
    note.value = 'Asked what we could change.';
    note.dispatchEvent(new Event('input'));
    (el(fixture).querySelector('.save-button') as HTMLButtonElement).click();
    expect(saved).toEqual([
      {
        answers: { influence: true, promise: false, response: false, noBlame: true },
        note: 'Asked what we could change.',
      },
    ]);
  });

  it('says "Saved. See you tomorrow." while the form matches the stored check-in', () => {
    const fixture = setUp({
      date: '2026-03-12',
      answers: { influence: true, promise: true, response: false, noBlame: true },
    });
    const saved = () => el(fixture).querySelector('.saved-line')?.textContent?.trim();
    expect(saved()).toBe('Saved. See you tomorrow.');
    expect(toggles(fixture).map((t) => t.getAttribute('aria-checked'))).toEqual([
      'true',
      'true',
      'false',
      'true',
    ]);
    toggles(fixture)[2].click();
    fixture.detectChanges();
    expect(saved()).toBe('');
  });

  it('resets to a fresh form when the date changes (local midnight)', () => {
    const fixture = setUp({
      date: '2026-03-12',
      answers: { influence: true, promise: true, response: true, noBlame: true },
    });
    fixture.componentRef.setInput('date', '2026-03-13');
    fixture.componentRef.setInput('checkin', undefined);
    fixture.detectChanges();
    expect(toggles(fixture).every((t) => t.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(el(fixture).querySelector('.saved-line')?.textContent?.trim()).toBe('');
  });
});
