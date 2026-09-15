import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WINDOW } from '../../browser/window';
import { PROMOTION_SETTLE_MS, WriterPromotionReload } from './writer-promotion-reload';
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
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

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

  it('does not reload for its own lock grant settling shortly after start() (#35 regression)', () => {
    // Every tab's `isWriter()` starts `false` and flips `true` once its own (possibly
    // uncontended) request resolves — including the very first, uncontended writer. Without the
    // settle window this looked identical to a genuine promotion and reloaded every tab on
    // startup, which in turn dropped and re-requested the lock, causing a reload loop.
    const isWriter = signal(false);
    const { writerPromotionReload, reload } = setUp(isWriter);
    writerPromotionReload.start();
    TestBed.tick();

    isWriter.set(true); // the (uncontended) grant resolving almost immediately
    TestBed.tick();

    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once this tab is promoted from read-only to writer after the settle window', () => {
    const isWriter = signal(false);
    const { writerPromotionReload, reload } = setUp(isWriter);
    writerPromotionReload.start();
    TestBed.tick();

    vi.advanceTimersByTime(PROMOTION_SETTLE_MS);
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

    vi.advanceTimersByTime(PROMOTION_SETTLE_MS);
    isWriter.set(true);
    TestBed.tick();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
