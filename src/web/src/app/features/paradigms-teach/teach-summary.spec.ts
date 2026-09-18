import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope, TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TeachSummary } from './teach-summary';

function setUp(summary: { shared: number; overdue: number; total: number }) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-teach')],
  });
  const fixture = TestBed.createComponent(TeachSummary);
  fixture.componentRef.setInput('summary', summary);
  fixture.detectChanges();
  return fixture;
}

describe('TeachSummary', () => {
  it('renders the shared-of-total and overdue counts', () => {
    const fixture = setUp({ shared: 2, overdue: 1, total: 10 });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('2');
    expect(text).toContain('10');
    expect(text).toContain('1');
  });

  it('renders zero counts with nothing shared or overdue yet', () => {
    const fixture = setUp({ shared: 0, overdue: 0, total: 10 });

    expect(fixture.nativeElement.textContent).toContain('0');
  });

  it('follows a language switch back to an already-loaded language (playbook #187 regression)', () => {
    const fixture = setUp({ shared: 2, overdue: 1, total: 10 });
    const transloco = TestBed.inject(TranslocoService);
    expect(fixture.nativeElement.textContent).toContain('chapters shared');

    transloco.setActiveLang('ar');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('chapters shared');

    transloco.setActiveLang('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('chapters shared');
  });
});
