import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import '../../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { LocaleDateAdapter } from './locale-date-adapter';

// Review finding 7 (PR #282).
describe('LocaleDateAdapter', () => {
  function create(lang: string): LocaleDateAdapter {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), LocaleDateAdapter] });
    TestBed.inject(TranslocoService).setActiveLang(lang);
    return TestBed.inject(LocaleDateAdapter);
  }

  afterEach(() => TestBed.inject(TranslocoService).setActiveLang('en'));

  it('has the app locale from construction, before any effect runs, so ar parses day-first', () => {
    const adapter = create('ar');
    const date = adapter.parse('3/4/2026');
    expect([date?.getDate(), date?.getMonth()]).toEqual([3, 3]);
  });

  it('works out the part order once per locale, not on every parse', () => {
    // `datePartOrder()` is the only `Intl` use on the parse path.
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    const adapter = create('en');
    spy.mockClear();
    adapter.parse('4/3/2026');
    adapter.parse('4/30/2026');
    expect(spy).not.toHaveBeenCalled();
    adapter.setLocale('ar-EG');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
