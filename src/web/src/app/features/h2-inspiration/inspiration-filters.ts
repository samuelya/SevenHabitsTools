import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { INSPIRATION_KINDS, InspirationKind } from './inspiration.model';

/** The "All" chip's value in the kind listbox (the filter is then `null`). */
const ALL = 'all';

/**
 * The filters above the list (issue #63): kind chips (All plus the three kinds), a Favourites
 * toggle, and a single-select tag listbox shown once any item has a tag. Presentational: the page
 * owns the filter state and applies it with `filtered()`.
 */
@Component({
  selector: 'app-inspiration-filters',
  imports: [MatButtonModule, MatChipsModule, MatIconModule, TranslocoPipe],
  templateUrl: './inspiration-filters.html',
  styleUrl: './inspiration-filters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspirationFilters {
  readonly kind = input<InspirationKind | null>(null);
  readonly favouritesOnly = input(false);
  readonly tag = input<string | null>(null);
  /** The tags to offer, already distinct and sorted (`allTags()`). */
  readonly tags = input<readonly string[]>([]);
  readonly kindChange = output<InspirationKind | null>();
  readonly favouritesOnlyChange = output<boolean>();
  readonly tagChange = output<string | null>();

  protected readonly all = ALL;
  protected readonly kinds = INSPIRATION_KINDS;

  /** Tapping the selected chip deselects it in the listbox: for a kind that means "All", and on
   * "All" itself it is a re-selection, so the chip is selected again and nothing is emitted. */
  protected onKindChange(event: MatChipListboxChange): void {
    const value = event.value as InspirationKind | typeof ALL | undefined;
    if (value === undefined && this.kind() === null) {
      event.source.value = ALL;
      return;
    }
    const kind = value === undefined || value === ALL ? null : value;
    if (kind === null) {
      event.source.value = ALL;
    }
    this.kindChange.emit(kind);
  }

  /** Tapping the selected tag clears the tag filter. */
  protected onTagChange(event: MatChipListboxChange): void {
    this.tagChange.emit((event.value as string | undefined) ?? null);
  }
}
