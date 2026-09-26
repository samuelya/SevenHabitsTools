import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { MissionInputItem } from '../../shared/mission-inputs/mission-inputs';
import {
  CollectionKind,
  collectionKinds,
  collectionTags,
  filterCollection,
} from './mission.logic';

/** The "All" chip's value: a chip listbox needs a value, the filter stores `null`. */
const ALL = '';

/**
 * Step 5's "Your collection" panel (issue #61): the `inspiration` mission input with a kind and a
 * tag filter; "Use this" asks the page to append an item to the draft. Presentational: the page
 * owns the draft and says which item was used last (`usedId`), shown with "Added to the end of your
 * draft." next to it. Starts expanded on desktop and collapsed on a handset (`startExpanded`).
 */
@Component({
  selector: 'app-mission-collection',
  imports: [MatButtonModule, MatChipsModule, MatIconModule, RouterLink, TranslocoPipe],
  templateUrl: './mission-collection.html',
  styleUrl: './mission-collection.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissionCollection {
  private readonly injector = inject(Injector);
  readonly items = input.required<readonly MissionInputItem[]>();
  readonly startExpanded = input(true);
  readonly usedId = input<string | null>(null);
  /** Where "Go to Your collection" leads. */
  readonly collectionLink = input.required<string>();
  readonly used = output<MissionInputItem>();

  protected readonly all = ALL;
  protected readonly expanded = linkedSignal(() => this.startExpanded());
  protected readonly kinds = computed(() => collectionKinds(this.items()));
  protected readonly tags = computed(() => collectionTags(this.items()));
  /** Cleared when its kind or tag is no longer present. */
  protected readonly kind = linkedSignal<readonly CollectionKind[], CollectionKind | null>({
    source: this.kinds,
    computation: (kinds, previous) =>
      previous?.value && kinds.includes(previous.value) ? previous.value : null,
  });
  protected readonly tag = linkedSignal<readonly string[], string | null>({
    source: this.tags,
    computation: (tags, previous) =>
      previous?.value && tags.includes(previous.value) ? previous.value : null,
  });
  protected readonly filtered = computed(() =>
    filterCollection(this.items(), { kind: this.kind(), tag: this.tag() }),
  );

  /** Asks the page to use `item`, then brings its "Added…" line into the scroll port once it
   * renders: the editor's status line appearing above pushes the panel down 24px, and at 360px
   * the line wraps under the button, which put it below the fold (measured on #61). `nearest`
   * keeps the user's place in the panel; the page never jumps back up to the editor. */
  protected use(item: MissionInputItem, row: HTMLElement): void {
    this.used.emit(item);
    afterNextRender(
      { write: () => row.querySelector('.used')?.scrollIntoView?.({ block: 'nearest' }) },
      { injector: this.injector },
    );
  }

  protected toggle(): void {
    this.expanded.update((expanded) => !expanded);
  }

  protected onKindChange(event: MatChipListboxChange): void {
    const value = event.value as CollectionKind | typeof ALL | undefined;
    this.kind.set(value ? value : null);
  }

  protected onTagChange(event: MatChipListboxChange): void {
    this.tag.set((event.value as string | undefined) ?? null);
  }
}
