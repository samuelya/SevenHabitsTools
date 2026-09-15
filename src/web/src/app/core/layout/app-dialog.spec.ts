import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { AppDialog } from './app-dialog';

@Component({ template: 'custom dialog' })
class CustomDialog {}

describe('AppDialog', () => {
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('opens a component dialog through MatDialog with the given config', async () => {
    const openSpy = vi.spyOn(TestBed.inject(MatDialog), 'open');

    const ref = await TestBed.inject(AppDialog).open(CustomDialog, { data: { a: 1 } });

    expect(openSpy).toHaveBeenCalledWith(CustomDialog, { data: { a: 1 } });
    expect(ref.componentInstance).toBeInstanceOf(CustomDialog);
  });
});
