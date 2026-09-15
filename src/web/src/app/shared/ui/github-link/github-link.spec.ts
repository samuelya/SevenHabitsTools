import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
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
    expect(link.getAttribute('aria-label')).toBe('Source code on GitHub');
  });

  it('renders the registered SVG icon, hidden from assistive tech, with no label by default', () => {
    const fixture = TestBed.createComponent(GithubLink);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const icon = host.querySelector('mat-icon.github-link__icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.querySelector('svg')).toBeTruthy();
    expect(host.querySelector('.github-link__label')).toBeNull();
  });

  it('shows the visible "GitHub" label when showLabel is set', () => {
    const fixture = TestBed.createComponent(GithubLink);
    fixture.componentRef.setInput('showLabel', true);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('.github-link__label');
    expect(label?.textContent?.trim()).toBe('GitHub');
  });
});
