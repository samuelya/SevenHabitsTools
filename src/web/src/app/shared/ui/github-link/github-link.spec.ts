import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import { GithubLink, REPO_URL } from './github-link';
import { registerGithubIcon } from './github-icon';

describe('GithubLink', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    registerGithubIcon(TestBed.inject(MatIconRegistry), TestBed.inject(DomSanitizer));
  });

  it('links to the repository with the right target, rel and accessible name', () => {
    const fixture = TestBed.createComponent(GithubLink);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('href')).toBe(REPO_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('aria-label')).toBe('GitHub, opens in a new tab');
  });

  it('renders as a mat-list-item row so it matches the other nav rows', () => {
    const fixture = TestBed.createComponent(GithubLink);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('mat-list-item')).not.toBeNull();
  });

  it('renders the registered SVG icon, hidden from assistive tech, with no label by default', () => {
    const fixture = TestBed.createComponent(GithubLink);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const icon = host.querySelector('mat-icon[matListItemIcon]');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.querySelector('svg')).toBeTruthy();
    expect(host.querySelector('[matListItemTitle]')).toBeNull();
  });

  it('shows the visible "GitHub" label when showLabel is set', () => {
    const fixture = TestBed.createComponent(GithubLink);
    fixture.componentRef.setInput('showLabel', true);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('[matListItemTitle]');
    expect(label?.textContent?.trim()).toBe('GitHub');
  });

  it('has no trailing icon by default, and shows an aria-hidden one when showExternalIcon is set', () => {
    const fixture = TestBed.createComponent(GithubLink);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[matListItemMeta]')).toBeNull();

    fixture.componentRef.setInput('showExternalIcon', true);
    fixture.detectChanges();
    const external = fixture.nativeElement.querySelector('[matListItemMeta]');
    expect(external?.textContent?.trim()).toBe('open_in_new');
    expect(external?.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not apply MatTooltip (the row has a visible/accessible label instead)', () => {
    const fixture = TestBed.createComponent(GithubLink);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(MatTooltip))).toBeNull();
  });
});
