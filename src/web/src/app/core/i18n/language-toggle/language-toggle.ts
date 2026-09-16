import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageStore } from '../language-store';
import { Language } from '../language';

/** The language a click on the toggle switches *to* — the other one, of the two supported. */
function otherLanguage(current: Language): Language {
  return current === 'en' ? 'ar' : 'en';
}

/**
 * The language switcher (issue #28's acceptance criteria: "in the shell and in Settings"). One
 * component, used in both places (`Shell`'s toolbar and `SettingsPage`). A single toggle button
 * rather than a menu — there are only two supported languages, so "switch to the other one" is
 * one tap and needs no `MatMenuModule`/CDK Overlay (a meaningful chunk of eager bundle weight,
 * see issue #133's 500 kB budget) for a choice between two options. Reads and writes
 * `LanguageStore` directly rather than taking `input()`/`output()`s — like `ReadOnlyBanner`, this
 * is a small shell-level widget, not a feature page bound by the container/presentational split.
 */
@Component({
  selector: 'app-language-toggle',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    <button
      mat-icon-button
      type="button"
      (click)="languageStore.setLanguage(target())"
      [attr.aria-label]="'language.switchTo' | transloco: { language: targetName() }"
    >
      <mat-icon aria-hidden="true">translate</mat-icon>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageToggle {
  protected readonly languageStore = inject(LanguageStore);
  private readonly transloco = inject(TranslocoService);

  protected readonly target = computed(() => otherLanguage(this.languageStore.language()));
  protected readonly targetName = computed(() => {
    // Reads `activeLang()` (unused otherwise) so this recomputes when Transloco's active
    // language — not just the target language — changes, since that's what `translate()` reads.
    const activeLang = this.transloco.activeLang();
    return this.transloco.translate(`language.${this.target()}`, {}, activeLang);
  });
}
