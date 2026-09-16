import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ExerciseDetail } from './exercise-detail';

@Component({
  selector: 'app-host',
  imports: [ExerciseDetail],
  template: `
    <app-exercise-detail [hasDetail]="hasDetail">
      <div list>The list</div>
      <div detail>The detail</div>
    </app-exercise-detail>
  `,
})
class HostComponent {
  hasDetail = false;
}

function setUp(handset: boolean, hasDetail: boolean) {
  const state: BreakpointState = { matches: handset, breakpoints: {} };
  TestBed.configureTestingModule({
    providers: [
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
});
