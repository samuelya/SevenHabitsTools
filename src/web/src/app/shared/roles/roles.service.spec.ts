import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DocumentStore } from '../../core/data/document.store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import { registerRoleGoalsModel } from './role-goals.model';
import { RoleGoalsService } from './role-goals.service';
import { registerRolesModel } from './roles.model';
import { RolesService } from './roles.service';

let clockNow = new Date('2026-03-10T09:00:00');

function setUp(isWriter = true): RolesService {
  clockNow = new Date('2026-03-10T09:00:00');
  registerRolesModel();
  registerRoleGoalsModel();
  TestBed.configureTestingModule({
    providers: [
      { provide: CLOCK, useValue: { now: () => clockNow } },
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
    expect(service.byId(dad)).toMatchObject({ order: 1, description: 'Being around.' });
    expect(service.byId(friend)?.order).toBe(2);
  });

  it('ensureBuiltIn() is idempotent and returns the same id', () => {
    const service = setUp();
    const id = service.ensureBuiltIn();
    expect(id).not.toBeNull();
    const doc = TestBed.inject(DocumentStore).document();
    expect(service.ensureBuiltIn()).toBe(id);
    expect(service.all()).toHaveLength(1);
    // No write the second time: the document is the very same object.
    expect(TestBed.inject(DocumentStore).document()).toBe(doc);
  });

  it('writes nothing for a refused or no-op edit', () => {
    const service = setUp();
    const saw = service.ensureBuiltIn()!;
    const id = service.add({ name: 'Dad', color: 'blue' })!;
    const doc = TestBed.inject(DocumentStore).document();
    service.update(id, { color: 'blue' });
    service.update(id, { name: '  ' });
    service.update(saw, { name: 'Gym' });
    service.archive(saw);
    service.remove(saw);
    service.move(saw, 'up');
    service.unarchive(id);
    expect(TestBed.inject(DocumentStore).document()).toBe(doc);
    expect(service.byId(id)?.name).toBe('Dad');
  });

  it('byId() tracks the roles when read inside a computed', () => {
    const service = setUp();
    const id = service.add({ name: 'Dad' })!;
    const name = computed(() => service.byId(id)?.name ?? null);
    expect(name()).toBe('Dad');
    service.update(id, { name: 'Mum' });
    expect(name()).toBe('Mum');
    service.remove(id);
    expect(name()).toBeNull();
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
    expect(service.byId(id)).toMatchObject({ satisfaction: 3, note: 'Not yet.' });

    service.move(id, 'up');
    expect(service.active().map((r) => r.id)).toEqual([id, saw]);

    service.archive(id);
    expect(service.active().map((r) => r.id)).toEqual([saw]);
    expect(service.byId(id)?.archived).toBe(true);
    service.unarchive(id);
    expect(service.active()).toHaveLength(2);

    service.remove(id);
    expect(service.byId(id)).toBeNull();
    service.restore(id);
    expect(service.byId(id)).not.toBeNull();

    service.update(saw, { name: 'Gym' });
    service.archive(saw);
    service.remove(saw);
    expect(service.byId(saw)).toMatchObject({ key: 'renewal' });
    expect(service.byId(saw)?.name).toBeUndefined();
    expect(service.byId(saw)?.archived).toBeUndefined();
  });

  it('reports a refused write in a read-only tab', () => {
    const service = setUp(false);
    expect(service.add({ name: 'Dad' })).toBeNull();
    expect(service.ensureBuiltIn()).toBeNull();
    expect(service.all()).toEqual([]);
  });

  it("remove() takes the role's goals with it and restore() brings back only those (#291)", () => {
    const service = setUp();
    const goals = TestBed.inject(RoleGoalsService);
    const dad = service.add({ name: 'Dad' })!;
    const friend = service.add({ name: 'Friend' })!;
    const evening = goals.add({ roleId: dad, what: 'One evening a week' })!;
    const earlier = goals.add({ roleId: dad, what: 'Deleted on its own' })!;
    const call = goals.add({ roleId: friend, what: 'Call first' })!;
    goals.remove(earlier);
    clockNow = new Date('2026-03-10T10:00:00');

    expect(service.remove(dad)).toBe(true);
    expect(goals.forRole(dad)).toEqual([]);
    expect(goals.forRole(friend).map((goal) => goal.id)).toEqual([call]);

    expect(service.restore(dad)).toBe(true);
    expect(goals.forRole(dad).map((goal) => goal.id)).toEqual([evening]);
  });

  it('a refused delete of the built-in leaves its goals alone', () => {
    const service = setUp();
    const saw = service.ensureBuiltIn()!;
    const goals = TestBed.inject(RoleGoalsService);
    goals.add({ roleId: saw, what: 'Walk daily' });
    service.remove(saw);
    expect(goals.forRole(saw)).toHaveLength(1);
  });

  it('deleting a role with no goals writes no goals slice', () => {
    const service = setUp();
    const dad = service.add({ name: 'Dad' })!;
    service.remove(dad);
    service.restore(dad);
    const doc = TestBed.inject(DocumentStore).document() as unknown as {
      habits?: { h2?: { roleGoals?: unknown } };
    };
    expect(doc.habits?.h2?.roleGoals).toBeUndefined();
  });
});
