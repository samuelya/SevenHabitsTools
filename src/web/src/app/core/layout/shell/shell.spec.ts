import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { configureApp, renderShellAt } from '../../../testing/app-test-setup';

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('Shell', () => {
  describe('on a handset (below 600 px)', () => {
    beforeEach(() => configureApp({ handset: true }));

    it('shows bottom navigation with the five destinations', async () => {
      const fixture = await renderShellAt('/');
      const host = fixture.nativeElement as HTMLElement;

      const links = [...host.querySelectorAll('.bottom-nav a')].map((link) =>
        text(link.querySelector('.bottom-nav__label')),
      );
      expect(links).toEqual(['Home', 'Habits', 'Plan', 'Journal', 'Settings']);
      expect(host.querySelector('mat-sidenav')?.classList).not.toContain('mat-drawer-opened');
    });

    it('marks the active destination with aria-current', async () => {
      const fixture = await renderShellAt('/plan');
      const host = fixture.nativeElement as HTMLElement;

      const current = host.querySelectorAll('.bottom-nav a[aria-current="page"]');
      expect(current.length).toBe(1);
      expect(text(current[0])).toContain('Plan');
    });
  });

  describe('on desktop', () => {
    beforeEach(() => configureApp({ handset: false }));

    it('shows the side navigation and no bottom navigation', async () => {
      const fixture = await renderShellAt('/');
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelector('.bottom-nav')).toBeNull();
      expect(host.querySelector('mat-sidenav')?.classList).toContain('mat-drawer-opened');
      expect(host.querySelectorAll('mat-sidenav .side-nav__main a').length).toBe(5);
    });

    it('links to the About page from the side navigation footer', async () => {
      const fixture = await renderShellAt('/');
      const host = fixture.nativeElement as HTMLElement;

      const about = host.querySelector<HTMLAnchorElement>('.side-nav__footer a');
      expect(about?.getAttribute('href')).toBe('/about');
      expect(text(about?.querySelector('[matListItemTitle]'))).toBe('About');
    });

    it('links to the GitHub repository from the side navigation footer, after About', async () => {
      const fixture = await renderShellAt('/');
      const host = fixture.nativeElement as HTMLElement;

      const footerLinks = [...host.querySelectorAll<HTMLAnchorElement>('.side-nav__footer a')];
      expect(footerLinks[0]?.getAttribute('href')).toBe('/about');

      const github = footerLinks[1];
      expect(github?.getAttribute('href')).toBe('https://github.com/samuelya/SevenHabitsTools');
      expect(github?.getAttribute('target')).toBe('_blank');
      expect(github?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(github?.getAttribute('aria-label')).toBe('Source code on GitHub');
      expect(github?.querySelector('mat-icon svg')).toBeTruthy();
      expect(github?.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('shows the page title and hides the back button on top-level pages', async () => {
      const fixture = await renderShellAt('/journal');
      const host = fixture.nativeElement as HTMLElement;

      expect(text(host.querySelector('[data-testid="page-title"]'))).toBe('Journal');
      expect(host.querySelector('.top-bar__back')).toBeNull();
      expect(TestBed.inject(Title).getTitle()).toBe('Journal | Seven Habits Tools');
    });

    it('shows a back button to the parent page on nested pages', async () => {
      const fixture = await renderShellAt('/habits/h4');
      const host = fixture.nativeElement as HTMLElement;

      expect(text(host.querySelector('[data-testid="page-title"]'))).toBe('Habit 4: Think win-win');
      const back = host.querySelector<HTMLAnchorElement>('.top-bar__back');
      expect(back?.getAttribute('href')).toBe('/habits');
      expect(back?.getAttribute('aria-label')).toBe('Back');
    });

    it('redirects unknown URLs to home', async () => {
      await renderShellAt('/nowhere/at/all');
      expect(TestBed.inject(Router).url).toBe('/');
    });
  });
});
