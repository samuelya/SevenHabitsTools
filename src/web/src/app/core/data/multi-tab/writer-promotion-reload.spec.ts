import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WINDOW } from '../../browser/window';
import { WriterPromotionReload } from './writer-promotion-reload';
import { WRITER_LOCK } from './writer-lock';

function setUp(isWriter: ReturnType<typeof signal<boolean>>): {
  writerPromotionReload: WriterPromotionReload;
  reload: ReturnType<typeof vi.fn>;
} {
  const reload = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: WRITER_LOCK, useValue: { isWriter: isWriter.asReadonly() } },
      { provide: WINDOW, useValue: { location: { reload } } },
    ],
  });
  return { writerPromotionReload: TestBed.inject(WriterPromotionReload), reload };
}

describe('WriterPromotionReload', () => {
  it('does not reload when this tab is already the writer when start() is called', () => {
    const { writerPromotionReload, reload } = setUp(signal(true));

    writerPromotionReload.start();
    TestBed.tick();

    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload while this tab stays read-only', () => {
    const isWriter = signal(false);
    const { writerPromotionReload, reload } = setUp(isWriter);

    writerPromotionReload.start();
    TestBed.tick();

    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once this tab is promoted from read-only to writer', () => {
    const isWriter = signal(false);
    const { writerPromotionReload, reload } = setUp(isWriter);
    writerPromotionReload.start();
    TestBed.tick();

    isWriter.set(true);
    TestBed.tick();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('start() is idempotent: only one reload even if called twice', () => {
    const isWriter = signal(false);
    const { writerPromotionReload, reload } = setUp(isWriter);
    writerPromotionReload.start();
    writerPromotionReload.start();
    TestBed.tick();

    isWriter.set(true);
    TestBed.tick();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
