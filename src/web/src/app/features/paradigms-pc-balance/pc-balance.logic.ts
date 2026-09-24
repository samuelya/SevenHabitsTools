import { isLive, softDelete, touch } from '../../core/data/record';
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
import {
  AssessmentResultSummary,
  latestAssessment,
  liveAssessments,
} from '../../shared/exercise-kit/assessment-history.logic';
import {
  allMet,
  ChecklistLabels,
  ChecklistMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from '../../shared/exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../../shared/exercise-kit/done-toggle/done-toggle';
import {
  isBuiltInAssetKey,
  PC_BALANCE_GROUPS,
  PcAsset,
  PcAudit,
  PcAuditFields,
  PcBalanceGroup,
} from './pc-balance.model';

export const SLIDER_MIN = 1;
export const SLIDER_MAX = 5;
/** Where every slider starts: a fresh asset, and every asset carried over into a new audit
 * (issue #49's implementation notes: "sliders at 3"). */
export const DEFAULT_SLIDER_VALUE = 3;

const OVER_USED_THRESHOLD = 2;
const UNDER_USED_THRESHOLD = -2;

export type PcBalanceStatus = 'overUsed' | 'balanced' | 'underUsed';

/** `p - pc` (issue #49's data model). */
export function balanceOf(asset: Pick<PcAsset, 'p' | 'pc'>): number {
  return asset.p - asset.pc;
}

/** `>= 2` over-used, `<= -2` under-used, otherwise balanced (issue #49's implementation notes). */
export function statusOf(balance: number): PcBalanceStatus {
  if (balance >= OVER_USED_THRESHOLD) {
    return 'overUsed';
  }
  if (balance <= UNDER_USED_THRESHOLD) {
    return 'underUsed';
  }
  return 'balanced';
}

export function isOverUsed(asset: Pick<PcAsset, 'p' | 'pc'>): boolean {
  return statusOf(balanceOf(asset)) === 'overUsed';
}

/** An asset is complete once it's named, and either isn't over-used or — once it is — it names one
 * maintenance action (issue #49's acceptance criteria). An unlabelled asset can't meaningfully
 * count toward "the audit is complete" (review finding on #49/#50's PR — this was previously
 * unchecked, so an empty-named asset still counted). Pure business rule, kept out of `validate()`
 * (architecture issue #1 §6). */
export function isAssetComplete(
  asset: Pick<PcAsset, 'key' | 'name' | 'p' | 'pc' | 'action'>,
): boolean {
  return isAssetNamed(asset) && (!isOverUsed(asset) || Boolean(asset.action?.trim()));
}

/** Named: a typed name, or a suggested asset's built-in key (issue #223), whose label is
 * translated at render. */
export function isAssetNamed(asset: Pick<PcAsset, 'key' | 'name'>): boolean {
  return Boolean(asset.name.trim()) || isBuiltInAssetKey(asset.key);
}

/** Live audits only (architecture issue #1 §6: tombstoned records are never shown). */
export function liveAudits(audits: readonly PcAudit[]): PcAudit[] {
  return liveAssessments(audits);
}

/** Started once any live audit exists (issue #216) — the hub's "started" and the intro card's
 * collapse both read this. */
export function isStarted(audits: readonly PcAudit[]): boolean {
  return audits.some(isLive);
}

/** The hub's in-progress text (issue #219): "1 audit", one per live audit; `null` with none. */
export function hubStatus(audits: readonly PcAudit[]): ExerciseHubStatus | null {
  const count = liveAudits(audits).length;
  return count > 0 ? { key: 'habits.exercises.paradigms-pc-balance.auditCount', count } : null;
}

/** An audit is complete once it has at least one asset and every over-used asset names an action
 * (issue #49's implementation notes). */
export function isAuditComplete(audit: Pick<PcAudit, 'assets'>): boolean {
  return audit.assets.length > 0 && audit.assets.every(isAssetComplete);
}

/** The two gate items (issue #215). */
export const CHECKLIST_KEYS = ['named', 'actions'] as const;
export type PcBalanceChecklistKey = (typeof CHECKLIST_KEYS)[number];

/** One audit's "met" map: `named` is at least one asset, every one of them named (sliders always
 * hold a value, so a name is the only thing an asset can be missing); `actions` is
 * every over-used asset naming its action (not met by an audit with no assets). Both met is
 * exactly `isAuditComplete()`. */
function auditMet(audit: PcAudit): ChecklistMet<PcBalanceChecklistKey> {
  const hasAssets = audit.assets.length > 0;
  return {
    named: hasAssets && audit.assets.every(isAssetNamed),
    actions:
      hasAssets &&
      audit.assets.every((asset) => !isOverUsed(asset) || Boolean(asset.action?.trim())),
  };
}

/** The checklist describes the live audit closest to complete (`closestMet()`). */
function checklistMet(audits: readonly PcAudit[]): ChecklistMet<PcBalanceChecklistKey> {
  return closestMet(liveAudits(audits), CHECKLIST_KEYS, auditMet);
}

/** Whether `DoneToggle` should be enabled: at least one live audit is complete, derived from the
 * checklist (issue #215) so the button and the list it shows can never disagree. */
export function isComplete(audits: readonly PcAudit[]): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(audits));
}

/** The gate items, labelled for `DoneToggle` (see `transition.logic.ts`'s `doneChecklist()`). */
export function doneChecklist(
  audits: readonly PcAudit[],
  labels: ChecklistLabels<PcBalanceChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(audits), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<PcBalanceChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

/** Gates the checklist's rendering until the scope has loaded (no blank rows on a cold visit). */
export function checklistLoaded(labels: ChecklistLabels<PcBalanceChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

function averageOf(assets: readonly PcAsset[]): number | null {
  if (assets.length === 0) {
    return null;
  }
  const total = assets.reduce((sum, asset) => sum + balanceOf(asset), 0);
  return Math.round((total / assets.length) * 10) / 10;
}

/** The audit's overall average balance: the mean of `p - pc` across its assets, to 1 decimal —
 * `null` with no assets (issue #49's implementation notes, and the playbook's assessment-history
 * rule for what a history row shows). */
export function auditAverageBalance(audit: Pick<PcAudit, 'assets'>): number | null {
  return averageOf(audit.assets);
}

/** The audit's history-row summary (issue #226): how many assets are over-used ("2 over-used",
 * plural-correct through `appPlural`), "None over-used" when none are, `null` with no assets yet.
 * Over-use is the result the audit asks the user to act on (a maintenance action), so it is what
 * tells two audits apart at a glance. */
export function auditHistorySummary(
  audit: Pick<PcAudit, 'assets'>,
): AssessmentResultSummary | null {
  if (audit.assets.length === 0) {
    return null;
  }
  const overUsed = audit.assets.filter(isOverUsed).length;
  return overUsed > 0
    ? { key: 'paradigmsPcBalance.history.summary.overUsed', count: overUsed }
    : { key: 'paradigmsPcBalance.history.summary.noneOverUsed' };
}

/** One group's counts and average balance — the audit's "group summary" (issue #49's acceptance
 * criteria). */
export interface PcBalanceGroupSummary {
  readonly group: PcBalanceGroup;
  readonly averageBalance: number | null;
  readonly overUsed: number;
  readonly balanced: number;
  readonly underUsed: number;
}

export function groupSummaries(assets: readonly PcAsset[]): PcBalanceGroupSummary[] {
  return PC_BALANCE_GROUPS.map((group) => {
    const inGroup = assets.filter((asset) => asset.group === group);
    return {
      group,
      averageBalance: averageOf(inGroup),
      overUsed: inGroup.filter((asset) => statusOf(balanceOf(asset)) === 'overUsed').length,
      balanced: inGroup.filter((asset) => statusOf(balanceOf(asset)) === 'balanced').length,
      underUsed: inGroup.filter((asset) => statusOf(balanceOf(asset)) === 'underUsed').length,
    };
  });
}

/** The footer's summary card: how many audits exist, and the most recent one's overall balance. */
export interface PcBalanceSummaryData {
  readonly totalAudits: number;
  readonly latestAverageBalance: number | null;
}

export function summarize(audits: readonly PcAudit[]): PcBalanceSummaryData {
  const live = liveAudits(audits);
  const latest = latestAssessment(live);
  return {
    totalAudits: live.length,
    latestAverageBalance: latest ? auditAverageBalance(latest) : null,
  };
}

/** A new audit dated today, pre-filling asset names and groups from the latest audit that has any
 * assets, with sliders reset to 3 and no carried-over action (issue #49's implementation notes) —
 * an empty asset list without one. A newer audit whose assets were all removed isn't the template
 * (#226 review; maturity's `newAssessmentFields` rule). A suggested asset keeps its built-in key
 * (issue #223); any other gets a fresh one. `history` is newest first. */
export function newAuditFields(history: readonly PcAudit[], today: string): PcAuditFields {
  const latest = history.find((audit) => audit.assets.length > 0);
  return {
    date: today,
    assets: latest
      ? latest.assets.map((asset) => ({
          key: isBuiltInAssetKey(asset.key) ? asset.key : crypto.randomUUID(),
          name: asset.name,
          group: asset.group,
          p: DEFAULT_SLIDER_VALUE,
          pc: DEFAULT_SLIDER_VALUE,
        }))
      : [],
    reflection: '',
  };
}

/** Draft before record (issue #217): a new audit's draft becomes a record on the first real
 * input — a non-blank reflection, or any change to its assets (one added, removed or renamed, a
 * slider moved, an action typed) relative to `initial`, the draft `newAuditFields()` built. The
 * assets copied from the latest audit are not input, and neither is the pre-filled date. */
export function isDraftWorthSaving(
  draft: Pick<PcAudit, 'assets' | 'reflection'>,
  initial: Pick<PcAudit, 'assets'>,
): boolean {
  return (
    draft.reflection.trim() !== '' ||
    JSON.stringify(draft.assets) !== JSON.stringify(initial.assets)
  );
}

/** Merges `fields` into the matching asset only; a no-op copy if `key` is not found. */
export function editAsset(
  assets: readonly PcAsset[],
  key: string,
  fields: Partial<Omit<PcAsset, 'key'>>,
): PcAsset[] {
  return assets.map((asset) => (asset.key === key ? { ...asset, ...fields } : asset));
}

/** Removes the asset `key` from the list. Assets have no tombstone (architecture issue #1 §6
 * applies to records; an asset is a nested value object of its audit, not a record). */
export function removeAsset(assets: readonly PcAsset[], key: string): PcAsset[] {
  return assets.filter((asset) => asset.key !== key);
}

/** Replaces the fields of the live audit `id` with `fields`, leaving every other audit alone; a
 * no-op copy if `id` is not found or already tombstoned. */
export function editAudit(
  audits: readonly PcAudit[],
  id: string,
  fields: Partial<PcAuditFields>,
): PcAudit[] {
  return audits.map((audit) =>
    audit.id === id && isLive(audit) ? { ...audit, ...fields } : audit,
  );
}

/** Tombstones the audit `id` (never removed, architecture issue #1 §6) — issue #203's shared
 * delete pattern. */
export function removeAudit(audits: readonly PcAudit[], id: string, now: Date): PcAudit[] {
  return audits.map((audit) => (audit.id === id ? softDelete(audit, now) : audit));
}

/** Undoes `removeAudit()`: clears the audit `id`'s tombstone and bumps `updatedAt` (issue #203's
 * Undo snackbar). A no-op copy if `id` is not found or was never deleted. */
export function restoreAudit(audits: readonly PcAudit[], id: string, now: Date): PcAudit[] {
  return audits.map((audit) =>
    audit.id === id && !isLive(audit) ? touch({ ...audit, deletedAt: undefined }, now) : audit,
  );
}
