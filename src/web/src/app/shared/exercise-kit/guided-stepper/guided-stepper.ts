import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  contentChildren,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { HANDSET_QUERY } from '../../../core/layout/breakpoints';
import { GuidedStepContent } from './guided-step-content';

/** One step of a `GuidedStepper`; `label` is already-translated text from the calling feature's
 * own scope, and `done` (if it tracks per-step completion) is the feature's own call. */
export interface GuidedStepDefinition {
  readonly key: string;
  readonly label: string;
  readonly done?: boolean;
}

/**
 * A Material stepper wrapping a feature's own steps (their content projected as
 * `<ng-template appGuidedStep="…">`, see `GuidedStepContent`), horizontal on desktop and vertical
 * on mobile (issue #30). Purely presentational: it neither knows about nor saves the document —
 * `selectedIndex`/`selectedIndexChange` let the caller persist the current step through its own
 * `ExerciseProgress`/`featureStore`, the "saves per step" acceptance criterion.
 */
@Component({
  selector: 'app-guided-stepper',
  imports: [MatButtonModule, MatStepperModule, NgTemplateOutlet, TranslocoPipe],
  templateUrl: './guided-stepper.html',
  styleUrl: './guided-stepper.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidedStepper {
  private readonly breakpoints = inject(BreakpointObserver);

  readonly steps = input.required<readonly GuidedStepDefinition[]>();
  readonly linear = input(true);
  readonly selectedIndex = input(0);
  readonly selectedIndexChange = output<number>();

  private readonly stepContents = contentChildren(GuidedStepContent);

  protected readonly handset = toSignal(
    this.breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(HANDSET_QUERY) },
  );
  protected readonly orientation = computed(() => (this.handset() ? 'vertical' : 'horizontal'));

  protected templateFor(step: string): TemplateRef<unknown> | null {
    return this.stepContents().find((content) => content.step() === step)?.templateRef ?? null;
  }
}
