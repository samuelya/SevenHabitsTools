import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileDownloader } from '../../browser/file-download';
import { DEVICE_ID_SOURCE } from '../../device/device-id-source';
import { DocumentBootstrapStatus } from '../document-bootstrap-status';
import { DocumentStore } from '../document.store';
import { STORAGE_ADAPTER } from '../storage-adapter';
import { DataErrorPage } from './data-error-page';

function text(fixture: ComponentFixture<DataErrorPage>, selector: string): string {
  return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim() ?? '';
}

describe('DataErrorPage', () => {
  const adapter = {
    kind: 'noop',
    load: vi.fn(),
    save: vi.fn(),
    clear: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STORAGE_ADAPTER, useValue: adapter },
        { provide: DEVICE_ID_SOURCE, useValue: { id: () => 'device-1' } },
      ],
    });
    adapter.clear.mockClear();
  });

  it('shows the schema-too-new message and no export button when there is no raw data', () => {
    TestBed.inject(DocumentBootstrapStatus).reportCorrupt(null, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();

    expect(text(fixture, 'p')).toBe(
      'The saved file is damaged or in a format this app cannot read.',
    );
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(1);
  });

  it('shows the export button when raw data is available, and downloads it on click', () => {
    const download = vi.fn();
    TestBed.overrideProvider(FileDownloader, { useValue: { download } });
    const status = TestBed.inject(DocumentBootstrapStatus);
    status.reportCorrupt({ schemaVersion: 99 }, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();

    const buttons = [...fixture.nativeElement.querySelectorAll('button')];
    expect(buttons.length).toBe(2);
    (buttons[0] as HTMLButtonElement).click();

    expect(download).toHaveBeenCalledWith(
      'seven-habits-tools-backup.json',
      JSON.stringify({ schemaVersion: 99 }, null, 2),
    );
  });

  it('reset() clears storage, replaces the document and reports ready', async () => {
    const status = TestBed.inject(DocumentBootstrapStatus);
    status.reportCorrupt({ schemaVersion: 99 }, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();
    const store = TestBed.inject(DocumentStore);

    const resetButton = [...fixture.nativeElement.querySelectorAll('button')].at(
      -1,
    ) as HTMLButtonElement;
    resetButton.click();
    await fixture.whenStable();

    expect(adapter.clear).toHaveBeenCalledTimes(1);
    expect(store.document().meta.deviceId).toBe('device-1');
    expect(status.state()).toBe('ready');
  });
});
