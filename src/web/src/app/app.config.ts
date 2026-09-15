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
import { DocumentPersistence } from './core/data/document-persistence';
import { NoopAdapter } from './core/data/noop-storage-adapter';
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
    // Stand-in until the IndexedDB adapter (#35) lands; swap this line, nothing else changes.
    { provide: STORAGE_ADAPTER, useClass: NoopAdapter },
    provideAppInitializer(() => {
      const iconRegistry = inject(MatIconRegistry);
      iconRegistry.setDefaultFontSetClass('material-symbols-outlined');
      registerGithubIcon(iconRegistry, inject(DomSanitizer));
    }),
    provideAppInitializer(() => {
      const persistence = inject(DocumentPersistence);
      const status = inject(DocumentBootstrapStatus);
      // Never start autosave over a document that failed to load; DataErrorPage starts it once
      // the user resolves the corrupt state (export/reset) and status returns to `ready`.
      return bootstrapDocument().then(() => {
        if (status.state() === 'ready') {
          persistence.start();
        }
      });
    }),
  ],
};
