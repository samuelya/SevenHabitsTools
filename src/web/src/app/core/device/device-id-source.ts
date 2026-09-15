import { InjectionToken } from '@angular/core';

/** Where a freshly created document's `meta.deviceId` comes from. Set once, at creation, and kept
 * for the document's lifetime; this seam lets tests fix the id instead of asserting against a
 * random UUID. */
export interface DeviceIdSource {
  id(): string;
}

class RandomDeviceIdSource implements DeviceIdSource {
  id(): string {
    return crypto.randomUUID();
  }
}

export const DEVICE_ID_SOURCE = new InjectionToken<DeviceIdSource>('DEVICE_ID_SOURCE', {
  providedIn: 'root',
  factory: () => new RandomDeviceIdSource(),
});
