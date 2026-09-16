import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, computed, effect, inject, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { LanguageStore } from './language-store';
import { Language, directionFor } from './language';

/**
 * Keeps the active language in sync across three places whenever `LanguageStore.language`
 * changes (a persisted choice, or — before one is ever made — the browser's own language):
 * Transloco's active language, `<html lang dir>`, and `direction` (read by the CDK `Dir` wrapper
 * around the app root so Material's `Directionality` follows too — see `App`). Nothing else in
 * the app writes any of those three directly. Read/write access to the setting itself is
 * `LanguageStore`'s job, not this class's.
 */
@Injectable({ providedIn: 'root' })
export class LanguageSync {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);
  private readonly languageStore = inject(LanguageStore);

  readonly effectiveLanguage = this.languageStore.language;
  readonly direction = computed(() => directionFor(this.effectiveLanguage()));

  /**
   * Loads and applies the current effective language, awaited before the app renders anything —
   * called from the same `provideAppInitializer` chain that bootstraps the document, right after
   * it resolves, so `settings.language` is already known. This is what makes the choice "applied
   * before first paint" (issue #28's acceptance criteria): Angular defers its own first render
   * until every app initializer settles.
   */
  async initialize(): Promise<void> {
    await this.switchTo(untracked(this.effectiveLanguage));
  }

  /** Reacts to a later change — the user picking a language in Settings. The browser's own
   * language never changes at runtime, so this is the only source of change after `initialize()`. */
  start(): void {
    let seen = untracked(this.effectiveLanguage);
    effect(
      () => {
        const lang = this.effectiveLanguage();
        if (lang !== seen) {
          seen = lang;
          untracked(() => void this.switchTo(lang));
        }
      },
      { injector: this.injector },
    );
  }

  private async switchTo(lang: Language): Promise<void> {
    await firstValueFrom(this.transloco.load(lang));
    this.document.documentElement.lang = lang;
    this.document.documentElement.dir = directionFor(lang);
    this.transloco.setActiveLang(lang);
  }
}
