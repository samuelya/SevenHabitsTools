import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDrawer } from '@angular/material/sidenav';
import { provideTranslocoScope } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ExerciseDetail } from './exercise-detail';

@Component({
  selector: 'app-host',
  imports: [ExerciseDetail],
  template: `
    <app-exercise-detail [hasDetail]="hasDetail()" (closed)="onClosed()">
      <div list>The list</div>
      <div detail>The detail</div>
    </app-exercise-detail>
  `,
})
class HostComponent {
  readonly hasDetail = signal(false);
  closedCount = 0;

  onClosed(): void {
    this.hasDetail.set(false);
    this.closedCount++;
  }
}

function setUp(handset: boolean, hasDetail: boolean) {
  const state: BreakpointState = { matches: handset, breakpoints: {} };
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('exercise-kit'),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of(state), isMatched: () => handset },
      },
    ],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.hasDetail.set(hasDetail);
  fixture.detectChanges();
  return fixture;
}

describe('ExerciseDetail', () => {
  it('shows the list beside a closed side drawer on desktop with no detail selected', () => {
    const fixture = setUp(false, false);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('The list');
    expect(host.querySelector('mat-drawer')?.classList).not.toContain('mat-drawer-opened');
  });

  it('opens the side drawer on desktop once a detail is selected', () => {
    const fixture = setUp(false, true);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('mat-drawer')?.classList).toContain('mat-drawer-opened');
    expect(host.querySelector('mat-drawer')?.getAttribute('ng-reflect-mode')).not.toBe('over');
  });

  it('shows only the list on a handset with no detail selected', () => {
    const fixture = setUp(true, false);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('The list');
    expect(host.querySelector('mat-drawer')?.classList).not.toContain('mat-drawer-opened');
  });

  it('opens the detail as a full-width overlay on a handset once selected', () => {
    const fixture = setUp(true, true);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('mat-drawer')?.classList).toContain('mat-drawer-opened');
    expect(host.querySelector('.exercise-detail')?.classList).toContain('handset');
  });

  it('emits closed and clears the selection when the close button is clicked', () => {
    const fixture = setUp(true, true);
    const host = fixture.nativeElement as HTMLElement;

    (host.querySelector('.close-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.closedCount).toBe(1);
    expect(host.querySelector('mat-drawer')?.classList).not.toContain('mat-drawer-opened');
  });

  it('emits closed when the drawer reports it closed itself (backdrop tap or Escape)', async () => {
    const fixture = setUp(true, true);
    const drawer = fixture.debugElement.query(By.directive(MatDrawer))
      .componentInstance as MatDrawer;

    await drawer.close();
    fixture.detectChanges();

    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('moves focus into the drawer and back to the trigger on every open/close, not just the first (#174)', () => {
    const fixture = setUp(true, false);
    const host = fixture.nativeElement as HTMLElement;
    // `document.activeElement` only reflects `.focus()` calls on elements attached to the
    // document, and this component (unlike CDK-overlay-based dialogs) renders inline.
    document.body.appendChild(host);

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);

    for (let cycle = 0; cycle < 2; cycle++) {
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      fixture.componentInstance.hasDetail.set(true);
      fixture.detectChanges();

      const closeButton = host.querySelector('.close-button') as HTMLButtonElement;
      expect(document.activeElement).toBe(closeButton);
      expect(host.querySelector('mat-drawer')?.classList).toContain('mat-drawer-opened');

      closeButton.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true,
        }),
      );
      fixture.detectChanges();

      expect(host.querySelector('mat-drawer')?.classList).not.toContain('mat-drawer-opened');

      // `(closed)` only fires once MatDrawer's own opening/closing animation settles, so drive
      // the selection back to `null` directly here rather than depending on that timing, matching
      // what the real `(closed)` handler eventually does.
      fixture.componentInstance.hasDetail.set(false);
      fixture.detectChanges();

      expect(document.activeElement).toBe(trigger);
    }

    trigger.remove();
    host.remove();
  });

  it('does not move focus on desktop, where the drawer is a persistent, non-modal side panel (#174)', () => {
    const fixture = setUp(false, false);
    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    fixture.componentInstance.hasDetail.set(true);
    fixture.detectChanges();

    expect(host.querySelector('mat-drawer')?.classList).toContain('mat-drawer-opened');
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
    host.remove();
  });

  it('captures and restores focus correctly when the handset breakpoint is crossed while open (#174)', () => {
    let matchesHandset = false;
    const state$ = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideTranslocoScope('exercise-kit'),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => state$.asObservable(), isMatched: () => matchesHandset },
        },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    // Opens on desktop: a persistent side panel, so (per the sibling test above) nothing moves
    // focus away from the trigger yet.
    fixture.componentInstance.hasDetail.set(true);
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);

    // The window narrows below the handset breakpoint while the drawer is still open (a resize,
    // fold or rotation) — this is the #174 follow-up regression: a `wasOpen` flag not scoped to
    // handset entry skipped capture here, so `triggerElement` stayed `null` and restore on close
    // silently no-opped.
    matchesHandset = true;
    state$.next({ matches: true, breakpoints: {} });
    fixture.detectChanges();

    const closeButton = host.querySelector('.close-button') as HTMLButtonElement;
    expect(document.activeElement).toBe(closeButton);

    fixture.componentInstance.hasDetail.set(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);

    trigger.remove();
    host.remove();
  });
});
