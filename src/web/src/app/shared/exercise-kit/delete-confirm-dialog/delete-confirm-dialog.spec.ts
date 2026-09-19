import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { DeleteConfirmDialog } from './delete-confirm-dialog';

function setUp(close = vi.fn()) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), { provide: MatDialogRef, useValue: { close } }],
  });
  const fixture = TestBed.createComponent(DeleteConfirmDialog);
  fixture.detectChanges();
  return { fixture, close };
}

function buttons(fixture: { nativeElement: HTMLElement }): HTMLButtonElement[] {
  return [...fixture.nativeElement.querySelectorAll('button')];
}

describe('DeleteConfirmDialog', () => {
  it('shows the generic title and body', () => {
    const { fixture } = setUp();

    expect(fixture.nativeElement.textContent).toContain('Delete this entry?');
  });

  it('closes with true when Delete is clicked', () => {
    const { fixture, close } = setUp();

    buttons(fixture)
      .find((button) => button.textContent?.trim() === 'Delete')
      ?.click();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('never calls close with true from the Cancel button — matDialogClose closes with no value', () => {
    const { fixture, close } = setUp();

    buttons(fixture)
      .find((button) => button.textContent?.trim() === 'Cancel')
      ?.click();

    expect(close).not.toHaveBeenCalledWith(true);
  });
});
