import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe, AppNumberPipe } from '../../core/i18n/locale.pipe';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { diffSummary, diffWords } from '../../shared/mission/mission-diff.logic';
import { VersionRow, versionRows } from '../../shared/mission/mission.logic';
import { MissionVersion } from '../../shared/mission/mission.model';

/** The two versions the compare view shows, by id. */
interface ComparePair {
  readonly from: string;
  readonly to: string;
}

/**
 * The "Versions" section (issue #62): the saved versions newest first as buttons, the tapped one's
 * full text read-only with Restore and Compare, and a word-level diff between any two. Only the
 * selection and the compared pair are its own (view state, keyed to version ids); Restore goes to
 * the page as an output, which asks before replacing an unsaved draft.
 */
@Component({
  selector: 'app-mission-versions',
  imports: [
    AppDatePipe,
    AppNumberPipe,
    AppPluralPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    TranslocoPipe,
  ],
  templateUrl: './mission-versions.html',
  styleUrl: './mission-versions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissionVersions {
  readonly versions = input.required<readonly MissionVersion[]>();
  /** The number of the version just restored, for "Version n is now your draft.", or `null`. */
  readonly restored = input<number | null>(null);
  readonly restore = output<string>();

  protected readonly rows = computed(() => versionRows(this.versions()));
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed<VersionRow | null>(
    () => this.rows().find((row) => row.id === this.selectedId()) ?? null,
  );
  /** Reset whenever another version is selected; a save or restore (same ids) keeps it. */
  protected readonly compare = linkedSignal<string | null, ComparePair | null>({
    source: this.selectedId,
    computation: () => null,
  });

  protected readonly diff = computed(() => {
    const pair = this.compare();
    const textOf = (id: string) => this.versions().find((version) => version.id === id)?.text;
    const from = pair && textOf(pair.from);
    const to = pair && textOf(pair.to);
    if (from === null || from === undefined || to === null || to === undefined) {
      return null;
    }
    const parts = diffWords(from, to);
    return { parts, summary: diffSummary(parts) };
  });

  protected onSelect(id: string): void {
    this.selectedId.update((current) => (current === id ? null : id));
  }

  /** "Compare": the selected version against the one saved before it. */
  protected onCompare(row: VersionRow): void {
    const previous = this.rows().find((candidate) => candidate.n === row.n - 1);
    if (previous) {
      this.compare.set({ from: previous.id, to: row.id });
    }
  }

  protected onPick(side: keyof ComparePair, event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.compare.update((pair) => (pair ? { ...pair, [side]: id } : pair));
  }
}
