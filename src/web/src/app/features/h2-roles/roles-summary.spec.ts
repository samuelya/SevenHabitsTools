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
    const text = render({ count: 4, rated: 3, average: 10 / 3 });
    expect(text).toContain('Your picture');
    expect(text).toContain('4 roles, 3 rated');
    expect(text).toContain('Average 3.3 of 5');
  });

  it('says "1 role" and shows no average until one is rated', () => {
    const text = render({ count: 1, rated: 0, average: null });
    expect(text).toContain('1 role, 0 rated');
    expect(text).not.toContain('Average');
  });
});
