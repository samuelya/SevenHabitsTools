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
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { HANDSET_QUERY } from '../../../core/layout/breakpoints';
import { ExercisePromptCard } from '../exercise-prompt-card/exercise-prompt-card';
import { EditorInitialFocus } from './editor-initial-focus.directive';

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
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './exercise-page.html',
  styleUrl: './exercise-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExercisePage {
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

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
  private readonly initialFocusTarget = contentChild(EditorInitialFocus, { read: ElementRef });
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

  constructor() {
    effect(() => {
      const editing = this.editing();
      if (editing === this.wasEditing) {
        return;
      }
      this.wasEditing = editing;
      if (editing) {
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

  protected close(): void {
    this.editorClosed.emit();
  }
}
