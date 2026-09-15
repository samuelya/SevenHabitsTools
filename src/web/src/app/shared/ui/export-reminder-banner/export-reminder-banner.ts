import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

/**
 * The "export your data" reminder banner: renders whenever its opener (`HomePage`) decides it
 * should (`shouldShowExportReminder()`), and reports "export now" and "dismiss" back — it has no
 * read of the document, the backup settings or the writer lock itself, so it stays reusable for
 * any future reminder with the same shape.
 */
@Component({
  selector: 'app-export-reminder-banner',
  imports: [MatButtonModule],
  templateUrl: './export-reminder-banner.html',
  styleUrl: './export-reminder-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportReminderBanner {
  readonly message = input.required<string>();
  readonly exportLabel = input.required<string>();
  readonly dismissLabel = input.required<string>();

  readonly exportNow = output<void>();
  readonly dismiss = output<void>();
}
