import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { PcBalanceSummary } from './pc-balance-summary';

function setUp(summary: { totalAudits: number; latestAverageBalance: number | null }) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-pc-balance')],
  });
  const fixture = TestBed.createComponent(PcBalanceSummary);
  fixture.componentRef.setInput('summary', summary);
  fixture.detectChanges();
  return fixture;
}

describe('PcBalanceSummary', () => {
  it('shows the total audit count', () => {
    const fixture = setUp({ totalAudits: 3, latestAverageBalance: 1 });
    expect(fixture.nativeElement.textContent).toContain('3');
  });

  it('omits the latest balance line when there is no audit yet', () => {
    const fixture = setUp({ totalAudits: 0, latestAverageBalance: null });
    expect(fixture.nativeElement.querySelectorAll('.count')).toHaveLength(1);
  });

  it('shows the latest balance when there is one', () => {
    const fixture = setUp({ totalAudits: 1, latestAverageBalance: 1.5 });
    expect(fixture.nativeElement.querySelectorAll('.count')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('1.5');
  });
});
