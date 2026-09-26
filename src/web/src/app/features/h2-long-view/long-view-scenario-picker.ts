import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import { LONG_VIEW_SCENARIOS, LongViewScenario } from './long-view.model';

/** The four long views as cards acting as buttons (issue #58), one column at 360 px.
 * Presentational: it emits the choice and the page opens the stepper. */
@Component({
  selector: 'app-long-view-scenario-picker',
  imports: [EditorInitialFocus, NgTemplateOutlet, TranslocoPipe],
  templateUrl: './long-view-scenario-picker.html',
  styleUrl: './long-view-scenario-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LongViewScenarioPicker {
  readonly picked = output<LongViewScenario>();

  protected readonly scenarios = LONG_VIEW_SCENARIOS;
}
