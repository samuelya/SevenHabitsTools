import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subscription, filter, merge } from 'rxjs';
import { translatePlural } from './plural.logic';

/**
 * Plural-correct counts without `transloco-messageformat` (issue #133: that plugin costs initial
 * bundle bytes for every page, not just the ones with a count to render). The form is picked by
 * `translatePlural()` (`plural.logic.ts`), which a page building a label in a `computed()` uses
 * too.
 *
 * Reactive, unlike a naive impure pipe that only reads `getTranslation()`/`translate()`
 * synchronously: this exercise's scope loads over HTTP and only once something asks for it, so a
 * cold render (a deep link straight to the page) can run `transform()` before it has arrived.
 * Nothing is translated until `translatePlural()` finds the strings loaded, and the load-event
 * subscription re-renders the binding once they are. This is the same cold-load gap the playbook's
 * "Reactive labels" section documents for `translateSignal`/a `computed()` reading `translate()`
 * directly.
 *
 * Not built on `TranslocoPipe` (which handles cold loads the same way) because the CLDR category
 * can only be picked once the translations are loaded: `TranslocoPipe` caches the key it was
 * called with and captures it in the subscription it opens, so it would keep rendering whatever
 * category was resolvable *before* the scope arrived — permanently `other` where `ar` wanted
 * `few`. Its `updateValue()` is not an extension point either.
 */
@Pipe({ name: 'appPlural', standalone: true, pure: false })
export class AppPluralPipe implements PipeTransform, OnDestroy {
  private readonly transloco = inject(TranslocoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private subscription: Subscription | null = null;

  transform(key: string, count: number, params: Record<string, unknown> = {}): string {
    // One subscription per pipe instance (a template binding gets its own instance, reused across
    // change-detection cycles), not per call: every scope load re-renders every `appPlural`
    // binding, not just the one that happened to trigger it.
    //
    // Both streams, not just the load event: a language the user has already visited is cached, so
    // switching back to it fires no `translationLoadSuccess` at all. An `OnPush` component whose
    // inputs didn't change (a counts card whose numbers are the same) would then keep rendering
    // the previous language's strings until something unrelated marked it dirty. `TranslocoPipe`
    // marks for check on every language change for the same reason.
    this.subscription ??= merge(
      this.transloco.langChanges$,
      this.transloco.events$.pipe(filter((event) => event.type === 'translationLoadSuccess')),
    ).subscribe(() => this.cdr.markForCheck());
    return translatePlural(this.transloco, key, count, params);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
