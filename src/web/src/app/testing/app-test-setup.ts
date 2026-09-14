import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { appConfig } from '../app.config';
import { Shell } from '../core/layout/shell/shell';

/** Configures the real app providers with a fixed viewport class. */
export function configureApp(options: { handset: boolean }): void {
  const state: BreakpointState = { matches: options.handset, breakpoints: {} };
  TestBed.configureTestingModule({
    providers: [
      ...appConfig.providers,
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of(state), isMatched: () => options.handset },
      },
    ],
  });
}

/** Renders the shell and navigates to `url`. */
export async function renderShellAt(url: string): Promise<ComponentFixture<Shell>> {
  const fixture = TestBed.createComponent(Shell);
  await TestBed.inject(Router).navigateByUrl(url);
  await fixture.whenStable();
  return fixture;
}
