import { TestBed } from '@angular/core/testing';
import { FileDownloader } from './file-download';

describe('FileDownloader', () => {
  it('creates and clicks a download link, then revokes the object URL', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockReturnValue(undefined);
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    TestBed.inject(FileDownloader).download('backup.json', '{"a":1}');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchor.href).toBe('blob:fake-url');
    expect(anchor.download).toBe('backup.json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });
});
