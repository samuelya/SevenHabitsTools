import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Labels } from '../../core/i18n/labels';
import { configureApp, renderShellAt } from '../../testing/app-test-setup';

describe('About feature', () => {
  function configure(): void {
    configureApp({
      handset: false,
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  }

  it('shows the not-affiliated note, the version and the links', async () => {
    configure();
    const fixture = await renderShellAt('/about');
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('/api/version').flush({ version: '1.2.3' });
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const labels = TestBed.inject(Labels);

    expect(host.querySelector('app-about-page')?.textContent).toContain(
      labels.text('about.notAffiliated'),
    );
    expect(host.querySelector('app-about-page')?.textContent).toContain('1.2.3');

    const repoLink = host.querySelector<HTMLAnchorElement>('app-about-page a[target="_blank"]');
    expect(repoLink?.getAttribute('href')).toBe('https://github.com/samuelya/SevenHabitsTools');
    expect(repoLink?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(repoLink?.getAttribute('aria-label')).toBe('GitHub, opens in a new tab');
    expect(repoLink?.querySelector('[matListItemTitle]')?.textContent?.trim()).toBe('GitHub');
    expect(host.textContent).not.toContain('View the source on GitHub');

    const privacyLink = host.querySelector<HTMLAnchorElement>(
      'app-about-page a[href^="/settings"]',
    );
    expect(privacyLink?.getAttribute('href')).toBe('/settings#privacy');
  });

  it('falls back to the unknown label when the version request fails', async () => {
    configure();
    const fixture = await renderShellAt('/about');
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('/api/version').error(new ProgressEvent('error'));
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const labels = TestBed.inject(Labels);

    expect(host.querySelector('app-about-page')?.textContent).toContain(
      labels.text('about.versionUnknown'),
    );
  });

  it('is reachable from the settings page and the side navigation', async () => {
    configure();
    const fixture = await renderShellAt('/settings');
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.match(() => true).forEach((request) => request.flush({ version: 'dev' }));
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#privacy')).toBeTruthy();
    expect(host.querySelector<HTMLAnchorElement>('app-settings-page a')?.getAttribute('href')).toBe(
      '/about',
    );
    expect(host.querySelector<HTMLAnchorElement>('.side-nav__footer a')?.getAttribute('href')).toBe(
      '/about',
    );
  });
});
