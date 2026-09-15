import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ImportConfirmDialog, ImportConfirmDialogData } from './import-confirm-dialog';

function text(fixture: ComponentFixture<ImportConfirmDialog>, selector: string): string {
  return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim() ?? '';
}

function buttons(fixture: ComponentFixture<ImportConfirmDialog>): HTMLButtonElement[] {
  return [...fixture.nativeElement.querySelectorAll('button')];
}

function setUp(data: ImportConfirmDialogData, close = vi.fn()) {
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(ImportConfirmDialog);
  fixture.detectChanges();
  return { fixture, close };
}

const DATA: ImportConfirmDialogData = {
  preview: { updatedAt: '2026-01-05T00:00:00.000Z', counts: [{ key: 'roles', count: 3 }] },
  currentUpdatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ImportConfirmDialog', () => {
  it('shows the preview counts', () => {
    const { fixture } = setUp(DATA);

    expect(text(fixture, '.import-confirm-dialog__counts')).toContain('roles: 3');
  });

  it('shows a fallback message when the file has no preview counts', () => {
    const { fixture } = setUp({
      ...DATA,
      preview: { updatedAt: DATA.preview.updatedAt, counts: [] },
    });

    expect(text(fixture, '.import-confirm-dialog')).toContain('no feature data to preview yet');
  });

  it('closes with "export-first" when "Export current data first" is clicked', () => {
    const { fixture, close } = setUp(DATA);

    buttons(fixture)
      .find((button) => button.textContent?.includes('Export current data first'))
      ?.click();

    expect(close).toHaveBeenCalledWith('export-first');
  });

  it('Replace… shows a confirmation instead of closing immediately', () => {
    const { fixture, close } = setUp(DATA);

    buttons(fixture)
      .find((button) => button.textContent?.includes('Replace'))
      ?.click();
    fixture.detectChanges();

    expect(close).not.toHaveBeenCalled();
    expect(text(fixture, '.import-confirm-dialog__confirm')).toContain('permanently replace');
    expect(
      buttons(fixture)
        .filter((button) => fixture.nativeElement.contains(button))
        .map((button) => button.textContent?.trim())
        .filter((label) => label === 'Cancel' || label === 'Yes, replace'),
    ).toEqual(['Cancel', 'Yes, replace']);
  });

  it('moves focus to Cancel when the replace confirmation appears', () => {
    const { fixture } = setUp(DATA);

    buttons(fixture)
      .find((button) => button.textContent?.includes('Replace'))
      ?.click();
    fixture.detectChanges();

    expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
  });

  it('Cancel (from the replace confirmation) returns to the main view without closing', () => {
    const { fixture, close } = setUp(DATA);
    buttons(fixture)
      .find((button) => button.textContent?.includes('Replace'))
      ?.click();
    fixture.detectChanges();

    buttons(fixture)
      .find((button) => button.textContent?.trim() === 'Cancel')
      ?.click();
    fixture.detectChanges();

    expect(close).not.toHaveBeenCalled();
    expect(text(fixture, '.import-confirm-dialog')).toContain('Replace…');
  });

  it('"Yes, replace" closes with "replace"', () => {
    const { fixture, close } = setUp(DATA);
    buttons(fixture)
      .find((button) => button.textContent?.includes('Replace'))
      ?.click();
    fixture.detectChanges();

    buttons(fixture)
      .find((button) => button.textContent?.trim() === 'Yes, replace')
      ?.click();

    expect(close).toHaveBeenCalledWith('replace');
  });
});
