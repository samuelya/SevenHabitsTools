import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  contentChildren,
  computed,
  effect,
  inject,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatStep, MatStepperModule } from '@angular/material/stepper';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { HANDSET_QUERY } from '../../../core/layout/breakpoints';
import { AppNumberPipe } from '../../../core/i18n/locale.pipe';
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
 *
 * "Back" is hidden on the first step and "Next" on the last (issue #212) — both would otherwise
 * render disabled-looking dead ends. "Next" itself is never disabled: a page should only ever set
 * a step's `done` to `true` once complete and leave it `undefined` otherwise (never an explicit
 * `false`), since binding `[completed]="false"` on `mat-step` overrides `CdkStepper`'s own
 * `interacted`-based tracking and blocks `next()` under `linear` mode — the same "skipping ahead
 * is allowed" acceptance criterion this issue calls out.
 *
 * `done` is applied to the matching `MatStep` **imperatively** (`viewChildren`, not a template
 * `[completed]` binding): a template binding calls the `completed` setter every change-detection
 * run, and Angular's `booleanAttribute` input transform coerces a bound `undefined` back to
 * `false` — an explicit override that blocks `next()` under `linear` mode, the same "skipping
 * ahead is allowed" acceptance criterion this issue calls out. Writing imperatively sidesteps that
 * transform: it goes straight to `CdkStep`'s own `completed` accessor, so we choose exactly what
 * it stores. This keeps one steady `<mat-step>` per step — the previous
 * `@if (step.done === undefined) { … } @else { … }` swapped the whole step's `@if`/`@else` branch,
 * and `@for`'s identity tracking (`track step.key` on the outer loop, but the branch swap still
 * changes which template embedded view exists) destroyed and recreated the projected content on
 * every `undefined ↔ true` flip — including the field the user was mid-keystroke in.
 *
 * On `step.done === true` this sets `completed = true`, an explicit override. On `undefined` —
 * the step regressed, e.g. the user deleted the text that completed it (review finding on this
 * PR) — it clears `_completedOverride` back to `null` instead of writing `completed = false`:
 * `false` is *also* an explicit override (`CdkStep`'s setter stores whatever it's given, `null` or
 * not), and would wrongly block `next()` exactly like the `booleanAttribute(undefined) === false`
 * coercion above. Clearing the override falls back to `CdkStep`'s own `interacted`-based state —
 * "no completion state", the same thing `undefined` means everywhere else in this contract — so
 * the header's tick and the checklist's "unmet" agree again.
 */
@Component({
  selector: 'app-guided-stepper',
  imports: [AppNumberPipe, MatButtonModule, MatStepperModule, NgTemplateOutlet, TranslocoPipe],
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
  private readonly stepInstances = viewChildren(MatStep);

  protected readonly handset = toSignal(
    this.breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(HANDSET_QUERY) },
  );
  protected readonly orientation = computed(() => (this.handset() ? 'vertical' : 'horizontal'));

  constructor() {
    // Never assigns `completed = false` — see the class doc comment on why that's also a wrongly
    // sticky override here. `MatStep.completed` is a plain accessor, not a template binding, so
    // this bypasses the `booleanAttribute` transform entirely.
    effect(() => {
      const steps = this.steps();
      const instances = this.stepInstances();
      steps.forEach((step, index) => {
        const instance = instances[index];
        if (!instance) {
          return;
        }
        if (step.done === true) {
          instance.completed = true;
        } else {
          instance._completedOverride.set(null);
        }
      });
    });
  }

  protected templateFor(step: string): TemplateRef<unknown> | null {
    return this.stepContents().find((content) => content.step() === step)?.templateRef ?? null;
  }
}
