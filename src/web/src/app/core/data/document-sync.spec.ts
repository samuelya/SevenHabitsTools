import { TestBed } from '@angular/core/testing';
import { CrossTabSync } from './multi-tab/cross-tab-sync';
import { WriterLockService } from './multi-tab/writer-lock.service';
import { WriterPromotionReload } from './multi-tab/writer-promotion-reload';
import { DocumentPersistence } from './document-persistence';
import { DocumentSync } from './document-sync';
import { SaveErrorNotifier } from './save-error-notifier';

describe('DocumentSync', () => {
  it('starts every document-dependent service', () => {
    const writerLock = { start: vi.fn() };
    const persistence = { start: vi.fn() };
    const crossTabSync = { start: vi.fn() };
    const writerPromotionReload = { start: vi.fn() };
    const saveErrorNotifier = { start: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: WriterLockService, useValue: writerLock },
        { provide: DocumentPersistence, useValue: persistence },
        { provide: CrossTabSync, useValue: crossTabSync },
        { provide: WriterPromotionReload, useValue: writerPromotionReload },
        { provide: SaveErrorNotifier, useValue: saveErrorNotifier },
      ],
    });

    TestBed.inject(DocumentSync).start();

    expect(writerLock.start).toHaveBeenCalledTimes(1);
    expect(persistence.start).toHaveBeenCalledTimes(1);
    expect(crossTabSync.start).toHaveBeenCalledTimes(1);
    expect(writerPromotionReload.start).toHaveBeenCalledTimes(1);
    expect(saveErrorNotifier.start).toHaveBeenCalledTimes(1);
  });
});
