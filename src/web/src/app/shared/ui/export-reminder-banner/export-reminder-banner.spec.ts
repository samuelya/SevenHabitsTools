import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExportReminderBanner } from './export-reminder-banner';

function setUp(): ComponentFixture<ExportReminderBanner> {
  const fixture = TestBed.createComponent(ExportReminderBanner);
  fixture.componentRef.setInput('message', 'Back up your data.');
  fixture.componentRef.setInput('exportLabel', 'Export now');
  fixture.componentRef.setInput('dismissLabel', 'Dismiss');
  fixture.detectChanges();
  return fixture;
}

describe('ExportReminderBanner', () => {
  it('renders the message', () => {
    const fixture = setUp();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Back up your data.');
  });

  it('emits exportNow when the export button is clicked', () => {
    const fixture = setUp();
    const emitted = vi.fn();
    fixture.componentInstance.exportNow.subscribe(emitted);

    (fixture.nativeElement as HTMLElement)
      .querySelector('button')
      ?.dispatchEvent(new Event('click', { bubbles: true }));

    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('emits dismiss when the dismiss button is clicked', () => {
    const fixture = setUp();
    const emitted = vi.fn();
    fixture.componentInstance.dismiss.subscribe(emitted);

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    buttons[buttons.length - 1].dispatchEvent(new Event('click', { bubbles: true }));

    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('is a live region announced to assistive tech', () => {
    const fixture = setUp();

    const region = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });
});
