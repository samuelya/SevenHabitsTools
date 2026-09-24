import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { DeleteConfirmDialog, DeleteConfirmDialogData } from './delete-confirm-dialog';

function setUp(close = vi.fn(), data?: DeleteConfirmDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      { provide: MatDialogRef, useValue: { close } },
      ...(data ? [{ provide: MAT_DIALOG_DATA, useValue: data }] : []),
    ],
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

  it("shows a caller's own title, body and confirm label instead (#222 re-review R6)", () => {
    const { fixture } = setUp(vi.fn(), {
      title: 'Remove this area?',
      body: 'Its rating and note will be lost.',
      confirmLabel: 'Remove',
    });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Remove this area?');
    expect(text).toContain('Its rating and note will be lost.');
    expect(text).not.toContain('Delete this entry?');
    expect(buttons(fixture).map((button) => button.textContent?.trim())).toContain('Remove');
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
