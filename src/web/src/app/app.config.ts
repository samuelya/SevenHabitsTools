import {
  ApplicationConfig,
  EnvironmentInjector,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  runInInjectionContext,
  isDevMode,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { routes } from './app.routes';
import { bootstrapDocument } from './core/data/document-bootstrap';
import { DocumentBootstrapStatus } from './core/data/document-bootstrap-status';
import { DocumentSync } from './core/data/document-sync';
import { IndexedDbAdapter } from './core/data/indexeddb/indexeddb-adapter';
import { WriterLockService } from './core/data/multi-tab/writer-lock.service';
import { WRITER_LOCK } from './core/data/multi-tab/writer-lock';
import { StoragePersistenceService } from './core/data/storage-persistence.service';
import { STORAGE_ADAPTER } from './core/data/storage-adapter';
import { AppTitleStrategy } from './core/layout/app-title-strategy';
// Registers the `settings.pwa` model (`registerModel()`'s side effect) before `bootstrapDocument()`
// below can build or validate a document. Not lazy-loaded like a feature route, so an explicit
// import here — the same reason `STORAGE_ADAPTER` and the other core services are wired directly
// in this file instead of a route — is what guarantees it has run in time. Cheap (types and a
// `registerModel()` call), unlike `./core/pwa/pwa-runtime` below, so it stays a static import.
import './core/pwa/pwa.model';
import { FEATURE_ROUTES } from './core/routing/feature-route';
import { ROUTE_REGISTRY } from './route-registry';
import { registerGithubIcon } from './shared/ui/github-link/github-icon';
import { provideServiceWorker } from '@angular/service-worker';

const loadPwaRuntime = () => import('./core/pwa/pwa-runtime');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    { provide: FEATURE_ROUTES, useValue: ROUTE_REGISTRY },
    { provide: STORAGE_ADAPTER, useClass: IndexedDbAdapter },
    { provide: WRITER_LOCK, useExisting: WriterLockService },
    provideAppInitializer(() => {
      const iconRegistry = inject(MatIconRegistry);
      iconRegistry.setDefaultFontSetClass('material-symbols-outlined');
      registerGithubIcon(iconRegistry, inject(DomSanitizer));
    }),
    provideAppInitializer(() => {
      const status = inject(DocumentBootstrapStatus);
      const documentSync = inject(DocumentSync);
      // Requesting persistent storage doesn't depend on the document being valid, so it doesn't
      // wait on bootstrap below.
      void inject(StoragePersistenceService).requestPersistence();
      // Never start DocumentSync (autosave, the writer lock, ...) over a document that failed to
      // load; DataErrorPage starts it once the user resolves the corrupt state (export/reset) and
      // status returns to `ready`.
      return bootstrapDocument().then(() => {
        if (status.state() === 'ready') {
          documentSync.start();
        }
      });
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => {
      // Independent of document bootstrap above: capturing an install prompt and watching for app
      // updates matter even if the document itself failed to load. Loaded lazily (like
      // `AppSnackbar`'s snack-bar module) to keep this out of the initial bundle; the injection
      // context has to be captured synchronously here and replayed after the dynamic import
      // resolves, since `inject()` only works while one is active.
      const injector = inject(EnvironmentInjector);
      void loadPwaRuntime().then(({ startPwaRuntime }) => {
        try {
          runInInjectionContext(injector, startPwaRuntime);
        } catch {
          // The app (or, in a test, TestBed's environment) was already torn down by the time this
          // resolved — nothing left to start.
        }
      });
    }),
  ],
};
