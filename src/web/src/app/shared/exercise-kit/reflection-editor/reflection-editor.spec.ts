import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import '../../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { REFLECTION_DEBOUNCE_MS, ReflectionEditor } from './reflection-editor';

function setUp(value: string, updatedAt: string | null = null, sessionStatus = false) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('exercise-kit')],
  });
  const fixture = TestBed.createComponent(ReflectionEditor);
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('label', 'Your reflection');
  fixture.componentRef.setInput('updatedAt', updatedAt);
  fixture.componentRef.setInput('sessionStatus', sessionStatus);
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

  describe('default caption (sessionStatus not set)', () => {
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

    it('never renders the session-status live region', () => {
      const fixture = setUp('');

      expect(fixture.nativeElement.querySelector('#reflection-status')).toBeNull();
    });
  });

  describe('session status (sessionStatus opted in)', () => {
    it('renders the live region from the start, empty, before the first keystroke of this session', () => {
      const fixture = setUp('An older reflection.', '2026-01-02T10:00:00.000Z', true);

      const region = fixture.nativeElement.querySelector('#reflection-status');
      expect(region).not.toBeNull();
      expect(region?.getAttribute('aria-live')).toBe('polite');
      expect(region?.textContent?.trim()).toBe('');
      expect(fixture.nativeElement.textContent).not.toContain('Saved');
      expect(fixture.nativeElement.textContent).not.toContain('Saving');
    });

    it('shows "Saving…" right after the first keystroke, before the debounce elapses', async () => {
      const fixture = setUp('', null, true);

      typeInto(fixture, 'a');
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Saving');
    });

    it('shows "Saved" once the debounce elapses', async () => {
      const fixture = setUp('', null, true);

      typeInto(fixture, 'a new reflection');
      await vi.advanceTimersByTimeAsync(REFLECTION_DEBOUNCE_MS);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Saved');
    });
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

  it('flushes a pending edit on destroy instead of dropping it', () => {
    const fixture = setUp('');
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));

    typeInto(fixture, 'edited before navigating away');
    fixture.destroy();

    expect(emitted).toEqual(['edited before navigating away']);
  });

  it('does not emit on destroy when there is no pending edit', () => {
    const fixture = setUp('unchanged');
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));

    fixture.destroy();

    expect(emitted).toEqual([]);
  });
});
