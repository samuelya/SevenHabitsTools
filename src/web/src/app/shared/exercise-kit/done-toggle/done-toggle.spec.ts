import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import '../../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { DoneToggle } from './done-toggle';

function setUp(done: boolean, completedAt: string | null = null, disabled = false) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('exercise-kit')],
  });
  const fixture = TestBed.createComponent(DoneToggle);
  fixture.componentRef.setInput('done', done);
  fixture.componentRef.setInput('completedAt', completedAt);
  fixture.componentRef.setInput('disabled', disabled);
  fixture.detectChanges();
  return fixture;
}

describe('DoneToggle', () => {
  it('shows "Mark done" when not done', () => {
    const fixture = setUp(false);

    expect(fixture.nativeElement.textContent).toContain('Mark done');
  });

  it('shows "Reopen" and the completed time when done', () => {
    const fixture = setUp(true, '2026-01-02T10:00:00.000Z');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Reopen');
    expect(text).toContain('Completed');
  });

  it('emits toggled when clicked', () => {
    const fixture = setUp(false);
    const emitted: void[] = [];
    fixture.componentInstance.toggled.subscribe(() => emitted.push(undefined));

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(emitted).toHaveLength(1);
  });

  it('disables "Mark done" when disabled is set', () => {
    const fixture = setUp(false, null, true);
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('never disables "Reopen", even when disabled is set', () => {
    const fixture = setUp(true, '2026-01-02T10:00:00.000Z', true);
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
