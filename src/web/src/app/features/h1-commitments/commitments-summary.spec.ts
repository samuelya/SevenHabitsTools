import { TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { CommitmentsSummary } from './commitments-summary';

describe('CommitmentsSummary', () => {
  function render(summary: CommitmentsSummary['summary'] extends () => infer T ? T : never) {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
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

  it('leaves out the 30-day line with nothing resolved in it', () => {
    const text = render({ allTime: { kept: 1, broken: 0, rate: 100 }, last30: null });
    expect(text).not.toContain('Last 30 days');
  });
});
