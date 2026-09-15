import { expect, test } from './fixtures';

/**
 * PWA-specific checks (#27): the manifest is served, linked and valid, and the service worker
 * registers. Offline navigation itself is covered by smoke.spec.ts's "works offline after the
 * first load" — that's part of the app shell's own definition of done (architecture issue #1 §9),
 * not this feature's own happy path.
 */

interface WebAppManifestIcon {
  readonly sizes: string;
  readonly purpose?: string;
}

interface WebAppManifest {
  readonly name: string;
  readonly description: string;
  readonly display: string;
  readonly start_url: string;
  readonly icons: readonly WebAppManifestIcon[];
}

test.describe('PWA', () => {
  test('links a valid manifest matching the About/README wording', async ({ page, request }) => {
    const response = await page.goto('/');
    const html = (await response?.text()) ?? '';
    expect(html).toContain('rel="manifest" href="manifest.webmanifest"');

    const manifestResponse = await request.get('/manifest.webmanifest');
    expect(manifestResponse.ok()).toBe(true);
    expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');

    const manifest = (await manifestResponse.json()) as WebAppManifest;
    expect(manifest.name).toBe('Seven Habits Tools');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.description).toContain(
      'not affiliated with, endorsed by or licensed by FranklinCovey',
    );

    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    const maskableSizes = manifest.icons
      .filter((icon) => icon.purpose === 'maskable')
      .map((icon) => icon.sizes);
    expect(maskableSizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });

  test('registers the service worker', async ({ page }) => {
    await page.goto('/');

    // `ready` resolves once a worker reaches the registration's `active` slot, which happens as
    // soon as activation *starts* — not necessarily the `activated` event, so this checks
    // registration happened at all rather than racing the exact lifecycle state.
    const scriptURL = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.scriptURL ?? null;
    });

    expect(scriptURL).toContain('ngsw-worker.js');
  });
});
