import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { MaturitySummary } from './maturity-summary';

const PROFILE_LABELS = { 1: 'Dependence', 2: 'Independence', 3: 'Interdependence' };

function setUp(summary: { totalAssessments: number; latestProfile: 1 | 2 | 3 | null }) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-maturity')],
  });
  const fixture = TestBed.createComponent(MaturitySummary);
  fixture.componentRef.setInput('summary', summary);
  fixture.componentRef.setInput('profileLabels', PROFILE_LABELS);
  fixture.detectChanges();
  return fixture;
}

describe('MaturitySummary', () => {
  it('shows the total assessment count', () => {
    const fixture = setUp({ totalAssessments: 2, latestProfile: 2 });
    expect(fixture.nativeElement.textContent).toContain('2');
  });

  it('omits the latest profile line with no assessment yet', () => {
    const fixture = setUp({ totalAssessments: 0, latestProfile: null });
    expect(fixture.nativeElement.querySelectorAll('.count')).toHaveLength(1);
  });

  it('shows the latest profile label when there is one', () => {
    const fixture = setUp({ totalAssessments: 1, latestProfile: 3 });
    expect(fixture.nativeElement.textContent).toContain('Interdependence');
  });
});
