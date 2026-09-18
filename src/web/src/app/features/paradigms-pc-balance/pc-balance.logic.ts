import { newRecord, isLive } from '../../core/data/record';
import {
  latestAssessment,
  liveAssessments,
} from '../../shared/exercise-kit/assessment-history.logic';
import {
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

/** An asset is complete once it isn't over-used, or — once it is — it names one maintenance
 * action (issue #49's acceptance criteria). Pure business rule, kept out of `validate()`
 * (architecture issue #1 §6). */
export function isAssetComplete(asset: Pick<PcAsset, 'p' | 'pc' | 'action'>): boolean {
  return !isOverUsed(asset) || Boolean(asset.action?.trim());
}

/** Live audits only (architecture issue #1 §6: tombstoned records are never shown). */
export function liveAudits(audits: readonly PcAudit[]): PcAudit[] {
  return liveAssessments(audits);
}

/** An audit is complete once it has at least one asset and every over-used asset names an action
 * (issue #49's implementation notes). */
export function isAuditComplete(audit: Pick<PcAudit, 'assets'>): boolean {
  return audit.assets.length > 0 && audit.assets.every(isAssetComplete);
}

/** Whether `DoneToggle` should be enabled: at least one live audit is complete. */
export function canMarkDone(audits: readonly PcAudit[]): boolean {
  return liveAudits(audits).some(isAuditComplete);
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

/** A new audit dated today, pre-filling asset names and groups from the latest audit with sliders
 * reset to 3 and no carried-over action (issue #49's implementation notes) — an empty asset list
 * when there is no previous audit. */
export function newAuditFields(latest: PcAudit | null, today: string): PcAuditFields {
  return {
    date: today,
    assets: latest
      ? latest.assets.map((asset) => ({
          key: crypto.randomUUID(),
          name: asset.name,
          group: asset.group,
          p: DEFAULT_SLIDER_VALUE,
          pc: DEFAULT_SLIDER_VALUE,
        }))
      : [],
    reflection: '',
  };
}

/** Appends a new asset to one audit's asset list, both sliders starting at 3. */
export function addAsset(
  assets: readonly PcAsset[],
  name: string,
  group: PcBalanceGroup,
): PcAsset[] {
  return [
    ...assets,
    { key: crypto.randomUUID(), name, group, p: DEFAULT_SLIDER_VALUE, pc: DEFAULT_SLIDER_VALUE },
  ];
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

/** Appends a new audit created from `fields`, stamped with a fresh id and `now`. */
export function addAudit(audits: readonly PcAudit[], fields: PcAuditFields, now: Date): PcAudit[] {
  return [...audits, newRecord(fields, now)];
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
