import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope, TranslocoService } from '@jsverse/transloco';
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

  it('follows a language switch back to an already-loaded language (#187)', () => {
    // This card is `OnPush` and its `summary` input doesn't change on a language switch, so the
    // only thing that can re-render it is `AppPluralPipe` marking the view for check. The second
    // switch is the one that used to fail: `en` is cached by then, so no `translationLoadSuccess`
    // fires and the counts stayed in Arabic while the rest of the page was English.
    const fixture = setUp({ stopped: 2, rewritten: 1, total: 5 });
    const transloco = TestBed.inject(TranslocoService);
    expect(fixture.nativeElement.textContent).toContain('scripts named');

    transloco.setActiveLang('ar');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('scripts named');

    transloco.setActiveLang('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('scripts named');
  });
});
