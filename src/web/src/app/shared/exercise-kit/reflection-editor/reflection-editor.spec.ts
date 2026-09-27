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

      expect(fixture.nativeElement.querySelector('.status')).toBeNull();
    });
  });

  describe('session status (sessionStatus opted in)', () => {
    it('renders the live region from the start, empty, before the first keystroke of this session', () => {
      const fixture = setUp('An older reflection.', '2026-01-02T10:00:00.000Z', true);

      const region = fixture.nativeElement.querySelector('.status');
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

    it('keeps showing "Saving…" once the debounce elapses until the caller confirms the write landed', async () => {
      const fixture = setUp('', null, true);

      typeInto(fixture, 'a new reflection');
      await vi.advanceTimersByTimeAsync(REFLECTION_DEBOUNCE_MS);
      fixture.detectChanges();

      // Regression test for a review finding: this used to flip to "Saved" as soon as the
      // debounce fired, regardless of whether the write actually landed.
      expect(fixture.nativeElement.textContent).toContain('Saving');
      expect(fixture.nativeElement.textContent).not.toContain('Saved');
    });

    it('shows "Saved" once the caller confirms the debounced write landed', async () => {
      const fixture = setUp('', null, true);

      typeInto(fixture, 'a new reflection');
      await vi.advanceTimersByTimeAsync(REFLECTION_DEBOUNCE_MS);
      fixture.componentInstance.reportSaveOutcome(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Saved');
    });

    it('never claims "Saved" when the caller reports the write was refused (a read-only tab)', async () => {
      const fixture = setUp('', null, true);

      typeInto(fixture, 'a new reflection');
      await vi.advanceTimersByTimeAsync(REFLECTION_DEBOUNCE_MS);
      fixture.componentInstance.reportSaveOutcome(false);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain('Saved');
    });
  });

  describe('flush()', () => {
    it('emits a pending edit at once, and the debounce then emits nothing more', async () => {
      const fixture = setUp('');
      const emitted: string[] = [];
      fixture.componentInstance.valueChange.subscribe((text) => emitted.push(text));
      typeInto(fixture, 'Typed just now.');
      fixture.componentInstance.flush();
      expect(emitted).toEqual(['Typed just now.']);
      await vi.advanceTimersByTimeAsync(REFLECTION_DEBOUNCE_MS);
      fixture.destroy();
      expect(emitted).toEqual(['Typed just now.']);
    });

    it('emits nothing with no pending edit', () => {
      const fixture = setUp('Saved already.');
      const emitted: string[] = [];
      fixture.componentInstance.valueChange.subscribe((text) => emitted.push(text));
      fixture.componentInstance.flush();
      expect(emitted).toEqual([]);
    });
  });

  describe('promptId', () => {
    it('adds the caller-supplied prompt id alongside its own status id in aria-describedby', () => {
      const fixture = setUp('', null, true);
      fixture.componentRef.setInput('promptId', 'reflection-prompt');
      fixture.detectChanges();

      const statusId = fixture.nativeElement.querySelector('.status').id;
      expect(textarea(fixture).getAttribute('aria-describedby')).toBe(
        `reflection-prompt ${statusId}`,
      );
    });

    it('falls back to just its own id when no promptId is given', () => {
      const fixture = setUp('', null, true);

      const statusId = fixture.nativeElement.querySelector('.status').id;
      expect(textarea(fixture).getAttribute('aria-describedby')).toBe(statusId);
    });
  });

  describe('ids', () => {
    it('gives each instance its own status and hint ids, so aria-describedby never collides', () => {
      const withStatus = [setUp('', null, true), TestBed.createComponent(ReflectionEditor)];
      withStatus[1].componentRef.setInput('value', '');
      withStatus[1].componentRef.setInput('label', 'Another reflection');
      withStatus[1].componentRef.setInput('sessionStatus', true);
      withStatus[1].detectChanges();

      const [first, second] = withStatus.map((fixture) => {
        const describedBy = textarea(fixture).getAttribute('aria-describedby') ?? '';
        expect(fixture.nativeElement.querySelector(`#${describedBy}`)).not.toBeNull();
        return describedBy;
      });
      expect(first).not.toBe(second);
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

  it('with immediate, emits each keystroke at once, shows no "Saving…" and leaves nothing to flush (issue #217)', () => {
    const fixture = setUp('', null, true);
    fixture.componentRef.setInput('immediate', true);
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));

    typeInto(fixture, 'a');
    typeInto(fixture, 'ab');
    fixture.detectChanges();
    expect(emitted).toEqual(['a', 'ab']);
    expect(fixture.nativeElement.textContent).not.toContain('Saving');

    fixture.componentInstance.reportSaveOutcome(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Saved');

    fixture.destroy();
    vi.advanceTimersByTime(REFLECTION_DEBOUNCE_MS);
    expect(emitted).toEqual(['a', 'ab']);
  });

  it('exposes the typed text on every keystroke, ahead of the debounce (issue #61)', () => {
    const fixture = setUp('Draft', null, true);
    const editor = fixture.componentInstance;
    expect(editor.liveText()).toBe('Draft');

    typeInto(fixture, 'Draft two');

    expect(editor.liveText()).toBe('Draft two');
  });

  describe('announce() and scrollToEnd() (issue #61)', () => {
    function status(fixture: { nativeElement: HTMLElement }): string {
      return (fixture.nativeElement.querySelector('.status') as HTMLElement).textContent!.trim();
    }

    it('shows a caller message in the live status line until the next keystroke', () => {
      const fixture = setUp('Draft', null, true);
      fixture.componentInstance.announce('Added to the end of your draft.');
      fixture.detectChanges();
      expect(status(fixture)).toBe('Added to the end of your draft.');
      expect(fixture.nativeElement.querySelector('.status').getAttribute('aria-live')).toBe(
        'polite',
      );

      typeInto(fixture, 'Draft!');
      fixture.detectChanges();
      expect(status(fixture)).toBe('Saving…');
    });

    it('re-announces the same message by clearing it for one render', () => {
      const fixture = setUp('Draft', null, true);
      const editor = fixture.componentInstance;
      editor.announce('Added.');
      fixture.detectChanges();
      editor.announce('Added.');
      fixture.detectChanges();
      expect(status(fixture)).toBe('Added.');
    });

    it('scrolls the field to its end after the next render', () => {
      const fixture = setUp('Draft', null, true);
      const field = textarea(fixture);
      // jsdom does no layout: give the field a height and a plain, writable scroll position.
      Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 900 });
      Object.defineProperty(field, 'scrollTop', { configurable: true, writable: true, value: 0 });
      fixture.componentInstance.scrollToEnd();
      fixture.detectChanges();
      TestBed.tick();
      expect(field.scrollTop).toBe(900);
    });
  });
});
