import { TestBed } from '@angular/core/testing';
import { DocumentStore } from '../../core/data/document.store';
import '../settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { RolesSummary } from './roles-summary';
import { RolesSummary as RolesSummaryData } from './roles.logic';

describe('RolesSummary', () => {
  function render(summary: RolesSummaryData, numerals: 'western' | 'arabic' = 'western') {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    TestBed.inject(DocumentStore).update('settings', () => ({ language: 'en', numerals }));
    const fixture = TestBed.createComponent(RolesSummary);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('words the count plural-correct and the average to one decimal', () => {
    const text = render({ count: 4, rated: 3, average: 10 / 3, goals: 2, goalsWithStep: 1 });
    expect(text).toContain('Your picture');
    expect(text).toContain('4 roles, 3 rated');
    expect(text).toContain('Average 3.3 of 5');
    expect(text).toContain('2 goals, 1 with a first step');
  });

  it('says "1 goal" in the singular', () => {
    const text = render({ count: 1, rated: 0, average: null, goals: 1, goalsWithStep: 0 });
    expect(text).toContain('1 goal, 0 with a first step');
  });

  it('says "1 role" and shows no average until one is rated', () => {
    const text = render({ count: 1, rated: 0, average: null, goals: 0, goalsWithStep: 0 });
    expect(text).toContain('1 role, 0 rated');
    expect(text).not.toContain('goal');
    expect(text).not.toContain('Average');
  });

  it('renders every number in Arabic-Indic numerals (#303)', () => {
    const text = render(
      { count: 4, rated: 0, average: null, goals: 17, goalsWithStep: 4 },
      'arabic',
    );
    expect(text).toContain('٤ roles, ٠ rated');
    expect(text).toContain('١٧ goals, ٤ with a first step');
    expect(text).not.toMatch(/[0-9]/);
  });
});
