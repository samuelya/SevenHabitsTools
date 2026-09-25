import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DocumentStore } from '../../core/data/document.store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import { registerCommitmentsModel } from './commitments.model';
import { CommitmentsService } from './commitments.service';

function setUp(isWriter = true): CommitmentsService {
  registerCommitmentsModel();
  TestBed.configureTestingModule({
    providers: [
      { provide: CLOCK, useValue: { now: () => new Date('2026-03-10T09:00:00') } },
      {
        provide: WRITER_LOCK,
        useValue: { role: signal(isWriter ? 'writer' : 'reader'), isWriter: signal(isWriter) },
      },
    ],
  });
  return TestBed.inject(CommitmentsService);
}

describe('CommitmentsService', () => {
  it('adds an open promise with a source and reads it back by id', () => {
    const service = setUp();
    const id = service.add({
      text: 'Ask for help with the budget.',
      toWhom: 'self',
      dueDate: '2026-03-12',
      source: { exerciseId: 'h1-circle', recordId: 'r1' },
    });
    expect(id).not.toBeNull();
    expect(service.byId(id!)()).toMatchObject({
      text: 'Ask for help with the budget.',
      status: 'open',
      dueDate: '2026-03-12',
      source: { exerciseId: 'h1-circle', recordId: 'r1' },
    });
    expect(service.all()).toHaveLength(1);
  });

  it('writes to shared.commitments in the document', () => {
    const service = setUp();
    service.add({ text: 'Call Mum.', toWhom: 'self' });
    const doc = TestBed.inject(DocumentStore).document() as unknown as {
      shared: { commitments: unknown[] };
    };
    expect(doc.shared.commitments).toHaveLength(1);
  });

  it('updates while open, resolves today, reopens, removes and restores', () => {
    const service = setUp();
    const id = service.add({ text: 'Call Mum.', toWhom: 'self' })!;
    expect(service.update(id, { text: 'Call Mum on Sunday.' })).toBe(true);
    expect(service.byId(id)()?.text).toBe('Call Mum on Sunday.');

    service.setStatus(id, 'broken', { repairNote: 'Forgot.' });
    expect(service.byId(id)()).toMatchObject({
      status: 'broken',
      resolvedOn: '2026-03-10',
      repairNote: 'Forgot.',
    });
    service.update(id, { text: 'Not while broken' });
    expect(service.byId(id)()?.text).toBe('Call Mum on Sunday.');

    service.reopen(id);
    expect(service.byId(id)()?.status).toBe('open');
    expect(service.byId(id)()?.resolvedOn).toBeUndefined();

    service.remove(id);
    expect(service.byId(id)()).toBeNull();
    expect(service.all()).toEqual([]);
    service.restore(id);
    expect(service.byId(id)()).not.toBeNull();
  });

  // Review finding 8 (PR #282): a draft stored through insert() keeps no blank or undefined key.
  it('stores an inserted record without undefined or cleared optional keys', () => {
    const service = setUp();
    service.insert({
      id: 'd1',
      createdAt: '2026-03-10T09:00:00.000Z',
      updatedAt: '2026-03-10T09:00:00.000Z',
      text: 'Call Mum.',
      toWhom: 'self',
      status: 'open',
      dueDate: '',
      personName: 'Dina',
      resolvedOn: undefined,
    });
    const doc = TestBed.inject(DocumentStore).document() as unknown as {
      shared: { commitments: Record<string, unknown>[] };
    };
    const [stored] = doc.shared.commitments;
    expect(Object.keys(stored).sort()).toEqual(
      ['createdAt', 'id', 'status', 'text', 'toWhom', 'updatedAt'].sort(),
    );
  });

  it('reports a refused write in a read-only tab', () => {
    const service = setUp(false);
    expect(service.add({ text: 'Call Mum.', toWhom: 'self' })).toBeNull();
    expect(service.all()).toEqual([]);
  });
});
