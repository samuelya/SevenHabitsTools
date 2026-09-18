import { BaseRecord } from '../../core/data/record';
import { isArrayOf, isBaseRecord, isOptionalString } from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';

/**
 * One "done episode" for an exercise: `completedAt` when `ExerciseProgress.markDone()` was called,
 * optionally followed by `reopenedAt` if the user later reopened it (issue #30's data model). The
 * document keeps one record per `exerciseId` — `markDone()`/`reopen()` upsert it rather than
 * appending a new one each time, so the array never grows unbounded, per record is never
 * hard-deleted (architecture issue #1 §6).
 */
export interface ExerciseCompletion extends BaseRecord {
  readonly exerciseId: string;
  readonly completedAt: string;
  readonly reopenedAt?: string;
}

/** The model key `featureStore<ExerciseCompletion[]>()` callers resolve. */
export const EXERCISE_COMPLETIONS_MODEL_KEY = 'exerciseCompletions';

/** The document path this model lives at (architecture issue #1 §6: `shared.<entity>`). */
export const EXERCISE_COMPLETIONS_PATH = 'shared.exerciseCompletions';

function isExerciseCompletion(value: unknown): value is ExerciseCompletion {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['exerciseId'] === 'string' &&
    typeof candidate['completedAt'] === 'string' &&
    isOptionalString(candidate['reopenedAt'])
  );
}

const isExerciseCompletionArray = isArrayOf(isExerciseCompletion);

/**
 * Registers the `exerciseCompletions` model, a no-op if it already is — same idempotent guard as
 * `registerBackupModel()` (`core/data/backup/backup.model.ts`), needed because Vitest here runs
 * with `isolate: false` (shared module state across spec files).
 */
export function registerExerciseKitModel(): void {
  if (getRegisteredModels().some((model) => model.key === EXERCISE_COMPLETIONS_MODEL_KEY)) {
    return;
  }
  registerModel<ExerciseCompletion[]>({
    key: EXERCISE_COMPLETIONS_MODEL_KEY,
    path: EXERCISE_COMPLETIONS_PATH,
    defaults: () => [],
    validate: isExerciseCompletionArray,
  });
}

registerExerciseKitModel();
