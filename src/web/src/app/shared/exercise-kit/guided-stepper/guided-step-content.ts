import { Directive, TemplateRef, inject, input } from '@angular/core';

/**
 * Marks an `<ng-template>` as a `GuidedStepper` step's content, keyed by `step`. `ng-content`
 * selectors are static, so a stepper built from a dynamic `steps()` list can't project each step's
 * content through a matching `[step=key]` selector; this directive lets `GuidedStepper` instead
 * collect every projected template (`contentChildren`) and render the one matching each step by
 * `*ngTemplateOutlet` — new step content plugs in by adding another `<ng-template appGuidedStep="…">`
 * in the caller's markup, never by editing `GuidedStepper` itself.
 */
@Directive({ selector: 'ng-template[appGuidedStep]' })
export class GuidedStepContent {
  readonly step = input.required<string>({ alias: 'appGuidedStep' });
  readonly templateRef = inject(TemplateRef);
}
