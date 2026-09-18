import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import { addArea, removeArea, renameArea, setAreaLevel, setAreaNote } from './maturity.logic';
import {
  MATURITY_LEVELS,
  MaturityArea,
  MaturityAssessment,
  MaturityAssessmentFields,
  MaturityLevel,
} from './maturity.model';

/**
 * The editor for one assessment (issue #50): every area's name, its three-point rating (no
 * default) and an optional note, plus adding, renaming and removing areas. Purely presentational —
 * `assessment` is the current value, `changed` emits the edited field(s) so the page persists
 * through `featureStore` immediately, the same autosave-on-edit convention `TransitionItemForm`
 * and `PcBalanceAuditForm` use.
 */
@Component({
  selector: 'app-maturity-assessment-form',
  imports: [
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    TranslocoPipe,
  ],
  templateUrl: './maturity-assessment-form.html',
  styleUrl: './maturity-assessment-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaturityAssessmentForm {
  readonly assessment = input.required<MaturityAssessment>();
  /** Translated labels for the six built-in area keys, from the page's `translateSignal` (kept
   * out of this pure-presentational component so it stays testable without a translation
   * service). */
  readonly builtInLabels = input.required<Record<string, string>>();
  readonly changed = output<Partial<MaturityAssessmentFields>>();

  protected readonly levels = MATURITY_LEVELS;
  protected readonly newAreaName = signal('');

  /** The field's own bound value: only the area's actual custom `name`, never the translated
   * built-in fallback `displayName()` computes for read-only display elsewhere. Binding the
   * fallback here used to seed the native input with that language's translated text the moment
   * the user typed anywhere in the field, freezing it as a literal `name` and losing the
   * built-in's own translation on a later language switch (review finding on #49/#50's PR) — the
   * translated label is a placeholder instead (`placeholderFor()`), never part of the value a
   * keystroke can capture. */
  protected fieldValue(area: Pick<MaturityArea, 'name'>): string {
    return area.name ?? '';
  }

  /** The built-in label to show as a placeholder while no custom name is set — `null` once the
   * area has a `name` (custom or renamed) or has no `key` to fall back to. */
  protected placeholderFor(area: Pick<MaturityArea, 'key' | 'name'>): string | null {
    if (area.name !== undefined || !area.key) {
      return null;
    }
    return this.builtInLabels()[area.key] ?? null;
  }

  protected onAreaNameInput(id: string, event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.changed.emit({ areas: renameArea(this.assessment().areas, id, name) });
  }

  protected onLevelChanged(id: string, level: MaturityLevel): void {
    this.changed.emit({ areas: setAreaLevel(this.assessment().areas, id, level) });
  }

  protected onNoteInput(id: string, event: Event): void {
    const note = (event.target as HTMLTextAreaElement).value;
    this.changed.emit({ areas: setAreaNote(this.assessment().areas, id, note) });
  }

  protected onRemoveArea(id: string): void {
    this.changed.emit({ areas: removeArea(this.assessment().areas, id) });
  }

  protected onNewAreaNameInput(event: Event): void {
    this.newAreaName.set((event.target as HTMLInputElement).value);
  }

  protected onAddArea(): void {
    const name = this.newAreaName().trim();
    if (!name) {
      return;
    }
    this.changed.emit({ areas: addArea(this.assessment().areas, name) });
    this.newAreaName.set('');
  }

  protected readonly hasAreas = computed(() => this.assessment().areas.length > 0);
}
