import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { NgTemplateOutlet } from '@angular/common';
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
  linkedSignal,
  output,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleGroup, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AssessmentDateField } from '../../shared/exercise-kit/assessment-date-field/assessment-date-field';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import {
  AreaChip,
  addBuiltInArea,
  addCustomArea,
  areaChips,
  displayName,
  hasAreaData,
} from './maturity-areas.logic';
import {
  MaturityFormPhase,
  clampIndex,
  firstUnratedIndex,
  initialPhase,
  removeArea,
  setAreaLevel,
  setAreaNote,
} from './maturity.logic';
import {
  MATURITY_LEVELS,
  MATURITY_SUGGESTED_AREA_KEYS,
  MaturityArea,
  MaturityAssessment,
  MaturityAssessmentFields,
  MaturityLevel,
} from './maturity.model';

/** An area being removed: where it was, and whether its chip (a suggested built-in's) stays. */
interface RemovedArea {
  readonly areaId: string;
  readonly index: number;
  readonly keepsChip: boolean;
}

/**
 * The editor for one assessment, in two phases (issue #222): pick the areas as chips (plus "Add
 * your own"), then rate them — one area per screen with Previous/Next on a phone, one expansion
 * panel per area above the handset breakpoint — under a single collapsible legend. Purely
 * presentational: `assessment` is the current value, `changed` emits the edited areas (or date, #226) so the
 * page persists them at once, `continued` tells the page the user moved on to rating (which saves a new
 * draft, #222 review), and `areaRemoveRequested` asks it to confirm removing an area that holds a
 * level or a note (#222 review); an empty area is removed at once.
 *
 * The phase, the current area and the "Add your own" text are UI state keyed on the assessment
 * **id**: saving a draft keeps its id (#217), so the user stays on the same screen, while opening
 * another assessment resets them. The current area is held by id, not position, so removing an
 * earlier area never moves the open panel.
 */
@Component({
  selector: 'app-maturity-assessment-form',
  imports: [
    AssessmentDateField,
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
  /** Continue into rating, with at least one area. */
  readonly continued = output<void>();
  /** The id of an area with a level or note the user asked to remove; the page confirms first. */
  readonly areaRemoveRequested = output<string>();
  /** How many edits the page's store has refused (a read-only tab): each one drops the form's own
   * copy of the areas for the stored ones, so nothing looks saved that wasn't (#222 re-review R2). */
  /** Today's `YYYY-MM-DD`, the latest date the date field accepts (issue #226). */
  readonly today = input<string | null>(null);
  readonly refusedEdits = input(0);

  protected readonly levels = MATURITY_LEVELS;

  /** The areas as last edited here, else as the input has them. Every edit builds on this, not on
   * `assessment()`: two edits before the next change detection (a chip, then Enter in "Add your
   * own") would otherwise build the second on the stale input and drop the first. A refused edit
   * (`refusedEdits`) resets it to the input, which the refusal left as stored. */
  protected readonly areas = linkedSignal<
    { areas: readonly MaturityArea[]; refused: number },
    readonly MaturityArea[]
  >({
    source: () => ({ areas: this.assessment().areas, refused: this.refusedEdits() }),
    computation: (source) => source.areas,
  });
  private readonly assessmentId = computed(() => this.assessment().id);

  protected readonly customName = linkedSignal<string, string>({
    source: this.assessmentId,
    computation: () => '',
  });
  /** Set when "Add your own" refused a name already in the list; cleared on the next keystroke. */
  protected readonly customNameDuplicate = linkedSignal<string, boolean>({
    source: this.assessmentId,
    computation: () => false,
  });

  /** Keyed on the id and on whether the list is empty: emptying it (the last area removed, here
   * or after a confirm) returns to the picker, and it stays there as chips are chosen again. */
  private readonly phaseSource = computed(
    () => ({ id: this.assessmentId(), empty: this.areas().length === 0 }),
    { equal: (a, b) => a.id === b.id && a.empty === b.empty },
  );
  private readonly phaseState = linkedSignal<{ id: string; empty: boolean }, MaturityFormPhase>({
    source: this.phaseSource,
    computation: (source, previous) => {
      if (previous && previous.source.id === source.id) {
        return source.empty ? 'areas' : previous.value;
      }
      return untracked(() => initialPhase(this.areas(), this.isNew()));
    },
  });
  /** Never the rating phase with nothing to rate. `phaseState` is read first, always: a linked
   * signal computes lazily, so reading it only once areas exist would take its initial value from
   * a later state of the assessment instead of the one that opened. */
  protected readonly phase = computed<MaturityFormPhase>(() => {
    const phase = this.phaseState();
    return this.areas().length === 0 ? 'areas' : phase;
  });

  private readonly currentId = linkedSignal<string, string | null>({
    source: this.assessmentId,
    computation: () => untracked(() => this.areas()[firstUnratedIndex(this.areas())]?.id ?? null),
  });
  protected readonly current = computed(() => {
    const index = this.areas().findIndex((area) => area.id === this.currentId());
    return index === -1 ? 0 : index;
  });
  protected readonly currentArea = computed<MaturityArea | null>(
    () => this.areas()[this.current()] ?? null,
  );

  protected readonly chips = computed<AreaChip[]>(() =>
    areaChips(this.areas(), MATURITY_SUGGESTED_AREA_KEYS, this.builtInLabels()),
  );
  protected readonly hasAreas = computed(() => this.areas().length > 0);
  /** The one area left of a saved assessment, which can't be removed: an assessment needs at least
   * one area (#222 re-review R3). A new draft may still be emptied, back to the picker. */
  protected readonly lockedAreaId = computed(() => {
    const areas = this.areas();
    return !this.isNew() && areas.length === 1 ? areas[0].id : null;
  });

  /** An area whose removal the page is confirming, so the view can follow once (if) it goes. */
  private pendingRemoval: (RemovedArea & { readonly assessmentId: string }) | null = null;

  private readonly customInput = viewChild<ElementRef<HTMLInputElement>>('customInput');
  private readonly areasHeading = viewChild<ElementRef<HTMLElement>>('areasHeading');
  private readonly rateHeading = viewChild<ElementRef<HTMLElement>>('rateHeading');
  private readonly areaHeading = viewChild<ElementRef<HTMLElement>>('areaHeading');
  private readonly levelGroups = viewChildren('levelGroup', { read: MatButtonToggleGroup });
  private readonly noteFields = viewChildren<ElementRef<HTMLTextAreaElement>>('noteField');

  constructor() {
    effect(() => {
      const areas = this.areas();
      const pending = this.pendingRemoval;
      if (
        pending &&
        pending.assessmentId === untracked(this.assessmentId) &&
        !areas.some((area) => area.id === pending.areaId)
      ) {
        this.pendingRemoval = null;
        untracked(() => this.afterAreaRemoved(pending, areas));
      }
    });
    // A refused level or note leaves the control showing it: the bound value didn't change, so the
    // template writes nothing. Put the stored value back on each control instead.
    let refused = untracked(this.refusedEdits);
    effect(() => {
      if (this.refusedEdits() !== refused) {
        refused = this.refusedEdits();
        afterNextRender(() => this.resetRatingControls(), { injector: this.injector });
      }
    });
  }

  protected nameOf(area: Pick<MaturityArea, 'key' | 'name'>): string {
    return displayName(area, this.builtInLabels());
  }

  protected onChipToggled(chip: AreaChip): void {
    if (chip.areaId === this.lockedAreaId()) {
      return;
    }
    if (chip.areaId) {
      this.requestRemove(chip.areaId);
    } else if (chip.key) {
      this.emitAreas(addBuiltInArea(this.areas(), chip.key));
    }
  }

  protected onCustomNameInput(event: Event): void {
    this.customName.set((event.target as HTMLInputElement).value);
    this.customNameDuplicate.set(false);
  }

  protected onAddCustom(event: Event): void {
    event.preventDefault();
    this.addCustomName();
  }

  /** Phase 1 → 2, on the first unrated area; a name still typed in "Add your own" is added first,
   * and a refused one keeps the user here with its error. Does nothing with no area chosen (the
   * button stays focusable, `disabledInteractive`, and its hint says why). */
  protected onContinue(): void {
    const areas = this.addCustomName();
    if (areas === null || areas.length === 0) {
      return;
    }
    this.currentId.set(areas[firstUnratedIndex(areas)]?.id ?? null);
    this.phaseState.set('rate');
    this.continued.emit();
    this.focusAfterRender(() => this.rateHeading());
  }

  protected onChangeAreas(): void {
    this.phaseState.set('areas');
    this.focusAfterRender(() => this.areasHeading());
  }

  /** Previous/Next keep focus on the button pressed; when that button is gone (first or last
   * area), focus moves to the area heading so it is never lost to the page. */
  protected onStep(delta: number, button: HTMLElement): void {
    const areas = this.areas();
    this.currentId.set(areas[clampIndex(this.current() + delta, areas.length)]?.id ?? null);
    this.focusAfterRender(() => (button.isConnected ? null : this.areaHeading()));
  }

  protected onLevelChanged(id: string, level: MaturityLevel): void {
    this.emitAreas(setAreaLevel(this.areas(), id, level));
  }

  protected onNoteInput(id: string, event: Event): void {
    const note = (event.target as HTMLTextAreaElement).value;
    this.emitAreas(setAreaNote(this.areas(), id, note));
  }

  protected onRemoveArea(id: string): void {
    if (id !== this.lockedAreaId()) {
      this.requestRemove(id);
    }
  }

  /** An area holding a level or note goes through the page's confirm (#222 review: a chip toggle
   * or Remove alone must not lose it); an empty one is removed at once. Either way only that area
   * goes. */
  private requestRemove(areaId: string): void {
    const areas = this.areas();
    const index = areas.findIndex((area) => area.id === areaId);
    if (index === -1) {
      return;
    }
    const removed: RemovedArea = {
      areaId,
      index,
      keepsChip: this.chips().some((chip) => chip.areaId === areaId && chip.key !== undefined),
    };
    if (hasAreaData(areas[index])) {
      this.pendingRemoval = { ...removed, assessmentId: this.assessmentId() };
      this.areaRemoveRequested.emit(areaId);
      return;
    }
    const remaining = removeArea(areas, areaId);
    this.emitAreas(remaining);
    this.afterAreaRemoved(removed, remaining);
  }

  /** The next area (or the new last one) becomes current. Focus goes where the pressed control
   * went: with no area left the picker shows (`phaseState`) and its heading takes focus; on rating
   * the area (phone) or phase heading does; on the picker a suggested chip stays in place and keeps
   * focus, while any other chip is gone, so the heading takes it. */
  private afterAreaRemoved(removed: RemovedArea, remaining: readonly MaturityArea[]): void {
    if (this.currentId() === removed.areaId) {
      this.currentId.set(remaining[clampIndex(removed.index, remaining.length)]?.id ?? null);
    }
    if (remaining.length === 0) {
      this.focusAfterRender(() => this.areasHeading());
    } else if (untracked(this.phaseState) === 'rate') {
      this.focusAfterRender(() => (this.handset() ? this.areaHeading() : this.rateHeading()));
    } else if (!removed.keepsChip) {
      this.focusAfterRender(() => this.areasHeading());
    }
  }

  /** "Add your own": adds the typed name and clears the field, keeps it with an inline error when
   * the name is already in the list. Returns the areas as they now stand (unchanged for a blank
   * name), `null` when refused. */
  private addCustomName(): MaturityArea[] | null {
    const result = addCustomArea(this.areas(), this.customName(), this.builtInLabels());
    if (result.ok) {
      this.emitAreas(result.areas);
      this.customName.set('');
      // Cleared on the element too: typing may not have re-rendered `[value]` yet, and then the
      // binding sees '' → '' as no change and leaves the typed text in place.
      const input = this.customInput()?.nativeElement;
      if (input) {
        input.value = '';
      }
      return result.areas;
    }
    if (result.reason === 'duplicate') {
      this.customNameDuplicate.set(true);
      return null;
    }
    return [...this.areas()];
  }

  /** Any edit here also ends a removal the page was confirming: the dialog is modal, so an edit
   * after it means it was cancelled (#222 re-review R5). */
  private emitAreas(areas: MaturityArea[]): void {
    this.pendingRemoval = null;
    this.areas.set(areas);
    this.changed.emit({ areas });
  }

  private resetRatingControls(): void {
    const byId = new Map(this.areas().map((area) => [area.id, area]));
    for (const group of this.levelGroups()) {
      const id = group.name.replace(/^level-/, '');
      group.value = byId.get(id)?.level ?? null;
    }
    for (const field of this.noteFields()) {
      const element = field.nativeElement;
      element.value = byId.get(element.dataset['areaId'] ?? '')?.note ?? '';
    }
  }

  private focusAfterRender(target: () => ElementRef<HTMLElement> | null | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }
}
