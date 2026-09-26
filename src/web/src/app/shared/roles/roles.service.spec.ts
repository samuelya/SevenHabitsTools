import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DocumentStore } from '../../core/data/document.store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import { registerRolesModel } from './roles.model';
import { RolesService } from './roles.service';

function setUp(isWriter = true): RolesService {
  registerRolesModel();
  TestBed.configureTestingModule({
    providers: [
      { provide: CLOCK, useValue: { now: () => new Date('2026-03-10T09:00:00') } },
      {
        provide: WRITER_LOCK,
        useValue: { role: signal(isWriter ? 'writer' : 'reader'), isWriter: signal(isWriter) },
      },
    ],
  });
  return TestBed.inject(RolesService);
}

describe('RolesService', () => {
  it('creates the built-in with the first add(), then adds roles last', () => {
    const service = setUp();
    const dad = service.add({ name: 'Dad', description: 'Being around.', color: 'blue' })!;
    const friend = service.add({ name: 'Friend' })!;
    expect(service.all().map((r) => r.key ?? r.name)).toEqual(['renewal', 'Dad', 'Friend']);
    expect(service.byId(dad)()).toMatchObject({ order: 1, description: 'Being around.' });
    expect(service.byId(friend)()?.order).toBe(2);
  });

  it('ensureBuiltIn() is idempotent and returns the same id', () => {
    const service = setUp();
    const id = service.ensureBuiltIn();
    expect(id).not.toBeNull();
    expect(service.ensureBuiltIn()).toBe(id);
    expect(service.all()).toHaveLength(1);
  });

  it('writes to shared.roles in the document', () => {
    const service = setUp();
    service.add({ name: 'Dad' });
    const doc = TestBed.inject(DocumentStore).document() as unknown as {
      shared: { roles: unknown[] };
    };
    expect(doc.shared.roles).toHaveLength(2);
  });

  it('updates, moves, archives, removes and restores; refuses those on the built-in', () => {
    const service = setUp();
    const id = service.add({ name: 'Dad' })!;
    const saw = service.ensureBuiltIn()!;

    expect(service.update(id, { satisfaction: 3, note: 'Not yet.' })).toBe(true);
    expect(service.byId(id)()).toMatchObject({ satisfaction: 3, note: 'Not yet.' });

    service.move(id, 'up');
    expect(service.active().map((r) => r.id)).toEqual([id, saw]);

    service.archive(id);
    expect(service.active().map((r) => r.id)).toEqual([saw]);
    expect(service.byId(id)()?.archived).toBe(true);
    service.unarchive(id);
    expect(service.active()).toHaveLength(2);

    service.remove(id);
    expect(service.byId(id)()).toBeNull();
    service.restore(id);
    expect(service.byId(id)()).not.toBeNull();

    service.update(saw, { name: 'Gym' });
    service.archive(saw);
    service.remove(saw);
    expect(service.byId(saw)()).toMatchObject({ key: 'renewal' });
    expect(service.byId(saw)()?.name).toBeUndefined();
    expect(service.byId(saw)()?.archived).toBeUndefined();
  });

  it('reports a refused write in a read-only tab', () => {
    const service = setUp(false);
    expect(service.add({ name: 'Dad' })).toBeNull();
    expect(service.ensureBuiltIn()).toBeNull();
    expect(service.all()).toEqual([]);
  });
});
