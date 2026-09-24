import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { TranslocoPipe } from '@jsverse/transloco';
import { AssessmentDateField } from '../../shared/exercise-kit/assessment-date-field/assessment-date-field';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import { ReflectionEditor } from '../../shared/exercise-kit/reflection-editor/reflection-editor';
import {
  addBuiltInAsset,
  addNamedAsset,
  displayName,
  firstOfEachStatus,
  hasAssetData,
  suggestedAssets,
} from './pc-balance-assets.logic';
import {
  balanceOf as computeBalance,
  editAsset,
  groupSummaries,
  isOverUsed as computeIsOverUsed,
  removeAsset,
  SLIDER_MAX,
  SLIDER_MIN,
  statusOf as computeStatus,
} from './pc-balance.logic';
import {
  isBuiltInAssetKey,
  PC_BALANCE_GROUPS,
  PcAsset,
  PcAudit,
  PcAuditFields,
  PcBalanceGroup,
  PcBuiltInAssetKey,
} from './pc-balance.model';

/** A reflection edit and the audit it was typed into. */
export interface PcReflectionChange {
  readonly auditId: string;
  readonly reflection: string;
}

type GroupText = Readonly<Record<PcBalanceGroup, string>>;
const NO_TEXT: GroupText = { physical: '', financial: '', human: '' };

/**
 * The editor for one audit (issue #49, redesigned by #223): its editable date (#226), the P/PC group summary once
 * an asset exists, and per group the assets with their sliders and computed status, two suggested
 * asset chips and a free-text add field; then a reflection. Purely presentational — `audit` is the
 * current value, `changed` emits the edited field(s) so the page persists through `featureStore`
 * immediately, the same autosave-on-edit convention `TransitionItemForm` uses.
 *
 * Every asset edit builds on `assets`, the list as last edited here, not on `audit()`: a chip
 * tapped and Enter pressed before the next change detection would otherwise build the second edit
 * on the stale input and drop the first. A refused edit (`refusedEdits`, a read-only tab) resets
 * it and re-creates the asset controls from the stored values, and a typed name is only cleared
 * once its asset is stored, so nothing looks saved that wasn't (#222's same rule).
 *
 * The reflection uses `ReflectionEditor`'s session status (issue #215); only the page knows
 * whether a write landed, so it reports back through `reportReflectionSaveOutcome()`. The form is
 * reused across audits, so the editor is keyed per audit and every reflection edit carries the id
 * of the audit it was typed into (review finding on #215's PR).
 */
@Component({
  selector: 'app-pc-balance-audit-form',
  imports: [
    AssessmentDateField,
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSliderModule,
    ReflectionEditor,
    TranslocoPipe,
  ],
  templateUrl: './pc-balance-audit-form.html',
  styleUrl: './pc-balance-audit-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PcBalanceAuditForm {
  readonly audit = input.required<PcAudit>();
  /** Whether `audit` is still an unsaved draft (issue #217): the reflection then skips its
   * debounce, so the draft is saved on the first real keystroke and nothing is left pending. */
  readonly unsaved = input(false);
  /** Each built-in asset key's translated label (issue #223). */
  readonly builtInLabels = input.required<Readonly<Record<string, string>>>();
  /** How many edits the page's store has refused (a read-only tab). */
  readonly refusedEdits = input(0);
  readonly changed = output<Partial<PcAuditFields>>();
  readonly reflectionChanged = output<PcReflectionChange>();
  /** The key of an asset holding a rating or action the user asked to remove; the page confirms
   * first. An untouched asset is removed through `changed` at once. */
  readonly assetRemoveRequested = output<string>();

  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly reflectionEditor = viewChild(ReflectionEditor);

  protected readonly sliderMin = SLIDER_MIN;
  protected readonly sliderMax = SLIDER_MAX;

  protected readonly assets = linkedSignal<
    { assets: readonly PcAsset[]; refused: number },
    readonly PcAsset[]
  >({
    source: () => ({ assets: this.audit().assets, refused: this.refusedEdits() }),
    computation: (source) => source.assets,
  });
  private readonly auditId = computed(() => this.audit().id);

  protected readonly hasAssets = computed(() => this.assets().length > 0);
  /** Only the groups holding an asset: no "No assets yet" rows (issue #223). */
  protected readonly groupSummary = computed(() =>
    groupSummaries(this.assets()).filter((summary) => summary.averageBalance !== null),
  );
  protected readonly groupSections = computed(() => {
    const assets = this.assets();
    return PC_BALANCE_GROUPS.map((group) => ({
      group,
      assets: assets.filter((asset) => asset.group === group),
      suggested: suggestedAssets(assets, group),
    }));
  });
  /** The group whose first asset is the audit's first: the legend sits above it. */
  protected readonly legendGroup = computed(
    () => this.groupSections().find((section) => section.assets.length > 0)?.group ?? null,
  );
  protected readonly glossedKeys = computed(() => firstOfEachStatus(this.assets()));
  /** The only asset left can't be removed: an audit keeps at least one (#222's rule). */
  protected readonly removable = computed(() => this.assets().length > 1);

  /** Per-group free text, kept until its asset is stored. */
  protected readonly draftNames = linkedSignal<string, GroupText>({
    source: this.auditId,
    computation: () => NO_TEXT,
  });
  /** The group whose typed name was refused as already in the audit. */
  protected readonly duplicateGroup = linkedSignal<string, PcBalanceGroup | null>({
    source: this.auditId,
    computation: () => null,
  });
  protected readonly touchedActionKeys = linkedSignal<string, ReadonlySet<string>>({
    source: this.auditId,
    computation: () => new Set(),
  });

  /** A typed asset waiting to be stored: its field clears once it is (or stays, if refused). */
  private pendingName: { readonly group: PcBalanceGroup; readonly key: string } | null = null;
  /** An asset being removed from audit `auditId`: focus moves to its group's add field once it
   * has gone. Dropped on Cancel (`cancelAssetRemoval()`), on a refused edit and on another audit,
   * so focus never jumps later for a removal that didn't happen. */
  private pendingRemoval: {
    readonly auditId: string;
    readonly group: PcBalanceGroup;
    readonly key: string;
  } | null = null;

  constructor() {
    effect(() => {
      const stored = this.audit().assets;
      const pending = this.pendingName;
      if (pending && stored.some((asset) => asset.key === pending.key)) {
        this.pendingName = null;
        untracked(() => this.setDraftName(pending.group, ''));
      }
    });
    let refused = untracked(this.refusedEdits);
    effect(() => {
      if (this.refusedEdits() !== refused) {
        refused = this.refusedEdits();
        this.pendingName = null;
        this.pendingRemoval = null;
      }
    });
    effect(() => {
      const assets = this.assets();
      const auditId = this.auditId();
      const removal = this.pendingRemoval;
      if (removal && removal.auditId !== auditId) {
        this.pendingRemoval = null;
      } else if (removal && !assets.some((asset) => asset.key === removal.key)) {
        this.pendingRemoval = null;
        this.focusAfterRender(`[data-add-group="${removal.group}"] input`);
      }
    });
  }

  protected statusOf = computeStatus;
  protected balanceOf = computeBalance;
  protected isOverUsed = computeIsOverUsed;

  /** A suggested asset still under its built-in label: shown as a title, not a name field. */
  protected isSuggested(asset: PcAsset): boolean {
    return asset.name.trim() === '' && isBuiltInAssetKey(asset.key);
  }

  protected nameOf(asset: PcAsset): string {
    return displayName(asset, this.builtInLabels());
  }

  protected isActionTouched(key: string): boolean {
    return this.touchedActionKeys().has(key);
  }

  protected touchAction(key: string): void {
    if (!this.touchedActionKeys().has(key)) {
      this.touchedActionKeys.update((keys) => new Set(keys).add(key));
    }
  }

  protected onDraftNameInput(group: PcBalanceGroup, event: Event): void {
    this.setDraftName(group, (event.target as HTMLInputElement).value);
    if (this.duplicateGroup() === group) {
      this.duplicateGroup.set(null);
    }
  }

  /** Enter in a group's field, or its Add button. */
  protected onAddNamed(group: PcBalanceGroup, event?: Event): void {
    event?.preventDefault();
    const result = addNamedAsset(this.assets(), this.draftNames()[group], group);
    if (!result.ok) {
      this.duplicateGroup.set(result.reason === 'duplicate' ? group : null);
      return;
    }
    this.pendingName = { group, key: result.key };
    this.emitAssets(result.assets);
  }

  /** A suggested chip: the chip goes, so focus moves to the new asset's first rating control. */
  protected onAddSuggested(key: PcBuiltInAssetKey): void {
    this.emitAssets(addBuiltInAsset(this.assets(), key));
    this.focusAfterRender(`[data-asset-key="${key}"] input[matSliderThumb]`);
  }

  protected onAssetNameChanged(key: string, event: Event): void {
    this.onAssetChanged(key, { name: (event.target as HTMLInputElement).value });
  }

  protected onAssetActionChanged(key: string, event: Event): void {
    this.onAssetChanged(key, { action: (event.target as HTMLTextAreaElement).value });
  }

  protected onSliderChanged(key: string, field: 'p' | 'pc', value: number): void {
    this.onAssetChanged(key, { [field]: value });
  }

  protected onRemoveAsset(asset: PcAsset): void {
    if (!this.removable()) {
      return;
    }
    const removal = { auditId: this.auditId(), group: asset.group, key: asset.key };
    if (hasAssetData(asset)) {
      this.pendingRemoval = removal;
      this.assetRemoveRequested.emit(asset.key);
    } else {
      this.emitAssets(removeAsset(this.assets(), asset.key));
      this.pendingRemoval = removal;
    }
  }

  /** The page's confirm for `assetRemoveRequested` was cancelled: the asset stays, so focus stays
   * where it is. */
  cancelAssetRemoval(key: string): void {
    if (this.pendingRemoval?.key === key) {
      this.pendingRemoval = null;
    }
  }

  protected onReflectionChanged(auditId: string, reflection: string): void {
    this.reflectionChanged.emit({ auditId, reflection });
  }

  /** Forwards the page's save outcome for a `reflectionChanged` edit to the editor's status, only
   * while that audit's editor is still the one shown (a flush on switching audits isn't). */
  reportReflectionSaveOutcome(auditId: string, saved: boolean): void {
    if (auditId === this.audit().id) {
      this.reflectionEditor()?.reportSaveOutcome(saved);
    }
  }

  private onAssetChanged(key: string, fields: Partial<Omit<PcAsset, 'key'>>): void {
    this.emitAssets(editAsset(this.assets(), key, fields));
  }

  /** Any edit here also ends a removal the page was confirming: the dialog is modal, so an edit
   * after it means it was cancelled. */
  private emitAssets(assets: PcAsset[]): void {
    this.pendingRemoval = null;
    this.assets.set(assets);
    this.changed.emit({ assets });
  }

  private setDraftName(group: PcBalanceGroup, value: string): void {
    this.draftNames.update((names) => ({ ...names, [group]: value }));
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
