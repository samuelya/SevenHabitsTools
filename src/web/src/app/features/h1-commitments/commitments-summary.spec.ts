import { TestBed } from '@angular/core/testing';
import { DocumentStore } from '../../core/data/document.store';
import '../settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { CommitmentsSummary } from './commitments-summary';

describe('CommitmentsSummary', () => {
  function render(
    summary: CommitmentsSummary['summary'] extends () => infer T ? T : never,
    numerals: 'western' | 'arabic' = 'western',
  ) {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    TestBed.inject(DocumentStore).update('settings', () => ({ language: 'en', numerals }));
    const fixture = TestBed.createComponent(CommitmentsSummary);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('words the rates "kept 4 of 5 (80%)"', () => {
    const text = render({
      allTime: { kept: 4, broken: 1, rate: 80 },
      last30: { kept: 2, broken: 1, rate: 67 },
    });
    expect(text).toContain("How you're doing");
    expect(text).toContain('Last 30 days: kept 2 of 3 (67%)');
    expect(text).toContain('All time: kept 4 of 5 (80%)');
  });

  // Review finding 6 (PR #282).
  it('writes every number, the 30 included, in Eastern Arabic digits with that setting', () => {
    const text = render(
      { allTime: { kept: 4, broken: 1, rate: 80 }, last30: { kept: 2, broken: 1, rate: 67 } },
      'arabic',
    );
    expect(text).toContain('Last ٣٠ days: kept ٢ of ٣ (٦٧%)');
    expect(text).toContain('All time: kept ٤ of ٥ (٨٠%)');
    expect(text).not.toMatch(/[0-9]/);
  });

  it('leaves out the 30-day line with nothing resolved in it', () => {
    const text = render({ allTime: { kept: 1, broken: 0, rate: 100 }, last30: null });
    expect(text).not.toContain('Last 30 days');
  });
});
