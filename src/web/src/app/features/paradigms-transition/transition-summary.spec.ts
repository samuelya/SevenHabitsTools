import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TransitionSummary } from './transition-summary';

function setUp(summary: { stopped: number; rewritten: number; total: number }) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-transition')],
  });
  const fixture = TestBed.createComponent(TransitionSummary);
  fixture.componentRef.setInput('summary', summary);
  fixture.detectChanges();
  return fixture;
}

describe('TransitionSummary', () => {
  it('renders the total, stopped and rewritten counts', () => {
    const fixture = setUp({ stopped: 2, rewritten: 1, total: 5 });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('5');
    expect(text).toContain('2');
    expect(text).toContain('1');
  });

  it('renders zero counts with no scripts', () => {
    const fixture = setUp({ stopped: 0, rewritten: 0, total: 0 });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('0');
  });
});
