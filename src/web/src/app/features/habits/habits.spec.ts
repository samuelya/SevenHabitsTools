import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { HABITS } from '../../core/habits/habits';
import { FEATURE_ROUTES, FeatureRoute } from '../../core/routing/feature-route';
import { configureApp, renderShellAt } from '../../testing/app-test-setup';

describe('Habits feature', () => {
  it('lists every habit hub', async () => {
    configureApp({ handset: false });
    const fixture = await renderShellAt('/habits');
    const host = fixture.nativeElement as HTMLElement;

    const items = [...host.querySelectorAll('app-habits-page a')];
    expect(items.length).toBe(HABITS.length);
    expect(items[1].getAttribute('href')).toBe('/habits/h1');
  });

  it.each(HABITS.map((habit) => [habit.id, habit.titleKey] as const))(
    'renders the %s hub with its title',
    async (id, titleKey) => {
      configureApp({ handset: true });
      const fixture = await renderShellAt(`/habits/${id}`);
      const host = fixture.nativeElement as HTMLElement;

      const expected = TestBed.inject(TranslocoService).translate(titleKey);
      expect(host.querySelector('app-habit-hub-page h1')?.textContent?.trim()).toBe(expected);
      expect(host.querySelector('app-habit-hub-page')?.textContent).toContain('coming soon');
    },
  );

  it('lists exercises registered on the hub', async () => {
    configureApp({ handset: false });
    // A real root-scope key, not a placeholder string: with `ThrowingMissingHandler` wired in for
    // tests (#162), any key that isn't in a loaded scope now fails the run instead of rendering
    // as-is, so the fixture can no longer use an arbitrary literal as a "translation".
    const extra: FeatureRoute = {
      path: 'habits/h2/mission',
      loadChildren: () => Promise.resolve([]),
      hub: { habit: 'h2', titleKey: 'titles.paradigms', icon: 'flag' },
    };
    TestBed.overrideProvider(FEATURE_ROUTES, { useValue: [extra] });

    const fixture = await renderShellAt('/habits/h2');
    const link = (fixture.nativeElement as HTMLElement).querySelector('app-habit-hub-page a');
    const expected = TestBed.inject(TranslocoService).translate('titles.paradigms');

    expect(link?.getAttribute('href')).toBe('/habits/h2/mission');
    expect(link?.textContent).toContain(expected);
  });

  it('does not match unknown habit ids', async () => {
    configureApp({ handset: false });
    await renderShellAt('/habits/h9');
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
