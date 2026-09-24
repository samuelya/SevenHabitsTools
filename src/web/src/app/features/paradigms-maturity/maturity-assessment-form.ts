import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import {
  AreaChip,
  MaturityFormPhase,
  addCustomArea,
  areaChips,
  clampIndex,
  displayName,
  firstUnratedIndex,
  initialPhase,
  removeArea,
  setAreaLevel,
  setAreaNote,
  toggleBuiltInArea,
} from './maturity.logic';
import {
  MATURITY_LEVELS,
  MATURITY_SUGGESTED_AREA_KEYS,
  MaturityArea,
  MaturityAssessment,
  MaturityAssessmentFields,
  MaturityLevel,
} from './maturity.model';

/**
 * The editor for one assessment, in two phases (issue #222): pick the areas as chips (plus "Add
 * your own"), then rate them — one area per screen with Previous/Next on a phone, one expansion
 * panel per area above the handset breakpoint — under a single collapsible legend. Purely
 * presentational: `assessment` is the current value, `changed` emits the edited areas so the page
 * persists them at once (`recordDraft()` saves a new draft on the first chip).
 *
 * The phase and the current area are UI state keyed on the assessment **id**: saving a draft keeps
 * its id (#217), so the user stays on the same screen, while opening another assessment resets
 * both.
 */
@Component({
  selector: 'app-maturity-assessment-form',
  imports: [
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonModule,
    MatButtonToggleModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
  templateUrl: './maturity-assessment-form.html',
  styleUrl: './maturity-assessment-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaturityAssessmentForm {
  private readonly injector = inject(Injector);

  readonly assessment = input.required<MaturityAssessment>();
  /** Translated labels for the built-in area keys, from the page's `translateSignal` (kept out of
   * this component so it stays testable without a translation service). */
  readonly builtInLabels = input.required<Record<string, string>>();
  /** Below `HANDSET_QUERY`: one area per screen instead of expansion panels. */
  readonly handset = input(false);
  /** Whether `assessment` is a new, unsaved draft; read when an assessment opens, to start it on
   * the area picker. */
  readonly isNew = input(false);
  readonly changed = output<Partial<MaturityAssessmentFields>>();

  protected readonly levels = MATURITY_LEVELS;
  protected readonly customName = signal('');

  private readonly areas = computed(() => this.assessment().areas);
  private readonly assessmentId = computed(() => this.assessment().id);

  private readonly phaseState = linkedSignal<string, MaturityFormPhase>({
    source: this.assessmentId,
    computation: () => untracked(() => initialPhase(this.areas(), this.isNew())),
  });
  /** Never the rating phase with nothing to rate. `phaseState` is read first, always: a linked
   * signal computes lazily, so reading it only once areas exist would take its initial value from
   * the first chip's saved record (no longer new) instead of the draft that opened. */
  protected readonly phase = computed<MaturityFormPhase>(() => {
    const phase = this.phaseState();
    return this.areas().length === 0 ? 'areas' : phase;
  });

  private readonly index = linkedSignal<string, number>({
    source: this.assessmentId,
    computation: () => untracked(() => firstUnratedIndex(this.areas())),
  });
  protected readonly current = computed(() => clampIndex(this.index(), this.areas().length));
  protected readonly currentArea = computed<MaturityArea | null>(
    () => this.areas()[this.current()] ?? null,
  );

  protected readonly chips = computed<AreaChip[]>(() =>
    areaChips(this.areas(), MATURITY_SUGGESTED_AREA_KEYS, this.builtInLabels()),
  );
  protected readonly hasAreas = computed(() => this.areas().length > 0);

  private readonly areasHeading = viewChild<ElementRef<HTMLElement>>('areasHeading');
  private readonly rateHeading = viewChild<ElementRef<HTMLElement>>('rateHeading');
  private readonly areaHeading = viewChild<ElementRef<HTMLElement>>('areaHeading');

  protected nameOf(area: Pick<MaturityArea, 'key' | 'name'>): string {
    return displayName(area, this.builtInLabels());
  }

  protected onChipToggled(chip: AreaChip): void {
    if (chip.key) {
      this.emitAreas(toggleBuiltInArea(this.areas(), chip.key));
    } else if (chip.areaId) {
      this.emitAreas(removeArea(this.areas(), chip.areaId));
    }
  }

  protected onCustomNameInput(event: Event): void {
    this.customName.set((event.target as HTMLInputElement).value);
  }

  protected onAddCustom(event: Event): void {
    event.preventDefault();
    const areas = addCustomArea(this.areas(), this.customName());
    if (areas) {
      this.emitAreas(areas);
    }
    this.customName.set('');
  }

  /** Phase 1 → 2, on the first unrated area. Does nothing with no area chosen (the button stays
   * focusable, `disabledInteractive`, and its hint says why). */
  protected onContinue(): void {
    if (!this.hasAreas()) {
      return;
    }
    this.index.set(firstUnratedIndex(this.areas()));
    this.phaseState.set('rate');
    this.focusAfterRender(() => this.rateHeading());
  }

  protected onChangeAreas(): void {
    this.phaseState.set('areas');
    this.focusAfterRender(() => this.areasHeading());
  }

  /** Previous/Next keep focus on the button pressed; when that button is gone (first or last
   * area), focus moves to the area heading so it is never lost to the page. */
  protected onStep(delta: number, button: HTMLElement): void {
    this.index.set(clampIndex(this.current() + delta, this.areas().length));
    this.focusAfterRender(() => (button.isConnected ? null : this.areaHeading()));
  }

  protected onLevelChanged(id: string, level: MaturityLevel): void {
    this.emitAreas(setAreaLevel(this.areas(), id, level));
  }

  protected onNoteInput(id: string, event: Event): void {
    const note = (event.target as HTMLTextAreaElement).value;
    this.emitAreas(setAreaNote(this.areas(), id, note));
  }

  /** Removing the last area returns to the picker; otherwise the next area (or the new last one)
   * shows and its heading takes focus, since the button pressed is gone. */
  protected onRemoveArea(id: string): void {
    const areas = removeArea(this.areas(), id);
    this.emitAreas(areas);
    if (areas.length === 0) {
      this.phaseState.set('areas');
      this.focusAfterRender(() => this.areasHeading());
    } else {
      this.focusAfterRender(() => (this.handset() ? this.areaHeading() : this.rateHeading()));
    }
  }

  private emitAreas(areas: MaturityArea[]): void {
    this.changed.emit({ areas });
  }

  private focusAfterRender(target: () => ElementRef<HTMLElement> | null | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }
}
