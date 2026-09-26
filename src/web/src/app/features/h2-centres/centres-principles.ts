import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatChipInputEvent, MatChipSelectionChange, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  PRINCIPLE_KEYS,
  addPrincipleKey,
  addPrincipleName,
  hasPrincipleKey,
  principleLabel,
  removePrinciple,
} from './centres.logic';
import { CentrePrinciple, PrincipleKey } from './centres.model';

/**
 * Step 3 of an assessment (issue #60): the twelve suggested principles as a multi-select chip
 * listbox plus the user's own words as a chip grid, one combined list of at most five. A sixth
 * is refused with the hint and, when typed, its text stays in the input. Presentational: it
 * emits the new list and the page stores it.
 */
@Component({
  selector: 'app-centres-principles',
  imports: [MatChipsModule, MatFormFieldModule, MatIconModule, TranslocoPipe],
  templateUrl: './centres-principles.html',
  styleUrl: './centres-principles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CentresPrinciples {
  readonly principles = input.required<readonly CentrePrinciple[]>();
  /** `exerciseKit.principle.*`, already translated by the page. */
  readonly keyLabels = input.required<Readonly<Record<PrincipleKey, string>>>();
  readonly principlesChange = output<readonly CentrePrinciple[]>();

  protected readonly separatorKeys = [ENTER, COMMA] as const;
  protected readonly suggestions = PRINCIPLE_KEYS;
  protected readonly custom = computed(() =>
    this.principles().filter((principle) => principle.key === undefined),
  );
  /** Set by a refused sixth principle, cleared by the next change. */
  protected readonly refused = signal(false);

  protected isSelected(key: PrincipleKey): boolean {
    return hasPrincipleKey(this.principles(), key);
  }

  protected label(principle: CentrePrinciple): string {
    return principleLabel(principle, this.keyLabels());
  }

  /** Only user input: the refusal's own `deselect()` fires a second, programmatic event. */
  protected onSuggestionChange(key: PrincipleKey, event: MatChipSelectionChange): void {
    if (!event.isUserInput) {
      return;
    }
    if (!event.selected) {
      this.refused.set(false);
      this.principlesChange.emit(removePrinciple(this.principles(), { key }));
      return;
    }
    const next = addPrincipleKey(this.principles(), key);
    if (next === null) {
      this.refused.set(true);
      event.source.deselect();
      return;
    }
    this.refused.set(false);
    if (next !== this.principles()) {
      this.principlesChange.emit(next);
    }
  }

  protected onNameAdded(event: MatChipInputEvent): void {
    const result = addPrincipleName(this.principles(), event.value, this.keyLabels());
    if ('refused' in result) {
      this.refused.set(true);
      return;
    }
    this.refused.set(false);
    event.chipInput.clear();
    if (result.principles !== this.principles()) {
      this.principlesChange.emit(result.principles);
    }
  }

  protected onNameRemoved(principle: CentrePrinciple): void {
    this.refused.set(false);
    this.principlesChange.emit(removePrinciple(this.principles(), principle));
  }
}
