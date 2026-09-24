import { CdkTrapFocus } from '@angular/cdk/a11y';
import { BreakpointObserver } from '@angular/cdk/layout';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  contentChild,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { HANDSET_QUERY } from '../../../core/layout/breakpoints';
import { ExercisePromptCard } from '../exercise-prompt-card/exercise-prompt-card';
import { EDITOR_FOCUS_HOST, EditorFocusHost } from './editor-initial-focus.directive';

/** The editor header's status (issue #217): `'new'` while the editor shows an in-memory draft no
 * record exists for yet, `'saved'` once it does, `'saving'` for a page whose writes are async,
 * `null` for no status at all. */
export type EditorStatus = 'new' | 'saved' | 'saving' | null;

/**
 * The one page scaffold every exercise page uses (issue #185, parent #184): a single visually
 * hidden `h1` (the toolbar title is the only visible one), the projected `[intro]`/body/`[footer]`
 * stacked in the page flow, and — while `editing` — a focus-mode editor that is a full-screen
 * panel on handset and a second grid column, scrolling on its own inside the page area, on
 * desktop (issue #213). Purely presentational: routing (or a local signal) decides `editing`, and
 * the page's own logic decides what `editorClosed` does (clear a selection, navigate back to the
 * list route).
 *
 * The focus-move-in-on-open/focus-return-on-close approach (`afterNextRender`, capture the
 * trigger element before moving focus away from it) is ported from `ExerciseDetail`
 * (issues #173/#174/#176) rather than rewritten, now driving both breakpoints instead of just
 * handset, since focus mode replaces the old drawer/list swap entirely.
 */
@Component({
  selector: 'app-exercise-page',
  imports: [CdkTrapFocus, MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './exercise-page.html',
  styleUrl: './exercise-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: EDITOR_FOCUS_HOST, useExisting: forwardRef(() => ExercisePage) }],
  // The whole of this component's "how tall is the space I have" logic (issue #213): while the
  // desktop split grid is up, the routed page host above this one must stop growing with its
  // content and be exactly as tall as `.page`, the shell's scroll container. `shell.scss` does
  // that with one rule keyed on this class (`.page > *:has(> .fills-page)`); this component only
  // states *when* it needs it, and never measures or reaches out of its own host.
  host: { '[class.fills-page]': 'splitEditing()' },
})
export class ExercisePage implements EditorFocusHost {
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** Rendered as the page's only, visually hidden, `h1`; the toolbar title is the visible one. */
  readonly title = input.required<string>();
  /** Focus mode: a full-screen panel on handset, a second column on desktop. */
  readonly editing = input(false);
  /** Shown in the editor header. */
  readonly editorTitle = input('');
  readonly editorStatus = input<EditorStatus>(null);
  /** The header's close button, its primary "Done" button (issue #217: the explicit finish,
   * never blocked on validation), or Escape while focus is inside the editor. One output, so no
   * page can ship a Done button that does nothing. */
  readonly editorClosed = output<void>();

  private readonly editorHeading = viewChild<ElementRef<HTMLElement>>('editorHeading');
  /** The list/body column — its own scroll container while the desktop split editor is up (see
   * `revealSelectedRow`). */
  private readonly bodyColumn = viewChild<ElementRef<HTMLElement>>('bodyColumn');
  /** Set by whichever `[appEditorInitialFocus]` marker is alive inside the open editor, wherever
   * it sits in the projected tree (see that directive on why this is a registration, not a
   * `contentChild` query). */
  private readonly initialFocusTarget = signal<ElementRef<HTMLElement> | null>(null);
  /** Used to collapse the intro on entering focus mode (below) — not to render it: that stays a
   * plain `<ng-content>` projection, so the page is free to project something else in `[intro]`. */
  private readonly introCard = contentChild(ExercisePromptCard);

  protected readonly handset = toSignal(
    this.breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(HANDSET_QUERY) },
  );

  /** Focus mode as a second column beside the body, i.e. everywhere but handset (where it is a
   * full-screen panel instead and needs none of this): the one state in which the scaffold is a
   * grid that has to fit the page area rather than grow with its tallest column. */
  protected readonly splitEditing = computed(() => this.editing() && !this.handset());
  /** Hidden entirely on handset while editing, so it never sits behind the full-screen panel. */
  protected readonly showFooter = computed(() => !(this.handset() && this.editing()));
  /** `inert`, not just visually behind the panel, so a screen reader can't land there either
   * (mirrors what `MatDrawerContent` did for `ExerciseDetail`). */
  protected readonly bodyInert = computed(() => this.handset() && this.editing());

  /** The element focused before entering focus mode, restored on close (ported from #174). */
  private triggerElement: HTMLElement | null = null;
  /** Not `editing()` alone: a resize/fold crossing the handset breakpoint while already editing
   * must still be treated as an open/close transition here, exactly like `ExerciseDetail`'s own
   * `wasHandsetOpen` (#174's follow-up) — otherwise capture or restore silently no-ops. */
  private wasEditing = false;
  /** Tracks the combined "editing on handset" state so a resize/fold that crosses *into* handset
   * while already editing is caught even though `editing()` itself didn't change: `bodyInert`
   * (above) turning on forces focus straight to `document.body` (the spec's `inert`-blurs-focus
   * behaviour), same as `ExerciseDetail`'s `wasHandsetOpen` does for its drawer. */
  private wasHandsetEditing = false;

  constructor() {
    effect(() => {
      const editing = this.editing();
      const handsetEditing = this.handset() && editing;
      const openedFocusMode = editing && !this.wasEditing;
      const closedFocusMode = !editing && this.wasEditing;
      const crossedIntoHandsetWhileEditing = editing && handsetEditing && !this.wasHandsetEditing;
      this.wasEditing = editing;
      this.wasHandsetEditing = handsetEditing;
      if (!openedFocusMode && !closedFocusMode && !crossedIntoHandsetWhileEditing) {
        return;
      }
      // Only a genuine open captures the trigger; crossing into handset mid-edit must leave the
      // original trigger alone so close still restores focus to it, not to whatever was focused
      // in the body right before `bodyInert` blurred it.
      if (openedFocusMode) {
        this.triggerElement = this.document.activeElement as HTMLElement | null;
      }
      // Deferred to a render hook, not run inline here: the `@if` that renders the editor panel
      // (or removes it) reacts to the same `editing()` change, and focusing a not-yet-rendered or
      // still-hidden element silently no-ops in a real browser (issue #176, ported from
      // `ExerciseDetail`).
      afterNextRender(() => this.moveFocus(editing), { injector: this.injector });
    });

    // Opening the split editor makes `.body` a scroll container (`exercise-page.scss`) that
    // starts at `scrollTop: 0`, so the row the user just picked after scrolling the list would
    // jump out of sight and take the master-detail context with it. Same render-hook reasoning as
    // the focus move above: the class that creates that scroll container is applied by the render
    // this effect is reacting to, so the scroll has to happen after it.
    effect(() => {
      if (!this.splitEditing()) {
        return;
      }
      afterNextRender(() => this.revealSelectedRow(), { injector: this.injector });
    });

    // Entering focus mode collapses the intro if it's expanded; exiting never re-expands it
    // (owner decision on #184) — this only ever calls `.set(false)`, never `true`.
    effect(() => {
      if (this.editing()) {
        this.introCard()?.expanded.set(false);
      }
    });
  }

  private moveFocus(editing: boolean): void {
    if (editing) {
      const target =
        this.initialFocusTarget()?.nativeElement ?? this.editorHeading()?.nativeElement;
      target?.focus({ preventScroll: true });
    } else {
      this.triggerElement?.focus();
      this.triggerElement = null;
    }
  }

  /** Scrolls the selected list row back into view inside the body column's brand-new scroll
   * container. `[aria-pressed="true"]` is the kit's one selection marker — `ExerciseList` and
   * `AssessmentHistoryList` both use it, for the reasons their own templates give — so this needs
   * no knowledge of either. Scoped to `.content-slot`, not the whole body column: `.intro-slot`
   * renders above it and projects whatever the page puts in `[intro]`, so an unscoped query would
   * silently grab the first pressed toggle a future intro slot projects instead of the row.
   * `block: 'nearest'` leaves an already-visible row (and every ancestor scroller, `.page`
   * included) alone. The state is re-read here rather than captured when the hook was scheduled: a
   * close that lands before the callback runs (fast open/close, or a route change that does both)
   * must not scroll a column that is no longer a scroll container. */
  private revealSelectedRow(): void {
    if (!this.splitEditing()) {
      return;
    }
    const selected = this.bodyColumn()?.nativeElement.querySelector<HTMLElement>(
      '.content-slot [aria-pressed="true"]',
    );
    selected?.scrollIntoView({ block: 'nearest' });
  }

  registerInitialFocus(element: ElementRef<HTMLElement>): void {
    this.initialFocusTarget.set(element);
  }

  unregisterInitialFocus(element: ElementRef<HTMLElement>): void {
    if (this.initialFocusTarget() === element) {
      this.initialFocusTarget.set(null);
    }
  }

  protected close(): void {
    this.editorClosed.emit();
  }
}
