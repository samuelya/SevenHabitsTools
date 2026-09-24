import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ContinueCard } from './continue-card';

@Component({
  imports: [ContinueCard],
  template: `
    <app-continue-card
      link="/habits/paradigms/perception"
      label="Continue: Your paradigm"
      habitTitle="Paradigms"
      [detail]="detail()"
    />
  `,
})
class Host {
  readonly detail = signal<string | null>(null);
}

function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture;
}

describe('ContinueCard (#220)', () => {
  it('is one link to the exercise, named by its whole text with the exercise title first', () => {
    const fixture = render();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('a');

    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/habits/paradigms/perception');
    // The accessible name leaves out aria-hidden content and needs real spaces between the parts.
    const named = links[0].cloneNode(true) as HTMLElement;
    named.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());
    expect(named.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Continue: Your paradigm Paradigms',
    );
    expect(links[0].querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the in-progress detail only when given', () => {
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.continue-card__detail')).toBeNull();

    fixture.componentInstance.detail.set('2 of 3 steps');
    fixture.detectChanges();

    expect(host.querySelector('.continue-card__detail')?.textContent?.trim()).toBe('2 of 3 steps');
  });
});
