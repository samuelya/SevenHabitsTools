import { CdkTrapFocus } from '@angular/cdk/a11y';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ViewportRuler } from '@angular/cdk/scrolling';
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

/**
 * The one page scaffold every exercise page uses (issue #185, parent #184): a single visually
 * hidden `h1` (the toolbar title is the only visible one), the projected `[intro]`/body/`[footer]`
 * stacked in the page flow, and — while `editing` — a focus-mode editor that is a full-screen
 * panel on handset and a second grid column with no scroll of its own on desktop. Purely
 * presentational: routing (or a local signal) decides `editing`, and the page's own logic decides
 * what `editorClosed` does (clear a selection, navigate back to the list route).
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
})
export class ExercisePage implements EditorFocusHost {
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly viewportRuler = inject(ViewportRuler);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Rendered as the page's only, visually hidden, `h1`; the toolbar title is the visible one. */
  readonly title = input.required<string>();
  /** Focus mode: a full-screen panel on handset, a second column on desktop. */
  readonly editing = input(false);
  /** Shown in the editor header. */
  readonly editorTitle = input('');
  readonly editorStatus = input<'saved' | 'saving' | null>(null);
  /** The header's close button, or Escape while focus is inside the editor. */
  readonly editorClosed = output<void>();

  private readonly editorHeading = viewChild<ElementRef<HTMLElement>>('editorHeading');
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

    // Entering focus mode collapses the intro if it's expanded; exiting never re-expands it
    // (owner decision on #184) — this only ever calls `.set(false)`, never `true`.
    effect(() => {
      if (this.editing()) {
        this.introCard()?.expanded.set(false);
      }
    });

    // The desktop split grid (`.scaffold.editing:not(.handset)` in `exercise-page.scss`) needs a
    // real ceiling on its own height, not just the "at least this tall" floor every page's own
    // `:host` sets (`min-block-size: 100%`, kept loose so a short, non-split page's footer still
    // reaches `.page`'s bottom — issue #193). Without one, a tall column just grows the whole
    // scaffold past the viewport instead of scrolling in place (issue #213, review round 1). This
    // measures it directly instead of hardcoding the shell's toolbar height in the stylesheet,
    // which would silently drift the moment that height changes. `ViewportRuler`, not a hand-rolled
    // `resize` listener: it already runs outside the Angular zone and de-duplicates listeners
    // across every consumer.
    effect((onCleanup) => {
      if (!this.editing() || this.handset()) {
        return;
      }
      const recompute = () => this.updateSplitBlockSize();
      afterNextRender(recompute, { injector: this.injector });
      const subscription = this.viewportRuler.change(100).subscribe(recompute);
      onCleanup(() => {
        subscription.unsubscribe();
        this.host.nativeElement.style.removeProperty('--split-block-size');
      });
    });
  }

  /** Sets `--split-block-size` (read by `.scaffold.editing:not(.handset)`'s `block-size`) to this
   * host's own distance from the bottom of the visual viewport — the space the split grid
   * genuinely has, regardless of how tall either of its columns wants to be. */
  private updateSplitBlockSize(): void {
    const top = this.host.nativeElement.getBoundingClientRect().top;
    const available = this.viewportRuler.getViewportSize().height - top;
    this.host.nativeElement.style.setProperty('--split-block-size', `${Math.max(available, 0)}px`);
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
