import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDrawer } from '@angular/material/sidenav';
import { provideTranslocoScope } from '@jsverse/transloco';
import { of } from 'rxjs';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ExerciseDetail } from './exercise-detail';

@Component({
  selector: 'app-host',
  imports: [ExerciseDetail],
  template: `
    <app-exercise-detail [hasDetail]="hasDetail" (closed)="onClosed()">
      <div list>The list</div>
      <div detail>The detail</div>
    </app-exercise-detail>
  `,
})
class HostComponent {
  hasDetail = false;
  closedCount = 0;

  onClosed(): void {
    this.hasDetail = false;
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
  fixture.componentInstance.hasDetail = hasDetail;
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
});
