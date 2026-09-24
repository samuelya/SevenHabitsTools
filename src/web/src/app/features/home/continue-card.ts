import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/** Today's "Continue" card (issue #220): one link whose accessible name is its whole text, the
 * exercise title first. Presentational: every string arrives translated. */
@Component({
  selector: 'app-continue-card',
  imports: [MatIconModule, RouterLink],
  template: `
    <a class="continue-card" [routerLink]="link()">
      <mat-icon class="continue-card__icon flip-in-rtl" aria-hidden="true">play_circle</mat-icon>
      <span class="continue-card__text">
        <span class="continue-card__label">{{ label() }}</span
        >&ngsp;
        <span class="continue-card__habit">{{ habitTitle() }}</span>
        @if (detail(); as detail) {
          &ngsp;<span class="continue-card__detail">{{ detail }}</span>
        }
      </span>
    </a>
  `,
  styles: `
    :host {
      display: block;
    }

    .continue-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-block-size: 44px;
      padding-block: 0.75rem;
      padding-inline: 1rem;
      border: 1px solid var(--mat-sys-outline-variant, lightgray);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container-low, transparent);
      color: inherit;
      text-decoration: none;
    }

    .continue-card:hover {
      background: var(--mat-sys-surface-container, transparent);
    }

    .continue-card:focus-visible {
      outline: 2px solid var(--mat-sys-primary, currentColor);
      outline-offset: 2px;
    }

    .continue-card__icon {
      flex: none;
      color: var(--mat-sys-primary, currentColor);
      inline-size: 32px;
      block-size: 32px;
      font-size: 32px;
    }

    .continue-card__text {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-inline-size: 0;
    }

    .continue-card__label {
      font-weight: 500;
      overflow-wrap: anywhere;
    }

    .continue-card__habit,
    .continue-card__detail {
      color: var(--mat-sys-on-surface-variant, gray);
      font-size: 0.875rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContinueCard {
  readonly link = input.required<string>();
  /** "Continue: <exercise short title>". */
  readonly label = input.required<string>();
  /** The exercise's habit, by its short title. */
  readonly habitTitle = input.required<string>();
  /** In-progress text ("2 of 3 steps"), or `null` when the exercise isn't started. */
  readonly detail = input<string | null>(null);
}
