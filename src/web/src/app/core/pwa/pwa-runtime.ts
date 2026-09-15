import { inject } from '@angular/core';
import { AppUpdateService } from './app-update.service';
import { InstallPromptService } from './install-prompt.service';

/**
 * Starts the two PWA runtime services once this module is loaded: `InstallPromptService`
 * (captures `beforeinstallprompt`) and `AppUpdateService` (watches `SwUpdate`). Split into its own
 * module so `app.config.ts` can `import()` it dynamically instead of statically — neither service
 * is needed for first paint, and this keeps `@angular/service-worker`'s `SwUpdate` and this
 * module's own code out of the initial bundle (#27).
 */
export function startPwaRuntime(): void {
  inject(InstallPromptService).start();
  inject(AppUpdateService).start();
}
