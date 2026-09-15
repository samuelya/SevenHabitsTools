import { TestBed } from '@angular/core/testing';
import { WINDOW } from './window';
import { WEB_SHARE } from './web-share';

function configureWindow(navigatorOverrides: Partial<Navigator>): void {
  TestBed.configureTestingModule({
    providers: [{ provide: WINDOW, useValue: { navigator: navigatorOverrides } }],
  });
}

describe('WEB_SHARE', () => {
  it('is null in a browser without navigator.share', () => {
    configureWindow({});

    expect(TestBed.inject(WEB_SHARE)).toBeNull();
  });

  it('canShareFiles() is false without navigator.canShare, even with navigator.share', () => {
    configureWindow({ share: vi.fn() });

    expect(TestBed.inject(WEB_SHARE)?.canShareFiles([])).toBe(false);
  });

  it('canShareFiles() reflects navigator.canShare()', () => {
    const canShare = vi.fn().mockReturnValue(true);
    configureWindow({ share: vi.fn(), canShare });
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });

    const result = TestBed.inject(WEB_SHARE)?.canShareFiles([file]);

    expect(result).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ files: [file] });
  });

  it('share() delegates to navigator.share() with the files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    configureWindow({ share, canShare: () => true });
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });

    await TestBed.inject(WEB_SHARE)?.share([file]);

    expect(share).toHaveBeenCalledWith({ files: [file] });
  });
});
