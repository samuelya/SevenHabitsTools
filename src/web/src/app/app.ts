import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DataErrorPage } from './core/data/data-error-page/data-error-page';
import { DocumentBootstrapStatus } from './core/data/document-bootstrap-status';
import { Shell } from './core/layout/shell/shell';

@Component({
  selector: 'app-root',
  imports: [Shell, DataErrorPage],
  template: `
    @if (bootstrapState() === 'corrupt') {
      <app-data-error-page />
    } @else {
      <app-shell />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly bootstrapStatus = inject(DocumentBootstrapStatus);
  protected readonly bootstrapState = this.bootstrapStatus.state;
}
