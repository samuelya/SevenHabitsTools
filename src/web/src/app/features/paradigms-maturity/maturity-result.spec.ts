import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import '../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { MaturityResult } from './maturity-result';
import { MaturityArea, MaturityAssessment } from './maturity.model';

const LABELS = { work: 'Work', family: 'Family' };
const PROFILE_LABELS = { 1: 'Dependence', 2: 'Independence', 3: 'Interdependence' };

function area(overrides: Partial<MaturityArea> = {}): MaturityArea {
  return { id: 'ar1', key: 'work', ...overrides };
}

function assessment(overrides: Partial<MaturityAssessment> = {}): MaturityAssessment {
  return {
    id: 'a1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    date: '2026-01-01',
    areas: [],
    ...overrides,
  };
}

function setUp(current: MaturityAssessment, previous: MaturityAssessment | null = null) {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('paradigms-maturity'),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(MaturityResult);
  fixture.componentRef.setInput('assessment', current);
  fixture.componentRef.setInput('previous', previous);
  fixture.componentRef.setInput('builtInLabels', LABELS);
  fixture.componentRef.setInput('profileLabels', PROFILE_LABELS);
  fixture.detectChanges();
  return fixture;
}

describe('MaturityResult', () => {
  it('shows a pending message with no rated areas', () => {
    const fixture = setUp(assessment({ areas: [area({ level: undefined })] }));
    expect(fixture.nativeElement.querySelector('.profile-pending')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.profile')).toBeNull();
  });

  it('shows the overall profile and suggested habits once rated', () => {
    const fixture = setUp(assessment({ areas: [area({ level: 1 })] }));
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Dependence');
    const links = fixture.nativeElement.querySelectorAll('.suggestions a');
    expect(links).toHaveLength(3);
    expect((links[0] as HTMLAnchorElement).getAttribute('href')).toBe('/habits/h1');
  });

  it('omits the delta section with no previous assessment', () => {
    const fixture = setUp(assessment({ areas: [area({ level: 1 })] }));
    expect(fixture.nativeElement.querySelector('.deltas')).toBeNull();
  });

  it('shows a level delta, a new-area marker and a removed area', () => {
    const previous = assessment({
      id: 'prev',
      date: '2025-12-01',
      areas: [
        area({ id: 'p1', key: 'work', level: 1 }),
        area({ id: 'p2', key: 'family', level: 2 }),
      ],
    });
    const current = assessment({
      areas: [
        area({ id: 'c1', key: 'work', level: 3 }),
        area({ id: 'c2', key: undefined, name: 'Volunteering', level: 1 }),
      ],
    });
    const fixture = setUp(current, previous);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('+2');
    expect(fixture.nativeElement.querySelectorAll('.deltas li')).toHaveLength(3);
  });
});
