import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { registerGithubIcon } from './github-icon';

describe('registerGithubIcon', () => {
  it('registers the "github" SVG icon literal with the icon registry', () => {
    TestBed.configureTestingModule({});
    const registry = TestBed.inject(MatIconRegistry);
    const sanitizer = TestBed.inject(DomSanitizer);
    const addSvgIconLiteral = vi.spyOn(registry, 'addSvgIconLiteral');

    registerGithubIcon(registry, sanitizer);

    expect(addSvgIconLiteral).toHaveBeenCalledWith('github', expect.anything());
  });
});
