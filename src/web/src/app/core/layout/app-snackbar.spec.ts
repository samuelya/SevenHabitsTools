import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { APP_SNACKBAR_CLASS, AppSnackbar } from './app-snackbar';

@Component({ template: 'custom' })
class CustomSnackbar {}

describe('AppSnackbar', () => {
  afterEach(() => TestBed.inject(MatSnackBar).dismiss());

  it('opens a text snackbar through MatSnackBar with the app panel class', async () => {
    const openSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    await TestBed.inject(AppSnackbar).open('Hello', 'Dismiss', { duration: 1000 });

    expect(openSpy).toHaveBeenCalledWith('Hello', 'Dismiss', {
      duration: 1000,
      panelClass: APP_SNACKBAR_CLASS,
    });
  });

  it('opens a component snackbar with the app panel class and its data', async () => {
    const openSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'openFromComponent');

    const ref = await TestBed.inject(AppSnackbar).openFromComponent(CustomSnackbar, {
      data: { a: 1 },
    });

    expect(openSpy).toHaveBeenCalledWith(CustomSnackbar, {
      data: { a: 1 },
      panelClass: APP_SNACKBAR_CLASS,
    });
    expect(ref.instance).toBeInstanceOf(CustomSnackbar);
  });
});
