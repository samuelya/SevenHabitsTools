import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReadOnlyBanner } from './read-only-banner';
import { WRITER_LOCK } from './writer-lock';
import { WriterRole } from './writer-role-state';

function render(role: ReturnType<typeof signal<WriterRole>>): {
  banner: () => HTMLElement | null;
  detectChanges: () => void;
} {
  TestBed.configureTestingModule({
    providers: [{ provide: WRITER_LOCK, useValue: { role, isWriter: signal(false) } }],
  });
  const fixture = TestBed.createComponent(ReadOnlyBanner);
  fixture.detectChanges();
  return {
    banner: () => fixture.nativeElement.querySelector('.read-only-banner'),
    detectChanges: () => fixture.detectChanges(),
  };
}

describe('ReadOnlyBanner', () => {
  it('renders nothing while this tab is the writer', () => {
    expect(render(signal<WriterRole>('writer')).banner()).toBeNull();
  });

  it('renders nothing while the lock request is still pending', () => {
    expect(render(signal<WriterRole>('pending')).banner()).toBeNull();
  });

  it('shows the read-only message while another tab holds the lock', () => {
    const banner = render(signal<WriterRole>('reader')).banner();

    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.textContent).toContain('Read-only');
  });

  it('hides again once this tab becomes the writer', () => {
    const role = signal<WriterRole>('reader');
    const view = render(role);
    expect(view.banner()).not.toBeNull();

    role.set('writer');
    view.detectChanges();

    expect(view.banner()).toBeNull();
  });
});
