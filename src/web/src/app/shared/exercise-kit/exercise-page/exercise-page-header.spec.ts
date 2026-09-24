import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { of } from 'rxjs';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { EditorStatus, ExercisePage } from './exercise-page';

/** The editor header: its status, close and Done buttons (issue #217), kept apart from
 * `exercise-page.spec.ts` to hold both files under the 500-line rule. */
@Component({
  selector: 'app-header-host',
  imports: [ExercisePage],
  template: `
    <app-exercise-page
      title="Transition"
      [editing]="true"
      editorTitle="New script"
      [editorStatus]="editorStatus()"
      (editorClosed)="onClosed()"
    >
      <div editor><input class="editor-field" /></div>
    </app-exercise-page>
  `,
})
class HeaderHostComponent {
  readonly editorStatus = signal<EditorStatus>('new');
  closedCount = 0;

  onClosed(): void {
    this.closedCount++;
  }
}

function setUp(): HeaderHostComponent & { header: HTMLElement; detectChanges: () => void } {
  const state: BreakpointState = { matches: false, breakpoints: {} };
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('exercise-kit'),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of(state), isMatched: () => false },
      },
    ],
  });
  const fixture = TestBed.createComponent(HeaderHostComponent);
  fixture.detectChanges();
  const header = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
    '.editor-header',
  )!;
  return Object.assign(fixture.componentInstance, {
    header,
    detectChanges: () => fixture.detectChanges(),
  });
}

describe('ExercisePage editor header', () => {
  it('shows the saving and saved status text through the aria-live region', () => {
    const host = setUp();
    host.editorStatus.set('saving');
    host.detectChanges();
    expect(host.header.querySelector('.editor-status')?.textContent?.trim()).toBe('Saving…');

    host.editorStatus.set('saved');
    host.detectChanges();
    expect(host.header.querySelector('.editor-status')?.textContent?.trim()).toBe('Saved');
  });

  it('emits editorClosed when the close button is clicked', () => {
    const host = setUp();
    host.header.querySelector<HTMLButtonElement>('.editor-close')!.click();
    expect(host.closedCount).toBe(1);
  });

  it('shows "New" for a draft no record exists for yet', () => {
    const { header } = setUp();
    expect(header.querySelector('.editor-status')?.textContent?.trim()).toBe('New');
  });

  it('has a never-disabled Done button after the status that closes the editor', () => {
    const host = setUp();
    const done = host.header.querySelector<HTMLButtonElement>('.editor-done')!;
    expect(done.textContent?.trim()).toBe('Done');
    expect(done.disabled).toBe(false);
    // Last in the header row, so it sits at the inline end in both directions.
    expect(host.header.lastElementChild).toBe(done);
    expect(done.previousElementSibling?.classList).toContain('editor-status');

    // Done emits `editorClosed` itself, so no page can bind the button to nothing.
    done.click();
    expect(host.closedCount).toBe(1);
  });
});
