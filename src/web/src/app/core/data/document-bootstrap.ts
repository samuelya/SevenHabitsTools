import { inject } from '@angular/core';
import { DeviceIdSource, DEVICE_ID_SOURCE } from '../device/device-id-source';
import { DocumentBootstrapStatus } from './document-bootstrap-status';
import { resolveDocument } from './document-validation';
import { RootDocument } from './document.model';
import { DocumentStore } from './document.store';
import { createEmptyDocument } from './registry';
import { StorageAdapter, StorageBlockedError, STORAGE_ADAPTER } from './storage-adapter';

interface BootstrapDeps {
  readonly adapter: StorageAdapter;
  readonly deviceIdSource: DeviceIdSource;
  readonly store: DocumentStore;
  readonly status: DocumentBootstrapStatus;
}

/**
 * Loads the stored document (or creates an empty one on first run) into `store`, or records on
 * `status` why it could not — `blocked` when storage is merely held by something else and will
 * load once it is free, `corrupt` when the data itself is unreadable, which is what decides
 * whether the error page may offer destructive recovery. Takes its collaborators as plain parameters
 * — rather than calling `inject()` itself — so it is unit-testable with fakes and has no
 * dependency on Angular's DI beyond the types it reads. `bootstrapDocument()` below wires it to
 * the real services and is registered as an app initializer in `app.config.ts`; Angular waits for
 * it before rendering, so there is no separate "loading" state to show.
 */
export async function runDocumentBootstrap(deps: BootstrapDeps): Promise<void> {
  const { adapter, deviceIdSource, store, status } = deps;

  let loaded: RootDocument | null;
  try {
    loaded = await adapter.load();
  } catch (error) {
    if (error instanceof StorageBlockedError) {
      status.reportBlocked(error);
    } else {
      status.reportCorrupt(null, error);
    }
    return;
  }

  if (loaded === null) {
    store.replaceDocument(createEmptyDocument(deviceIdSource.id()));
    status.reportReady();
    return;
  }

  const result = resolveDocument(loaded);
  if (!result.ok) {
    status.reportCorrupt(loaded, result.error);
    return;
  }
  store.replaceDocument(result.document);
  status.reportReady();
}

/** DI-wired entry point for the app initializer; see `runDocumentBootstrap()` for the logic. */
export function bootstrapDocument(): Promise<void> {
  return runDocumentBootstrap({
    adapter: inject(STORAGE_ADAPTER),
    deviceIdSource: inject(DEVICE_ID_SOURCE),
    store: inject(DocumentStore),
    status: inject(DocumentBootstrapStatus),
  });
}
