import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../core/i18n/locale.pipe';
import { parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import { ReflectionEditor } from '../../shared/exercise-kit/reflection-editor/reflection-editor';
import {
  addAsset,
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
  PC_BALANCE_GROUPS,
  PcAsset,
  PcAudit,
  PcAuditFields,
  PcBalanceGroup,
} from './pc-balance.model';

/**
 * The editor for one audit (issue #49): its date, the P/PC group summary, every asset grouped by
 * physical/financial/human with its sliders and balance indicator, and a reflection. Purely
 * presentational — `audit` is the current value, `changed` emits the edited field(s) so the page
 * persists through `featureStore` immediately, the same autosave-on-edit convention
 * `TransitionItemForm` uses.
 *
 * The reflection uses `ReflectionEditor`'s session status (issue #215): nothing until the first
 * keystroke, then "Saving…"/"Saved". Only the page knows whether a write landed, so it reports
 * back through `reportReflectionSaveOutcome()` after persisting a `reflection` change.
 */
@Component({
  selector: 'app-pc-balance-audit-form',
  imports: [
    AppDatePipe,
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
  readonly changed = output<Partial<PcAuditFields>>();

  private readonly reflectionEditor = viewChild(ReflectionEditor);

  protected readonly sliderMin = SLIDER_MIN;
  protected readonly sliderMax = SLIDER_MAX;

  protected readonly localDate = computed(() => parseIsoDate(this.audit().date));
  protected readonly groupSummary = computed(() => groupSummaries(this.audit().assets));
  protected readonly groupSections = computed(() => {
    const assets = this.audit().assets;
    return PC_BALANCE_GROUPS.map((group) => ({
      group,
      assets: assets.filter((asset) => asset.group === group),
    }));
  });

  private readonly draftNames = signal<Record<PcBalanceGroup, string>>({
    physical: '',
    financial: '',
    human: '',
  });
  private readonly touchedActionKeys = signal<ReadonlySet<string>>(new Set());

  constructor() {
    // The form is reused across selections (the page's own `@if (selectedAudit(); as audit)`
    // stays truthy while the id changes underneath) — reset per-audit UI state when it does,
    // same reasoning as `TransitionItemForm`'s own `touchedFields` reset.
    let previousId: string | undefined;
    effect(() => {
      const id = this.audit().id;
      if (id !== previousId) {
        previousId = id;
        this.touchedActionKeys.set(new Set());
        this.draftNames.set({ physical: '', financial: '', human: '' });
      }
    });
  }

  protected statusOf = computeStatus;
  protected balanceOf = computeBalance;
  protected isOverUsed = computeIsOverUsed;

  protected draftName(group: PcBalanceGroup): string {
    return this.draftNames()[group];
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
    const value = (event.target as HTMLInputElement).value;
    this.draftNames.update((draft) => ({ ...draft, [group]: value }));
  }

  protected onAddAsset(group: PcBalanceGroup): void {
    const name = this.draftNames()[group].trim();
    if (!name) {
      return;
    }
    this.changed.emit({ assets: addAsset(this.audit().assets, name, group) });
    this.draftNames.update((draft) => ({ ...draft, [group]: '' }));
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

  protected onRemoveAsset(key: string): void {
    this.changed.emit({ assets: removeAsset(this.audit().assets, key) });
  }

  protected onReflectionChanged(reflection: string): void {
    this.changed.emit({ reflection });
  }

  /** Forwards the page's save outcome for a `reflection` change to the editor's status. */
  reportReflectionSaveOutcome(saved: boolean): void {
    this.reflectionEditor()?.reportSaveOutcome(saved);
  }

  private onAssetChanged(key: string, fields: Partial<Omit<PcAsset, 'key'>>): void {
    this.changed.emit({ assets: editAsset(this.audit().assets, key, fields) });
  }
}
