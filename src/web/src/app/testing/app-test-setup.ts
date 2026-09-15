import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { EnvironmentProviders, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { appConfig } from '../app.config';
import { registerBackupModel } from '../core/data/backup/backup.model';
import { NoopAdapter } from '../core/data/noop-storage-adapter';
import { STORAGE_ADAPTER } from '../core/data/storage-adapter';
import { Shell } from '../core/layout/shell/shell';
import { registerGithubIcon } from '../shared/ui/github-link/github-icon';
import { provideTranslocoTesting } from './transloco-testing';

/**
 * Configures the real app providers with a fixed viewport class. `STORAGE_ADAPTER` is swapped back
 * to `NoopAdapter`: these tests exercise routing and layout, not real IndexedDB, which the
 * unit-test environment doesn't implement anyway (`app.config.spec.ts` covers the real adapter).
 * Does not touch `TestBed.inject` itself — some specs call `TestBed.overrideProvider` between this
 * and `renderShellAt`, which TestBed only allows before the testing module has been instantiated.
 *
 * Also re-asserts the `backup` model registration (`registerBackupModel()`): navigating to Home or
 * Settings under `renderShellAt` constructs the real `HomePage`/`BackupSection`, which need it, and
 * this project's unit tests run with Vitest `isolate: false` (shared module state across spec
 * files) — an unrelated spec's own `resetRegistryForTesting()` can otherwise leave the registry
 * empty by the time this one runs.
 */
export function configureApp(options: {
  handset: boolean;
  providers?: (Provider | EnvironmentProviders)[];
}): void {
  registerBackupModel();
  const state: BreakpointState = { matches: options.handset, breakpoints: {} };
  TestBed.configureTestingModule({
    providers: [
      ...appConfig.providers,
      { provide: STORAGE_ADAPTER, useClass: NoopAdapter },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of(state), isMatched: () => options.handset },
      },
      // Real translations without HTTP (`TranslocoTestingModule`), overriding the HTTP loader
      // `appConfig.providers` set up above — see `transloco-testing.ts`.
      provideTranslocoTesting(),
      ...(options.providers ?? []),
    ],
  });
}

/**
 * Renders the shell and navigates to `url`. Also registers the `github` icon literal here (rather
 * than in `configureApp`): `provideAppInitializer`s don't run under `TestBed.createComponent` the
 * way they do under `bootstrapApplication`, and this is the first point every spec using this
 * helper is guaranteed to have finished any `TestBed.overrideProvider` calls.
 */
export async function renderShellAt(url: string): Promise<ComponentFixture<Shell>> {
  registerGithubIcon(TestBed.inject(MatIconRegistry), TestBed.inject(DomSanitizer));
  const fixture = TestBed.createComponent(Shell);
  await TestBed.inject(Router).navigateByUrl(url);
  await fixture.whenStable();
  return fixture;
}
