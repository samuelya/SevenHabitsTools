import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope, TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { RehearsalSummary } from './rehearsal-summary';

function setUp(summary: { chosen: number; count: number }) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('h1-rehearsal')],
  });
  const fixture = TestBed.createComponent(RehearsalSummary);
  fixture.componentRef.setInput('summary', summary);
  fixture.detectChanges();
  return fixture;
}

describe('RehearsalSummary', () => {
  it('renders how many of the followed-up rehearsals went as planned', () => {
    const fixture = setUp({ chosen: 2, count: 3 });

    expect(fixture.nativeElement.textContent).toContain('2 of 3 went as planned');
  });

  it('uses the singular form for one', () => {
    const fixture = setUp({ chosen: 0, count: 1 });

    expect(fixture.nativeElement.textContent).toContain('0 of 1 went as planned');
  });

  it('follows a language switch', () => {
    const fixture = setUp({ chosen: 1, count: 2 });
    const transloco = TestBed.inject(TranslocoService);

    transloco.setActiveLang('ar');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1 من 2');

    transloco.setActiveLang('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1 of 2 went as planned');
  });
});
