import { getRegisteredModels } from '../data/registry';
import { PWA_MODEL_KEY } from './pwa.model';

describe('pwa.model', () => {
  it('registers settings.pwa with a null-dismissal default', () => {
    const registration = getRegisteredModels().find((model) => model.key === PWA_MODEL_KEY);

    expect(registration?.path).toBe('settings.pwa');
    expect(registration?.defaults()).toEqual({ installPromptDismissedAt: null });
  });

  it('validates a well-formed slice and rejects a malformed one', () => {
    const registration = getRegisteredModels().find((model) => model.key === PWA_MODEL_KEY);

    expect(registration?.validate?.({ installPromptDismissedAt: null })).toBe(true);
    expect(registration?.validate?.({ installPromptDismissedAt: '2026-01-01T00:00:00.000Z' })).toBe(
      true,
    );
    expect(registration?.validate?.({ installPromptDismissedAt: 123 })).toBe(false);
    expect(registration?.validate?.('not an object')).toBe(false);
    expect(registration?.validate?.(null)).toBe(false);
  });
});
