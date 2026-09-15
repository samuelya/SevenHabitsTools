import { getAtPath } from '../document-path.utils';
import { RootDocument } from '../document.model';
import { BaseRecord } from '../record';
import { getRegisteredModels } from '../registry';

export interface ImportFeatureCount {
  readonly key: string;
  readonly count: number;
}

export interface ImportPreview {
  readonly updatedAt: string;
  readonly counts: readonly ImportFeatureCount[];
}

function isBaseRecord(value: unknown): value is BaseRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { updatedAt?: unknown }).updatedAt === 'string'
  );
}

/** A rough "how much is in here" count for one registered model's slice, live (non-tombstoned)
 * records only: the length of a record collection, 1 for a live singleton record or a non-empty
 * plain value, 0 for anything empty, tombstoned or absent. */
function countSlice(value: unknown): number {
  if (Array.isArray(value)) {
    return value.filter((item) => !isBaseRecord(item) || item.deletedAt === undefined).length;
  }
  if (isBaseRecord(value)) {
    return value.deletedAt === undefined ? 1 : 0;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length > 0 ? 1 : 0;
  }
  return 0;
}

/** Builds the per-feature counts and the document's `meta.updatedAt` the import dialog previews
 * before the user picks Replace or Merge — driven by the model registry, so a feature that
 * registers a model later shows up here automatically, with no change to this function. */
export function buildImportPreview(document: RootDocument): ImportPreview {
  const counts = getRegisteredModels().map((model) => ({
    key: model.key,
    count: countSlice(getAtPath(document as unknown as Record<string, unknown>, model.path)),
  }));
  return { updatedAt: document.meta.updatedAt, counts };
}
