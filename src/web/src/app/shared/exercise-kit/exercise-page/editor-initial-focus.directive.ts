import { Directive } from '@angular/core';

/**
 * Marks the element inside a projected `[editor]` that `ExercisePage` should focus first when it
 * enters focus mode (issue #185) — typically the first form field. A marker only, no behaviour:
 * `ExercisePage` finds it with `contentChild(EditorInitialFocus, { read: ElementRef })`, so it
 * never needs to know which element or component the caller decorates. Without one, the scaffold
 * focuses its own editor header heading instead.
 */
@Directive({ selector: '[appEditorInitialFocus]' })
export class EditorInitialFocus {}
