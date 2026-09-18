import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope, TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { PerceptionSummary } from './perception-summary';

function setUp(summary: { completedSteps: number; totalSteps: number }) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-perception')],
  });
  const fixture = TestBed.createComponent(PerceptionSummary);
  fixture.componentRef.setInput('summary', summary);
  fixture.detectChanges();
  return fixture;
}

describe('PerceptionSummary', () => {
  it('renders the completed-of-total steps count', () => {
    const fixture = setUp({ completedSteps: 2, totalSteps: 3 });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('2');
    expect(text).toContain('3');
  });

  it('renders zero completed steps', () => {
    const fixture = setUp({ completedSteps: 0, totalSteps: 3 });

    expect(fixture.nativeElement.textContent).toContain('0');
  });

  it('follows a language switch back to an already-loaded language (playbook #187 regression)', () => {
    const fixture = setUp({ completedSteps: 1, totalSteps: 3 });
    const transloco = TestBed.inject(TranslocoService);
    expect(fixture.nativeElement.textContent).toContain('steps complete');

    transloco.setActiveLang('ar');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('steps complete');

    transloco.setActiveLang('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('steps complete');
  });
});
