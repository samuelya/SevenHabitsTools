import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { requiresNewScript } from './transition.logic';
import {
  SCRIPT_DECISIONS,
  SCRIPT_EFFECTS,
  SCRIPT_SOURCES,
  Script,
  ScriptDecision,
  ScriptEffect,
  ScriptFields,
  ScriptSource,
} from './transition.model';

/**
 * The form for one inherited script: text, source, effect and decision, plus the new-script
 * sentence and this-week situation required once the decision is to rewrite or stop it (issue
 * #51's acceptance criteria; required-ness itself is `transition.logic.ts`'s
 * `requiresNewScript()`/`isItemComplete()`, not enforced here beyond showing the error). Purely
 * presentational — `script` is the current value, `changed` emits the edited field(s) on every
 * change so the page can persist through `featureStore` immediately, the same autosave-on-edit
 * convention as `ReflectionEditor` (no explicit Save step).
 *
 * Focuses its own script field whenever `script().id` changes (issue #187), covering both the
 * editor's first open and a direct switch to a different script while it's already open (the
 * compact desktop list stays clickable in focus mode, reusing this same component instance) —
 * not `ExercisePage`'s `appEditorInitialFocus`/`EditorInitialFocus` marker: that directive is a
 * `contentChild` read on `ExercisePage` itself, which — like every Angular content query — can
 * only see nodes from the *page's own* template, not descend into a nested presentational
 * component's separate view. Placing the marker on this form's field would silently do nothing,
 * so this form owns its own initial focus instead (the playbook's "Page layout" section calls
 * this out for the next exercise whose editor is a nested component, which most will be).
 */
@Component({
  selector: 'app-transition-item-form',
  imports: [
    CdkTextareaAutosize,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './transition-item-form.html',
  styleUrl: './transition-item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransitionItemForm {
  private readonly injector = inject(Injector);

  readonly script = input.required<Script>();
  readonly changed = output<Partial<ScriptFields>>();
  readonly deleted = output<void>();

  protected readonly sources = SCRIPT_SOURCES;
  protected readonly effects = SCRIPT_EFFECTS;
  protected readonly decisions = SCRIPT_DECISIONS;

  protected readonly needsNewScript = computed(() => requiresNewScript(this.script().decision));

  private readonly scriptField = viewChild<ElementRef<HTMLTextAreaElement>>('scriptField');
  private readonly newScriptField = viewChild<ElementRef<HTMLTextAreaElement>>('newScriptField');

  private readonly touchedFields = signal<ReadonlySet<string>>(new Set());
  /** The last `script().id` `touchedFields` was reset for — set alongside it in the constructor
   * `effect` below, never read outside it. */
  private lastScriptId: string | null = null;
  /** The last `needsNewScript()` value, tracked so the focus-move effect below only fires on the
   * `false` → `true` transition (choosing Rewrite or Stop), never on every re-render while it's
   * already `true`. */
  private wasNeedingNewScript = false;

  constructor() {
    // The form is reused across selections (`TransitionPage`'s `@if (selectedScript(); as
    // script)` stays truthy while the id changes underneath), so `touchedFields` must be reset by
    // hand when the id changes — otherwise a blur on script A leaks its `role="alert"` errors onto
    // script B, which the user never touched (review finding on #51's PR). Guarded on the id
    // itself, not just any `script()` change, since every keystroke also produces a new `script()`
    // value.
    // Also focuses the script field on the same id change (issue #187) — the editor's first open
    // (`lastScriptId` still `null`) and a direct switch to a different script while the form
    // stays open (the compact desktop list stays clickable in focus mode, reusing this same
    // instance). `queueMicrotask`, not a direct call: focusing a real `matInput` synchronously
    // inside this effect re-enters Angular's own change detection (Material's `FocusMonitor`
    // reacts to the native `focus` event), which — empirically, this is what
    // `transition-item-form.spec.ts`'s "does not carry a touched error" regression test caught —
    // aborts the *rest* of this same `detectChanges()` pass, leaving the `touchedFields` reset
    // just above applied to the signal but not yet reflected in the template. Deferring the
    // native focus call past the current synchronous task sidesteps the same re-entrant tick
    // instead of trying to make it safe to call inline.
    effect(() => {
      const id = this.script().id;
      if (id === this.lastScriptId) {
        return;
      }
      this.lastScriptId = id;
      this.touchedFields.set(new Set());
      queueMicrotask(() => this.scriptField()?.nativeElement.focus());
    });

    // Choosing Rewrite or Stop reveals the new-script/situation fields and moves focus straight
    // into the new-script one (issue #187's acceptance criteria) — deferred to a render hook since
    // the fields are behind an `@if` that reacts to this same `needsNewScript()` change, and
    // focusing a not-yet-rendered element silently no-ops in a real browser (the same reason
    // `ExercisePage` defers its own focus moves with `afterNextRender`).
    effect(() => {
      const needsNewScript = this.needsNewScript();
      const revealed = needsNewScript && !this.wasNeedingNewScript;
      this.wasNeedingNewScript = needsNewScript;
      if (revealed) {
        afterNextRender(() => this.newScriptField()?.nativeElement.focus(), {
          injector: this.injector,
        });
      }
    });
  }

  /** Whether `field` has been blurred at least once — gates its own error paragraph (the
   * template's plain `<p role="alert">`, not `<mat-error>`: `mat-form-field` only shows that once
   * its control reports an `errorState`, which needs a real `NgControl` this simple
   * signal-driven form doesn't wire up). */
  protected isTouched(field: string): boolean {
    return this.touchedFields().has(field);
  }

  protected touch(field: string): void {
    if (!this.touchedFields().has(field)) {
      this.touchedFields.update((fields) => new Set(fields).add(field));
    }
  }

  protected onTextInput(event: Event): void {
    this.changed.emit({ text: (event.target as HTMLTextAreaElement).value });
  }

  protected onSourceChange(source: ScriptSource): void {
    this.changed.emit({ source });
  }

  protected onEffectChange(effect: ScriptEffect): void {
    this.changed.emit({ effect });
  }

  protected onDecisionChange(decision: ScriptDecision): void {
    this.changed.emit({ decision });
  }

  protected onNewScriptInput(event: Event): void {
    this.changed.emit({ newScript: (event.target as HTMLTextAreaElement).value });
  }

  protected onSituationInput(event: Event): void {
    this.changed.emit({ situation: (event.target as HTMLInputElement).value });
  }
}
