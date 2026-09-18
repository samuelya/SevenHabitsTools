import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
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
 */
@Component({
  selector: 'app-transition-item-form',
  imports: [
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
  readonly script = input.required<Script>();
  readonly changed = output<Partial<ScriptFields>>();
  readonly deleted = output<void>();

  protected readonly sources = SCRIPT_SOURCES;
  protected readonly effects = SCRIPT_EFFECTS;
  protected readonly decisions = SCRIPT_DECISIONS;

  protected readonly needsNewScript = computed(() => requiresNewScript(this.script().decision));

  private readonly touchedFields = signal<ReadonlySet<string>>(new Set());

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
    this.changed.emit({ text: (event.target as HTMLInputElement).value });
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
