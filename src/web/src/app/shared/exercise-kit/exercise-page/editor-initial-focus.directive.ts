import { DestroyRef, Directive, ElementRef, InjectionToken, inject } from '@angular/core';

/** Implemented by `ExercisePage`; the seam `EditorInitialFocus` registers through. */
export interface EditorFocusHost {
  registerInitialFocus(element: ElementRef<HTMLElement>): void;
  unregisterInitialFocus(element: ElementRef<HTMLElement>): void;
}

export const EDITOR_FOCUS_HOST = new InjectionToken<EditorFocusHost>('EDITOR_FOCUS_HOST');

/**
 * Marks the element inside a projected `[editor]` that `ExercisePage` should focus first when it
 * enters focus mode (issue #185) — typically the first form field. Without one, the scaffold
 * focuses its own editor header heading instead.
 *
 * The marker *registers itself* with the page through `EDITOR_FOCUS_HOST` rather than being found
 * by a `contentChild` query on `ExercisePage` (issue #187): a content query only sees nodes from
 * the page's own template, so a marker inside a nested presentational editor component — which
 * most exercises' editors are — silently did nothing, leaving that component to hand-roll its own
 * focus. Injection walks the element-injector chain instead, which does reach out of a nested
 * component's view into the page that projects it, so both placements now work the same way.
 */
@Directive({ selector: '[appEditorInitialFocus]' })
export class EditorInitialFocus {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef);
    const host = inject(EDITOR_FOCUS_HOST, { optional: true });
    host?.registerInitialFocus(element);
    inject(DestroyRef).onDestroy(() => host?.unregisterInitialFocus(element));
  }
}
