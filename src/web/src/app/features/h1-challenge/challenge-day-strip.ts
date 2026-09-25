import { FocusKeyManager, FocusableOption } from '@angular/cdk/a11y';
import { Directionality } from '@angular/cdk/bidi';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  Injector,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  viewChildren,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../core/i18n/locale.pipe';
import { parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import type { DayCell, DayState } from './challenge.logic';

/** One day button, as the `FocusKeyManager` sees it. */
@Directive({ selector: 'button[appDayCell]' })
export class ChallengeDayCell implements FocusableOption {
  readonly date = input.required<string>({ alias: 'appDayCell' });
  private readonly host = inject<ElementRef<HTMLButtonElement>>(ElementRef);

  focus(): void {
    this.host.nativeElement.focus();
  }

  isElement(target: EventTarget | null): boolean {
    return target === this.host.nativeElement;
  }
}

const STATE_ICONS: Readonly<Record<DayState, string | null>> = {
  checkedIn: 'check',
  skipped: 'remove',
  missed: 'close',
  today: null,
  future: null,
};

/**
 * The 30-day strip (issue #56): one `role="group"` tab stop with a roving tabindex (the lead's
 * keyboard decision on #56). Arrow Left/Right move one day in the text direction (in RTL, Right
 * goes back), Home/End go to day 1/day 30, Up/Down do nothing: the wrap at 360 px is visual only.
 *
 * The tab stop rests on `anchorDate` (today, clamped to the window) and follows the arrows. It is a
 * `linkedSignal` of the anchor, so a store write that re-renders the cells (a saved check-in)
 * keeps it where it is, while the anchor moving at local midnight moves it to the new today. The
 * cells are tracked by date, so the focused button survives a re-render as the same element.
 * Presentational: the page decides what selecting a day means.
 */
@Component({
  selector: 'app-challenge-day-strip',
  imports: [ChallengeDayCell, MatIconModule, TranslocoPipe, AppDatePipe],
  templateUrl: './challenge-day-strip.html',
  styleUrl: './challenge-day-strip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChallengeDayStrip {
  private static nextId = 0;

  readonly cells = input.required<readonly DayCell[]>();
  /** Where the tab stop rests until the user moves it. */
  readonly anchorDate = input.required<string>();
  readonly selectedDate = input<string | null>(null);
  readonly daySelected = output<string>();

  private readonly dir = inject(Directionality);
  private readonly items = viewChildren(ChallengeDayCell);
  private readonly keyManager = new FocusKeyManager(this.items, inject(Injector))
    .withVerticalOrientation(false)
    .withHomeAndEnd()
    .withWrap(false);

  protected readonly legendId = `challenge-strip-legend-${ChallengeDayStrip.nextId++}`;
  protected readonly icons = STATE_ICONS;
  protected readonly view = computed(() =>
    this.cells().map((cell) => ({ ...cell, when: parseIsoDate(cell.date) })),
  );

  private readonly activeDate = linkedSignal(() => this.anchorDate());
  /** The one cell with `tabindex="0"`: the active date, or day 1 if it isn't in the strip. */
  protected readonly tabStop = computed(() => {
    const cells = this.cells();
    const active = this.activeDate();
    return cells.some((cell) => cell.date === active) ? active : (cells[0]?.date ?? null);
  });

  constructor() {
    this.keyManager.change.subscribe((index) => {
      const item = this.items()[index];
      if (item) {
        this.activeDate.set(item.date());
      }
    });
  }

  /** Moves from the focused cell, not the tab stop: at local midnight the tab stop moves to the
   * new today while focus stays where the user left it (measured on #56's design check). */
  protected onKeydown(event: KeyboardEvent): void {
    const items = this.items();
    const focused = items.findIndex((item) => item.isElement(event.target));
    const index =
      focused >= 0 ? focused : items.findIndex((item) => item.date() === this.tabStop());
    this.keyManager.withHorizontalOrientation(this.dir.value);
    this.keyManager.updateActiveItem(Math.max(0, index));
    this.keyManager.onKeydown(event);
  }

  protected onFocus(date: string): void {
    this.activeDate.set(date);
  }

  protected select(date: string): void {
    this.activeDate.set(date);
    this.daySelected.emit(date);
  }
}
