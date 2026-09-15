import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { DocumentBootstrapStatus } from './core/data/document-bootstrap-status';
import { configureApp } from './testing/app-test-setup';

describe('App', () => {
  beforeEach(() => configureApp({ handset: false }));

  it('renders the shell when the document loaded ready', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-shell')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-data-error-page')).toBeNull();
  });

  it('renders the data error page instead of the shell when the document is corrupt', () => {
    TestBed.inject(DocumentBootstrapStatus).reportCorrupt(null, new Error('boom'));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-data-error-page')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-shell')).toBeNull();
  });
});
