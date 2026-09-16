import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import '../../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { REFLECTION_DEBOUNCE_MS, ReflectionEditor } from './reflection-editor';

function setUp(value: string, updatedAt: string | null = null) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('exercise-kit')],
  });
  const fixture = TestBed.createComponent(ReflectionEditor);
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('label', 'Your reflection');
  fixture.componentRef.setInput('updatedAt', updatedAt);
  fixture.detectChanges();
  return fixture;
}

function textarea(fixture: { nativeElement: HTMLElement }): HTMLTextAreaElement {
  return fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
}

function typeInto(fixture: { nativeElement: HTMLElement }, text: string): void {
  const el = textarea(fixture);
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('ReflectionEditor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders the initial value', async () => {
    const fixture = setUp('What I noticed today.');
    // NgModel's DOM write lands in a microtask; let it flush before reading the element.
    await Promise.resolve();

    expect(textarea(fixture).value).toBe('What I noticed today.');
  });

  it('shows the character count', () => {
    const fixture = setUp('12345');

    expect(fixture.nativeElement.textContent).toContain('5 characters');
  });

  it('shows "not saved yet" when there is no updatedAt', () => {
    const fixture = setUp('');

    expect(fixture.nativeElement.textContent).toContain('Not saved yet');
  });

  it('shows the formatted saved time when updatedAt is given', () => {
    const fixture = setUp('', '2026-01-02T10:00:00.000Z');

    expect(fixture.nativeElement.textContent).toContain('Saved');
    expect(fixture.nativeElement.textContent).not.toContain('Not saved yet');
  });

  it('does not emit valueChange before the debounce elapses', async () => {
    const fixture = setUp('');
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));

    typeInto(fixture, 'a new reflection');
    await vi.advanceTimersByTimeAsync(REFLECTION_DEBOUNCE_MS / 2);

    expect(emitted).toEqual([]);
  });

  it('emits valueChange once the debounce elapses', async () => {
    const fixture = setUp('');
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));

    typeInto(fixture, 'a new reflection');
    await vi.advanceTimersByTimeAsync(REFLECTION_DEBOUNCE_MS);

    expect(emitted).toEqual(['a new reflection']);
  });

  it('coalesces rapid keystrokes into a single debounced emit', async () => {
    const fixture = setUp('');
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));

    typeInto(fixture, 'a');
    await vi.advanceTimersByTimeAsync(REFLECTION_DEBOUNCE_MS / 2);
    typeInto(fixture, 'ab');
    await vi.advanceTimersByTimeAsync(REFLECTION_DEBOUNCE_MS);

    expect(emitted).toEqual(['ab']);
  });
});
