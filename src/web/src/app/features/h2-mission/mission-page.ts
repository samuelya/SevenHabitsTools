import { BreakpointObserver } from '@angular/cdk/layout';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { HANDSET_QUERY } from '../../core/layout/breakpoints';
import { AppSnackbar } from '../../core/layout/app-snackbar';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { exerciseGuideSignal } from '../../shared/exercise-kit/exercise-guide/exercise-guide-signal';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { introCollapsedByDefault } from '../../shared/exercise-kit/exercise-prompt-card/intro-collapsed';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { GuidedStepContent } from '../../shared/exercise-kit/guided-stepper/guided-step-content';
import {
  GuidedStepDefinition,
  GuidedStepper,
} from '../../shared/exercise-kit/guided-stepper/guided-stepper';
import { PRINCIPLE_KEYS } from '../../shared/exercise-kit/principle-keys';
import { ReflectionEditor } from '../../shared/exercise-kit/reflection-editor/reflection-editor';
import {
  MissionInputItem,
  MissionInputKind,
  getMissionInputs,
} from '../../shared/mission-inputs/mission-inputs';
import {
  CHECKLIST_KEYS,
  MAX_LINES,
  MissionListKey,
  canSaveVersion,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  isComplete,
  isStarted,
  stepsDone,
  appendParagraph,
  sameLine,
  wordCount,
} from '../../shared/mission/mission.logic';
import { MissionRoleLine, REVIEW_KEYS, ReviewKey } from '../../shared/mission/mission.model';
import { MissionService } from '../../shared/mission/mission.service';
import { roleLabel } from '../../shared/roles/roles.logic';
import { RolesService } from '../../shared/roles/roles.service';
import { MissionCollection } from './mission-collection';
import { LineAdd } from './mission-line-add';
import { MissionLines } from './mission-lines';
import { MissionChips } from './mission-chips';
import {
  RoleLineRow,
  ownLines,
  principleLineLabel,
  roleLineRows,
  suggestionGroups,
} from './mission.logic';
import { H2_MISSION_ID } from './mission.model';

/** `[0]` is the `appGuidedStep` key, `[1]` the i18n namespace of the step's strings. */
const STEPS = [
  ['values', 'step1'],
  ['principles', 'step2'],
  ['roles', 'step3'],
  ['beAndDo', 'step4'],
  ['draft', 'step5'],
  ['review', 'step6'],
] as const;

const ROLES_LINK = '/habits/h2/roles';
const COLLECTION_LINK = '/habits/h2/inspiration';

/**
 * Your mission (issue #61): the worksheet that turns Habit 2's values, principles, roles and
 * collection into a personal mission statement, then saves it as a version. The container: it
 * reads `MissionService`, `RolesService` and the mission inputs, and passes plain values to the
 * kit and to its presentational parts (`MissionChips`, `MissionLines`, `MissionCollection`).
 */
@Component({
  selector: 'app-mission-page',
  imports: [
    AppNumberPipe,
    AppPluralPipe,
    DoneToggle,
    ExercisePage,
    ExercisePromptCard,
    GuidedStepContent,
    GuidedStepper,
    MatButtonModule,
    MatButtonToggleModule,
    MissionChips,
    MissionCollection,
    MissionLines,
    ReflectionEditor,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './mission-page.html',
  styleUrl: './mission-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissionPage {
  private readonly mission = inject(MissionService);
  private readonly roles = inject(RolesService);
  private readonly clipboard = inject(Clipboard);
  private readonly snackbar = inject(AppSnackbar);
  protected readonly progress = inject(ExerciseProgress);

  protected readonly rolesLink = ROLES_LINK;
  protected readonly collectionLink = COLLECTION_LINK;
  protected readonly reviewKeys = REVIEW_KEYS;
  protected readonly maxLines = MAX_LINES;

  private readonly draftEditor = viewChild<ReflectionEditor>('draftEditor');

  protected readonly record = this.mission.record;
  protected readonly started = computed(() => isStarted(this.record()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);
  private readonly breakpoints = inject(BreakpointObserver);
  protected readonly handset = toSignal(
    this.breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(HANDSET_QUERY) },
  );

  // Each kind's sources, read once here (an injection context), never inside a `computed`.
  private readonly valueSources = this.inputSources('values');
  private readonly principleSources = this.inputSources('principles');
  protected readonly inspirationItems = this.inputItems('inspiration');

  protected readonly valueSuggestions = computed(() =>
    suggestionGroups(this.valueSources(), this.record()?.values ?? []),
  );
  protected readonly ownValues = computed(() =>
    ownLines(
      this.record()?.values ?? [],
      this.valueSuggestions().flatMap((group) => group.rows),
    ),
  );
  protected readonly principleSuggestions = computed(() =>
    suggestionGroups(this.principleSources(), this.record()?.principles ?? []),
  );
  /** `exerciseKit.principle.*` by key: a kept suggestion is stored as its key and shown in the
   * current language, even once its source no longer offers it (#299). */
  private readonly principleKeyLabels = translateSignal(
    PRINCIPLE_KEYS.map((key) => `principle.${key}`),
    undefined,
    'exercise-kit',
  );
  protected readonly ownPrinciples = computed(() => {
    const translated = this.principleKeyLabels();
    const keyLabels = Object.fromEntries(
      PRINCIPLE_KEYS.map((key, index) => [key, translated[index] ?? '']),
    );
    return ownLines(
      this.record()?.principles ?? [],
      this.principleSuggestions().flatMap((group) => group.rows),
      (line) => principleLineLabel(line, keyLabels),
    );
  });

  // Labels: `translateSignal` with the scope named, keys relative to it (playbook §6).
  private readonly renewalLabel = translateSignal('roles.renewal', undefined, 'exercise-kit');
  private readonly activeRoles = computed(() => {
    const builtIn = { renewal: this.renewalLabel() ?? '' };
    return this.roles
      .active()
      .filter((role) => !role.sample)
      .map((role) => ({ id: role.id, label: roleLabel(role, builtIn) }));
  });
  /** Step 3's rows. While the user stays on the step, a row once shown keeps its place even if
   * its role is archived or deleted or its line cleared (`roleLineRows`' `shown`); leaving the
   * step (`selectedIndex` changes) drops the rows that no longer qualify. */
  protected readonly roleRows = linkedSignal<
    {
      readonly step: number;
      readonly active: readonly { readonly id: string; readonly label: string }[];
      readonly lines: readonly MissionRoleLine[];
    },
    readonly RoleLineRow[]
  >({
    source: () => ({
      step: this.selectedIndex(),
      active: this.activeRoles(),
      lines: this.record()?.roleLines ?? [],
    }),
    computation: (source, previous) =>
      roleLineRows(
        source.active,
        source.lines,
        (roleId) => this.roleLabelOf(roleId),
        previous?.source.step === source.step ? previous.value.map((row) => row.roleId) : [],
      ),
  });

  protected readonly draft = computed(() => this.record()?.draft ?? '');
  /** The stored draft's words: step 6's preview and "Copy statement" read the record. */
  protected readonly words = computed(() => wordCount(this.draft()));
  /** The editor's words on every keystroke, ahead of the autosave debounce (step 5). */
  protected readonly liveWords = computed(() =>
    wordCount(this.draftEditor()?.liveText() ?? this.draft()),
  );
  /** The collection item "Use this" last appended, shown with "Added to the end of your draft." */
  protected readonly usedId = signal<string | null>(null);
  private readonly usedText = translateSignal('panel.usedText', undefined, H2_MISSION_ID);

  protected readonly canSave = computed(() => canSaveVersion(this.record()));
  /** The number of the version this visit saved, for "Version n saved." */
  protected readonly savedVersion = signal<number | null>(null);
  private readonly copiedText = translateSignal('step6.copiedText', undefined, H2_MISSION_ID);

  protected readonly selectedIndex = signal(0);
  private readonly stepLabels = translateSignal(
    STEPS.map(([, i18nKey]) => `${i18nKey}.stepTitle`),
    undefined,
    H2_MISSION_ID,
  );
  protected readonly steps = computed<readonly GuidedStepDefinition[]>(() => {
    const done = stepsDone(this.record());
    return STEPS.map(([key], index) => ({
      key,
      label: this.stepLabels()[index] ?? '',
      done: done[index],
    }));
  });

  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    H2_MISSION_ID,
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.record(), labels) : null;
  });
  protected readonly guideContent = exerciseGuideSignal(H2_MISSION_ID);

  protected readonly readyToMarkDone = computed(() => isComplete(this.record()));
  protected readonly done = this.progress.isDone(H2_MISSION_ID);
  protected readonly completedAt = this.progress.completedAt(H2_MISSION_ID);

  protected onStepChange(index: number): void {
    this.draftEditor()?.flush();
    this.selectedIndex.set(index);
  }

  protected onToggleLine(list: 'values' | 'principles', text: string): void {
    const index = this.record()?.[list].findIndex((line) => sameLine(line, text)) ?? -1;
    if (index >= 0) {
      this.mission.removeLine(list, index);
    } else {
      this.mission.addLine(list, text);
    }
  }

  protected onLineAdded(list: MissionListKey, add: LineAdd): void {
    add.settle(this.mission.addLine(list, add.text));
  }

  protected onLineRemoved(list: MissionListKey, index: number): void {
    this.mission.removeLine(list, index);
  }

  protected onRoleLineChanged(roleId: string, text: string, editor: ReflectionEditor): void {
    editor.reportSaveOutcome(this.mission.setRoleLine(roleId, text));
  }

  protected onDraftChanged(text: string, editor: ReflectionEditor): void {
    editor.reportSaveOutcome(this.mission.edit({ draft: text }));
    this.savedVersion.set(null);
  }

  /** "Use this": the typing still in the editor's debounce is stored first, then the item is
   * appended as a paragraph, scrolled into view inside the field and announced by its status. */
  protected onUse(item: MissionInputItem, editor: ReflectionEditor): void {
    editor.flush();
    if (!this.mission.edit({ draft: appendParagraph(this.draft(), item.text) })) {
      return;
    }
    this.usedId.set(item.id);
    editor.scrollToEnd();
    editor.announce(this.usedText());
  }

  protected onCheck(key: ReviewKey, value: boolean): void {
    this.mission.setCheck(key, value);
  }

  protected onSaveVersion(): void {
    this.draftEditor()?.flush();
    const saved = this.mission.saveVersion();
    if (saved !== null) {
      this.savedVersion.set(saved);
    }
  }

  protected onCopy(): void {
    this.draftEditor()?.flush();
    if (this.clipboard.copy(this.draft())) {
      void this.snackbar.open(this.copiedText(), '', { duration: 3000 });
    }
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(H2_MISSION_ID);
    } else {
      this.progress.markDone(H2_MISSION_ID);
    }
  }

  private roleLabelOf(roleId: string): string | null {
    const role = this.roles.byId(roleId);
    return role ? roleLabel(role, { renewal: this.renewalLabel() ?? '' }) : null;
  }

  private inputItems(kind: MissionInputKind) {
    const sources = this.inputSources(kind);
    return computed<readonly MissionInputItem[]>(() => sources().flatMap((source) => source.items));
  }

  /** Each registered source of `kind` with its items, so a suggestion can name its source. */
  private inputSources(kind: MissionInputKind) {
    const sources = getMissionInputs(kind).map((entry) => ({
      sourceExerciseId: entry.sourceExerciseId,
      items: entry.read(),
    }));
    return computed(() =>
      sources.map((source) => ({
        sourceExerciseId: source.sourceExerciseId,
        items: source.items(),
      })),
    );
  }
}
