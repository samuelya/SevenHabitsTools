import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTranslocoScope } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ExercisePromptCard } from '../exercise-prompt-card/exercise-prompt-card';
import { EditorInitialFocus } from './editor-initial-focus.directive';
import { EditorStatus, ExercisePage } from './exercise-page';

@Component({
  selector: 'app-host',
  imports: [ExercisePage, ExercisePromptCard],
  template: `
    <app-exercise-page
      title="Circle of Influence"
      [editing]="editing()"
      editorTitle="Editing script"
      [editorStatus]="editorStatus()"
      (editorClosed)="onClosed()"
    >
      <app-exercise-prompt-card intro prompt="List what you can control." />
      <button #addButton type="button" class="body-content">Add</button>
      <div editor>
        <input class="editor-field" />
      </div>
      <div footer class="footer-content">Footer content</div>
    </app-exercise-page>
  `,
})
class HostComponent {
  readonly editing = signal(false);
  readonly editorStatus = signal<EditorStatus>(null);
  closedCount = 0;

  onClosed(): void {
    this.closedCount++;
  }
}

/** A body column with a selected row, the kit's one selection marker (`aria-pressed="true"`, as
 * `ExerciseList` and `AssessmentHistoryList` both render it). */
@Component({
  selector: 'app-selected-row-host',
  imports: [ExercisePage],
  template: `
    <app-exercise-page title="Circle of Influence" [editing]="editing()" editorTitle="Editing">
      <button type="button" class="row" aria-pressed="false">First</button>
      <button type="button" class="row selected" aria-pressed="true">Last</button>
      <div editor><input class="editor-field" /></div>
      <div footer>Footer content</div>
    </app-exercise-page>
  `,
})
class SelectedRowHostComponent {
  readonly editing = signal(false);
}

@Component({
  selector: 'app-initial-focus-host',
  imports: [ExercisePage, EditorInitialFocus],
  template: `
    <app-exercise-page title="Circle of Influence" [editing]="editing()" editorTitle="Editing">
      <button type="button" class="body-content">Add</button>
      <div editor>
        <input class="not-first" />
        <input class="first-field" appEditorInitialFocus />
      </div>
    </app-exercise-page>
  `,
})
class InitialFocusHostComponent {
  readonly editing = signal(false);
}

/** A separate presentational component for the editor — what most exercises' editors actually
 * are (`TransitionItemForm`), and what a `contentChild` query on `ExercisePage` could never see
 * into (issue #187). */
@Component({
  selector: 'app-nested-editor',
  imports: [EditorInitialFocus],
  template: `<input class="nested-field" appEditorInitialFocus />`,
})
class NestedEditorComponent {}

@Component({
  selector: 'app-nested-focus-host',
  imports: [ExercisePage, NestedEditorComponent],
  template: `
    <app-exercise-page title="Circle of Influence" [editing]="editing()" editorTitle="Editing">
      <button type="button" class="body-content">Add</button>
      <div editor><app-nested-editor /></div>
    </app-exercise-page>
  `,
})
class NestedFocusHostComponent {
  readonly editing = signal(false);
}

function configureTestBed(handset: boolean): void {
  const state: BreakpointState = { matches: handset, breakpoints: {} };
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('exercise-kit'),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of(state), isMatched: () => handset },
      },
    ],
  });
}

describe('ExercisePage', () => {
  it('renders a single visually hidden h1 with the title', () => {
    configureTestBed(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const headings = host.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe('Circle of Influence');
    expect(headings[0].classList).toContain('visually-hidden');
  });

  it('stacks intro, body and footer in the page flow when not editing, with no editor panel', () => {
    configureTestBed(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.editor-panel')).toBeNull();
    expect(host.textContent).toContain('List what you can control.');
    expect(host.querySelector('.footer-content')).not.toBeNull();
    expect(host.querySelector('.body')?.getAttribute('inert')).toBeNull();
  });

  it('shows the full-screen editor on handset when editing, hides the footer and makes the body inert', () => {
    configureTestBed(true);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.editor-panel')).not.toBeNull();
    expect(host.querySelector('.editor-close mat-icon')?.textContent).toBe('arrow_back');
    expect(host.querySelector('.footer-content')).toBeNull();
    expect(host.querySelector('.body')?.getAttribute('inert')).toBe('');
  });

  it('shows the two-column editor on desktop when editing, and keeps the footer visible', () => {
    configureTestBed(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.editor-panel')).not.toBeNull();
    expect(host.querySelector('.editor-close mat-icon')?.textContent).toBe('close');
    expect(host.querySelector('.footer-content')).not.toBeNull();
    expect(host.querySelector('.body')?.getAttribute('inert')).toBeNull();
  });

  it('pins the body and editor to the same grid row, above the footer, on desktop (#188)', () => {
    // Sparse grid auto-placement would otherwise put the editor (column 2) in row 2, under the
    // sticky footer (row 1), since the footer sits between body and editor in DOM order.
    configureTestBed(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const body = host.querySelector('.body') as HTMLElement;
    const editorPanel = host.querySelector('.editor-panel') as HTMLElement;
    const footer = host.querySelector('.footer-slot') as HTMLElement;

    expect(getComputedStyle(body).gridRow).toBe('1');
    // `1 / 2`, not `1`: the editor panel is absolutely positioned (issue #213), and an abspos grid
    // item's containing block only clips to the track's far edge when both lines are given.
    expect(getComputedStyle(editorPanel).gridRow).toBe('1/2');
    expect(getComputedStyle(footer).gridRow).toBe('2');
  });

  it('marks its host `fills-page` only while the desktop split grid is up (#213)', () => {
    // The whole of this component's side of the height contract: `shell.scss`'s
    // `.page > *:has(> .fills-page)` rule gives the routed page host `.page`'s own height while
    // this class is on, so the split grid has a definite height to divide into rows instead of
    // growing past the scroll container. Handset focus mode is a full-screen fixed panel that
    // needs none of it, and a page that isn't editing must keep growing with its content (#193).
    configureTestBed(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const page = fixture.debugElement.query(By.directive(ExercisePage))
      .nativeElement as HTMLElement;
    expect(page.classList).not.toContain('fills-page');

    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();
    expect(page.classList).toContain('fills-page');

    fixture.componentInstance.editing.set(false);
    fixture.detectChanges();
    expect(page.classList).not.toContain('fills-page');
  });

  it('never marks its host `fills-page` on handset, where the editor is a full-screen panel', () => {
    configureTestBed(true);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();
    const page = fixture.debugElement.query(By.directive(ExercisePage))
      .nativeElement as HTMLElement;

    expect(page.querySelector('.editor-panel')).not.toBeNull();
    expect(page.classList).not.toContain('fills-page');
  });

  it('scrolls the selected row back into view when the desktop split editor opens (#213)', () => {
    // Opening the editor turns the body column into its own scroll container at `scrollTop: 0`,
    // so a row picked after scrolling the list would otherwise be carried out of sight along with
    // the master-detail context. `scrollIntoView` isn't implemented in this DOM, so the selected
    // row carries its own.
    configureTestBed(false);
    const fixture = TestBed.createComponent(SelectedRowHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const selected = host.querySelector('.selected') as HTMLElement;
    const scrollIntoView = vi.fn();
    selected.scrollIntoView = scrollIntoView;
    const unselected = host.querySelector('.row:not(.selected)') as HTMLElement;
    unselected.scrollIntoView = vi.fn();

    expect(scrollIntoView).not.toHaveBeenCalled();

    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    // `block: 'nearest'`: an already-visible row, and every ancestor scroller (`.page` included),
    // are left exactly where they are.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    expect(unselected.scrollIntoView).not.toHaveBeenCalled();
  });

  it('ignores a pressed toggle projected into the intro slot, above the list (#213 review)', () => {
    // `.intro-slot` renders above `.content-slot` in `.body`, so an unscoped query for the kit's
    // selection marker would find a pressed toggle there first and scroll it instead of the
    // selected row — silently, with no test failure, the first time a page projects one.
    configureTestBed(false);
    const fixture = TestBed.createComponent(SelectedRowHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const introToggle = document.createElement('button');
    introToggle.setAttribute('aria-pressed', 'true');
    introToggle.scrollIntoView = vi.fn();
    host.querySelector('.intro-slot')!.prepend(introToggle);
    const selected = host.querySelector('.selected') as HTMLElement;
    selected.scrollIntoView = vi.fn();

    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    expect(introToggle.scrollIntoView).not.toHaveBeenCalled();
    expect(selected.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('never scrolls the body column on handset, where the editor covers it entirely', () => {
    configureTestBed(true);
    const fixture = TestBed.createComponent(SelectedRowHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const selected = host.querySelector('.selected') as HTMLElement;
    selected.scrollIntoView = vi.fn();

    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    expect(selected.scrollIntoView).not.toHaveBeenCalled();
  });

  it('collapses the intro card on entering focus mode and never re-expands it on exit', () => {
    configureTestBed(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const promptCard = fixture.debugElement.query(By.directive(ExercisePromptCard))
      .componentInstance as ExercisePromptCard;
    expect(promptCard.expanded()).toBe(true);

    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();
    expect(promptCard.expanded()).toBe(false);

    fixture.componentInstance.editing.set(false);
    fixture.detectChanges();
    expect(promptCard.expanded()).toBe(false);
  });

  it('emits editorClosed on Escape while focus is inside the editor', () => {
    configureTestBed(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const field = host.querySelector('.editor-field') as HTMLInputElement;

    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );

    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('does not emit editorClosed on Escape outside the editor', () => {
    configureTestBed(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const addButton = host.querySelector('.body-content') as HTMLButtonElement;

    addButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );

    expect(fixture.componentInstance.closedCount).toBe(0);
  });

  it('moves focus to the editor heading on open and back to the trigger on close, on handset', () => {
    configureTestBed(true);
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);
    fixture.detectChanges();

    const trigger = host.querySelector('.body-content') as HTMLButtonElement;
    trigger.focus();

    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();
    expect((document.activeElement as HTMLElement)?.className).toBe('editor-title');

    fixture.componentInstance.editing.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);

    host.remove();
  });

  it('moves focus to the editor heading on open and back to the trigger on close, on desktop', () => {
    configureTestBed(false);
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);
    fixture.detectChanges();

    const trigger = host.querySelector('.body-content') as HTMLButtonElement;
    trigger.focus();

    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();
    expect((document.activeElement as HTMLElement)?.className).toBe('editor-title');

    fixture.componentInstance.editing.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);

    host.remove();
  });

  it('moves focus into the editor panel when the handset breakpoint is crossed while already editing', () => {
    // The `wasEditing` transition alone misses this: `editing()` doesn't change here, only
    // `handset()` does. Without tracking that crossing too, `bodyInert` turning on (body is not
    // inert on desktop, so focus is free to sit there while editing) blurs focus straight to
    // `document.body` instead of moving it into the now full-screen editor panel.
    let matchesHandset = false;
    const state$ = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideTranslocoScope('exercise-kit'),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => state$.asObservable(), isMatched: () => matchesHandset },
        },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);

    const trigger = host.querySelector('.body-content') as HTMLButtonElement;
    trigger.focus();

    // Opens on desktop: focus moves into the two-column editor.
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();
    expect((document.activeElement as HTMLElement)?.className).toBe('editor-title');

    // The user tabs back into the still-visible (not inert on desktop) body/list column.
    const bodyContent = host.querySelector('.body-content') as HTMLButtonElement;
    bodyContent.focus();
    expect(document.activeElement).toBe(bodyContent);

    // The window narrows below the handset breakpoint while still editing (a resize, fold or
    // rotation) — `editing()` itself doesn't change, only `handset()` does.
    matchesHandset = true;
    state$.next({ matches: true, breakpoints: {} });
    fixture.detectChanges();
    expect((document.activeElement as HTMLElement)?.className).toBe('editor-title');

    // Closing still restores focus to the original trigger, not to whatever was focused in the
    // body right before the handset crossing — the crossing must not have overwritten it.
    fixture.componentInstance.editing.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);

    host.remove();
  });

  it('moves focus to the element marked [appEditorInitialFocus] instead, when the editor projects one', () => {
    configureTestBed(false);
    const fixture = TestBed.createComponent(InitialFocusHostComponent);
    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);
    fixture.detectChanges();

    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    expect((document.activeElement as HTMLElement)?.className).toBe('first-field');

    host.remove();
  });

  it('moves focus to a marked field inside a nested editor component (#187)', () => {
    configureTestBed(false);
    const fixture = TestBed.createComponent(NestedFocusHostComponent);
    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);
    fixture.detectChanges();

    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    expect((document.activeElement as HTMLElement)?.className).toBe('nested-field');

    host.remove();
  });

  it('traps focus inside the full-screen editor panel on handset', () => {
    // The panel covers the app's toolbar and bottom navigation rather than containing them, and
    // `bodyInert` only removes this page's own body from the tab order — so without a trap, Tab
    // reaches the shell's controls underneath. The CDK trap marks its reach with tabbable anchors
    // around the panel.
    configureTestBed(true);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.cdk-focus-trap-anchor[tabindex="0"]',
      ),
    ).toHaveLength(2);
  });

  it('does not trap focus in the desktop editor column, where the list beside it stays reachable', () => {
    configureTestBed(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.cdk-focus-trap-anchor[tabindex="0"]',
      ),
    ).toHaveLength(0);
  });
});
