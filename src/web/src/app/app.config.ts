import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { MatIconRegistry } from '@angular/material/icon';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { routes } from './app.routes';
import { bootstrapDocument } from './core/data/document-bootstrap';
import { DocumentPersistence } from './core/data/document-persistence';
import { NoopAdapter } from './core/data/noop-storage-adapter';
import { STORAGE_ADAPTER } from './core/data/storage-adapter';
import { AppTitleStrategy } from './core/layout/app-title-strategy';
import { FEATURE_ROUTES } from './core/routing/feature-route';
import { ROUTE_REGISTRY } from './route-registry';

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
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    }),
    provideAppInitializer(() => {
      const persistence = inject(DocumentPersistence);
      return bootstrapDocument().then(() => persistence.start());
    }),
  ],
};
