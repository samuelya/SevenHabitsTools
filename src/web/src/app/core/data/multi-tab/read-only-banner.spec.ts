import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReadOnlyBanner } from './read-only-banner';
import { WRITER_LOCK } from './writer-lock';

describe('ReadOnlyBanner', () => {
  it('renders nothing while this tab is the writer', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: WRITER_LOCK, useValue: { isWriter: signal(true) } }],
    });
    const fixture = TestBed.createComponent(ReadOnlyBanner);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.read-only-banner')).toBeNull();
  });

  it('shows the read-only message while this tab is not the writer', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: WRITER_LOCK, useValue: { isWriter: signal(false) } }],
    });
    const fixture = TestBed.createComponent(ReadOnlyBanner);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.read-only-banner');
    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.textContent).toContain('Read-only');
  });

  it('hides again once this tab becomes the writer', () => {
    const isWriter = signal(false);
    TestBed.configureTestingModule({
      providers: [{ provide: WRITER_LOCK, useValue: { isWriter } }],
    });
    const fixture = TestBed.createComponent(ReadOnlyBanner);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.read-only-banner')).not.toBeNull();

    isWriter.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.read-only-banner')).toBeNull();
  });
});
