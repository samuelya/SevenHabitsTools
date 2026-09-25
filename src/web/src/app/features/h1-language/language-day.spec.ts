import { TestBed } from '@angular/core/testing';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { LanguageDay } from './language-day';
import { DayState } from './language.logic';
import { ListeningDay } from './language.model';

const DAY: ListeningDay = {
  id: 'd1',
  createdAt: '2026-03-10T09:00:00.000Z',
  updatedAt: '2026-03-10T09:00:00.000Z',
  startedAt: '2026-03-10T09:00:00.000Z',
};

function setUp(state: DayState) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('h1-language')],
  });
  const fixture = TestBed.createComponent(LanguageDay);
  fixture.componentRef.setInput('state', state);
  fixture.componentRef.setInput(
    'summary',
    state.kind === 'ended' ? { reactive: 3, proactive: 2, rewritten: 1 } : null,
  );
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('LanguageDay', () => {
  it('offers Start listening before any day, with an empty live region', () => {
    const { fixture, element } = setUp({ kind: 'none' });
    let started = 0;
    fixture.componentInstance.dayStarted.subscribe(() => started++);

    expect(element.querySelector('.banner-region')?.children).toHaveLength(0);
    (element.querySelector('.start-day-button') as HTMLButtonElement).click();
    expect(started).toBe(1);
  });

  it('shows the hours left and emits the running day id on End day', () => {
    const { fixture, element } = setUp({ kind: 'running', day: DAY, hoursLeft: 5 });
    const ended: string[] = [];
    fixture.componentInstance.dayEnded.subscribe((id) => ended.push(id));

    expect(element.querySelector('.day-banner')?.textContent).toContain(
      'Listening day running: 5 h left. Add every phrase you catch.',
    );
    (element.querySelector('.end-day-button') as HTMLButtonElement).click();
    expect(ended).toEqual(['d1']);
  });

  it('pluralises the hours left in en (one/other) and ar (one/two/few/many)', () => {
    const { fixture, element } = setUp({ kind: 'running', day: DAY, hoursLeft: 1 });
    const banner = () => element.querySelector('.day-banner')?.textContent ?? '';
    const show = (hours: number) => {
      fixture.componentRef.setInput('state', { kind: 'running', day: DAY, hoursLeft: hours });
      fixture.detectChanges();
      return banner();
    };
    expect(banner()).toContain('Listening day running: 1 h left.');
    expect(show(24)).toContain('Listening day running: 24 h left.');

    const transloco = TestBed.inject(TranslocoService);
    transloco.setActiveLang('ar');
    try {
      expect(show(1)).toContain('باقي ساعة واحدة.');
      expect(show(2)).toContain('باقي ساعتين.');
      expect(show(5)).toContain('باقي 5 ساعات.');
      expect(show(11)).toContain('باقي 11 ساعة.');
      expect(show(24)).toContain('باقي 24 ساعة.');
    } finally {
      transloco.setActiveLang('en');
    }
  });

  it('shows the ended summary and New day', () => {
    const { element } = setUp({ kind: 'ended', day: { ...DAY, endedAt: DAY.startedAt } });

    expect(element.querySelector('.day-banner')).toBeNull();
    expect(element.querySelector('.day-summary')?.textContent).toContain(
      '3 gave the choice away, 2 owned it. 1 rewritten.',
    );
    expect(element.querySelector('.new-day-button')).not.toBeNull();
  });
});
