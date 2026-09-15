import { registerModel } from '../data/registry';

/** `registry.ts` key for this slice; `featureStore(PWA_MODEL_KEY)` resolves it back to its path. */
export const PWA_MODEL_KEY = 'pwa';

/**
 * Settings for PWA install/update UI (issue #27). Not tied to a nav feature — it lives in `core`
 * (like `multi-tab`, `data`) rather than `features/`, since it's a shell capability, not a routed
 * page. `installPromptDismissedAt` is the only persisted state: how long the install banner stays
 * hidden after the user dismisses it (`install-prompt.logic.ts`), stored so the snooze survives a
 * reload and travels with export/import like the rest of the document.
 */
export interface PwaSettings {
  readonly installPromptDismissedAt: string | null;
}

function defaults(): PwaSettings {
  return { installPromptDismissedAt: null };
}

function isPwaSettingsShape(value: unknown): value is PwaSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const dismissedAt = (value as { installPromptDismissedAt?: unknown }).installPromptDismissedAt;
  return dismissedAt === null || typeof dismissedAt === 'string';
}

registerModel<PwaSettings>({
  key: PWA_MODEL_KEY,
  path: 'settings.pwa',
  defaults,
  validate: isPwaSettingsShape,
});
