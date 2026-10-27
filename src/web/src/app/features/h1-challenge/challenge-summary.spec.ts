import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope, TranslocoService } from '@jsverse/transloco';
import { DocumentStore } from '../../core/data/document.store';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import '../settings/settings.model';
import { ChallengeSummary } from './challenge-summary';
import type { ChallengeSummary as ChallengeSummaryData } from './challenge.logic';

function setUp(summary: ChallengeSummaryData) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('h1-challenge')],
  });
  const fixture = TestBed.createComponent(ChallengeSummary);
  fixture.componentRef.setInput('summary', summary);
  fixture.detectChanges();
  return fixture;
}

describe('ChallengeSummary', () => {
  it('shows the streak in Arabic-Indic numerals with that setting (#305)', () => {
    const fixture = setUp({ streak: 11, checkedIn: 0, promises: null });
    TestBed.inject(TranslocoService).setActiveLang('ar');
    TestBed.inject(DocumentStore).update('settings', () => ({
      language: 'ar',
      numerals: 'arabic',
    }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('١١');
    expect(text).not.toMatch(/[0-9]/);
  });
});
