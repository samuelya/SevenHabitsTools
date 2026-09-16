import { BidiModule } from '@angular/cdk/bidi';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DataErrorPage } from './core/data/data-error-page/data-error-page';
import { DocumentBootstrapStatus } from './core/data/document-bootstrap-status';
import { LanguageSync } from './core/i18n/language-sync';
import { Shell } from './core/layout/shell/shell';

@Component({
  selector: 'app-root',
  imports: [BidiModule, Shell, DataErrorPage],
  // The CDK `Dir` directive (`[dir]`, from `BidiModule`) makes Material's `Directionality` follow
  // `LanguageSync.direction` reactively for every descendant — `<html dir>` alone (set by
  // `LanguageSync`) only affects CSS and screen readers, not components that read `Directionality`
  // through DI (overlay positioning, `mat-drawer`'s side, ...).
  template: `
    <div [dir]="languageSync.direction()">
      @if (bootstrapState() !== 'ready') {
        <app-data-error-page />
      } @else {
        <app-shell />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly bootstrapStatus = inject(DocumentBootstrapStatus);
  protected readonly languageSync = inject(LanguageSync);
  protected readonly bootstrapState = this.bootstrapStatus.state;
}
