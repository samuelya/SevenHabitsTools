import { TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { SaveErrorSnackbar, SaveErrorSnackbarData } from './save-error-snackbar';

function render(): {
  ref: { dismiss: ReturnType<typeof vi.fn>; dismissWithAction: ReturnType<typeof vi.fn> };
  buttons: HTMLButtonElement[];
  root: HTMLElement;
} {
  const ref = { dismiss: vi.fn(), dismissWithAction: vi.fn() };
  const data: SaveErrorSnackbarData = {
    message: "We couldn't save your latest changes.",
    exportLabel: 'Export now',
    dismissLabel: 'Dismiss',
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_SNACK_BAR_DATA, useValue: data },
      { provide: MatSnackBarRef, useValue: ref },
    ],
  });
  const fixture = TestBed.createComponent(SaveErrorSnackbar);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { ref, buttons: Array.from(root.querySelectorAll('button')), root };
}

describe('SaveErrorSnackbar', () => {
  it('shows the message with "Export now" and "Dismiss" buttons', () => {
    const { buttons, root } = render();

    expect(root.textContent).toContain("couldn't save");
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Export now', 'Dismiss']);
  });

  it('#128: "Dismiss" closes the snackbar without reporting the export action', () => {
    const { ref, buttons } = render();

    buttons[1]!.click();

    expect(ref.dismiss).toHaveBeenCalledTimes(1);
    expect(ref.dismissWithAction).not.toHaveBeenCalled();
  });

  it('"Export now" closes the snackbar as its action', () => {
    const { ref, buttons } = render();

    buttons[0]!.click();

    expect(ref.dismissWithAction).toHaveBeenCalledTimes(1);
  });
});
