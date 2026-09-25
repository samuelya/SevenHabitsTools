import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope, TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { CircleSummary } from './circle-summary';

function setUp(summary: { withStep: number; total: number }) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('h1-circle')],
  });
  const fixture = TestBed.createComponent(CircleSummary);
  fixture.componentRef.setInput('summary', summary);
  fixture.detectChanges();
  return fixture;
}

describe('CircleSummary', () => {
  it('renders how many of the affectable concerns have a first step', () => {
    const fixture = setUp({ withStep: 2, total: 3 });

    expect(fixture.nativeElement.textContent).toContain('2 of 3 have a first step');
  });

  it('uses the singular for one', () => {
    const fixture = setUp({ withStep: 1, total: 4 });

    expect(fixture.nativeElement.textContent).toContain('1 of 4 has a first step');
  });

  it('follows a language switch', () => {
    const fixture = setUp({ withStep: 2, total: 3 });
    const transloco = TestBed.inject(TranslocoService);

    transloco.setActiveLang('ar');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('خطوة أولى');

    transloco.setActiveLang('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('have a first step');
  });
});
