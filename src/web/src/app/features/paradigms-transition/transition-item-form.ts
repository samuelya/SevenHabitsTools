import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  Signal,
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
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
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
 * **Who moves focus, and when** — one writer per moment, no racing (issue #187): the kit focuses
 * the script field when the *editor opens*, because the field carries `appEditorInitialFocus` and
 * that marker registers itself with `ExercisePage` (it works from inside a nested component's view
 * now; see the directive). This form only moves focus for the two transitions the kit cannot see,
 * both of which happen while the editor stays open: switching to a *different* script (the compact
 * desktop list stays clickable in focus mode, reusing this instance), and choosing Rewrite or Stop,
 * which reveals the new-script field. Neither fires on the first render, so the kit's open-focus is
 * never fought over.
 */
@Component({
  selector: 'app-transition-item-form',
  imports: [
    CdkTextareaAutosize,
    EditorInitialFocus,
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

  constructor() {
    // The form is reused across selections (`TransitionPage`'s `@if (selectedScript(); as
    // script)` stays truthy while the id changes underneath), so `touchedFields` must be reset by
    // hand when the id changes — otherwise a blur on script A leaks its `role="alert"` errors onto
    // script B, which the user never touched (review finding on #51's PR). Guarded on the id
    // itself, not just any `script()` change, since every keystroke also produces a new `script()`
    // value.
    onChange(
      computed(() => this.script().id),
      (_id, previous) => {
        this.touchedFields.set(new Set());
        if (previous === undefined) {
          // First render: the editor is opening, and the kit focuses `appEditorInitialFocus` (this
          // form's script field) itself. Focusing it here too would be a second writer for the
          // same moment, ordered only by the accident of `queueMicrotask` running after
          // `afterNextRender`.
          return;
        }
        // A switch to a different script with the editor already open. `queueMicrotask`, not a
        // direct call: focusing a real `matInput` synchronously inside an effect re-enters
        // Angular's own change detection (Material's `FocusMonitor` reacts to the native `focus`
        // event), which — empirically, this is what `transition-item-form.spec.ts`'s "does not
        // carry a touched error" regression test caught — aborts the *rest* of this same
        // `detectChanges()` pass, leaving the `touchedFields` reset just above applied to the
        // signal but not yet reflected in the template.
        queueMicrotask(() => this.scriptField()?.nativeElement.focus());
      },
    );

    // Choosing Rewrite or Stop reveals the new-script/situation fields and moves focus straight
    // into the new-script one (issue #187's acceptance criteria) — deferred to a render hook since
    // the fields are behind an `@if` that reacts to this same `needsNewScript()` change, and
    // focusing a not-yet-rendered element silently no-ops in a real browser (the same reason
    // `ExercisePage` defers its own focus moves with `afterNextRender`). Only on the `false` →
    // `true` transition: opening a script that is *already* set to Rewrite or Stop is the kit's
    // open-focus moment, not a reveal.
    onChange(this.needsNewScript, (needsNewScript, previous) => {
      if (needsNewScript && previous === false) {
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

/**
 * Runs `react` only when `source()` actually *changes* value, handing it the previous value —
 * `undefined` on the first run. Both of this form's reactions are to a transition rather than to a
 * value: `script()` is a brand-new object on every keystroke, so a plain `effect` would re-run
 * (and re-focus) constantly. Must be called from an injection context.
 */
function onChange<T>(source: Signal<T>, react: (value: T, previous: T | undefined) => void): void {
  let previous: T | undefined;
  effect(() => {
    const value = source();
    if (previous !== undefined && value === previous) {
      return;
    }
    const before = previous;
    previous = value;
    react(value, before);
  });
}
