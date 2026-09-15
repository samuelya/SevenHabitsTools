import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
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
import { FEATURE_ROUTES } from './core/routing/feature-route';
import { ROUTE_REGISTRY } from './route-registry';
import { registerGithubIcon } from './shared/ui/github-link/github-icon';

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
  ],
};
