import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DocumentStore } from '../../core/data/document.store';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import { registerRoleGoalsModel } from './role-goals.model';
import { RoleGoalsService } from './role-goals.service';
import { ROLES_MODEL_KEY, Role, registerRolesModel } from './roles.model';

const now = vi.fn(() => new Date('2026-03-10T09:00:00'));

function setUp(isWriter = true): RoleGoalsService {
  registerRolesModel();
  registerRoleGoalsModel();
  now.mockClear();
  TestBed.configureTestingModule({
    providers: [
      { provide: CLOCK, useValue: { now } },
      {
        provide: WRITER_LOCK,
        useValue: { role: signal(isWriter ? 'writer' : 'reader'), isWriter: signal(isWriter) },
      },
    ],
  });
  return TestBed.inject(RoleGoalsService);
}

describe('RoleGoalsService', () => {
  it('adds an open goal for a role with the default horizon', () => {
    const service = setUp();
    const id = service.add({ roleId: 'dad', what: 'One evening a week' })!;
    expect(service.forRole('dad')).toEqual([
      expect.objectContaining({ id, horizon: 'year', status: 'open', steps: [] }),
    ]);
  });

  it('dates Reached with the local day and Reopen clears it', () => {
    const service = setUp();
    const id = service.add({ roleId: 'dad', what: 'x' })!;
    service.setStatus(id, 'reached');
    expect(service.forRole('dad')[0]).toMatchObject({
      status: 'reached',
      resolvedOn: '2026-03-10',
    });
    service.reopen(id);
    expect(service.forRole('dad')[0].resolvedOn).toBeUndefined();
  });

  it('adds up to five steps, returning each key, then null', () => {
    const service = setUp();
    const dad: Role = { id: 'dad', createdAt: 'x', updatedAt: 'x', name: 'Dad', order: 0 };
    TestBed.runInInjectionContext(() => featureStore<Role[]>(ROLES_MODEL_KEY).update(() => [dad]));
    const id = service.add({ roleId: 'dad', what: 'x' })!;
    const keys = Array.from({ length: 5 }, () => service.addStep(id));
    expect(keys.every((key) => typeof key === 'string')).toBe(true);
    expect(service.addStep(id)).toBeNull();
    service.editStep(id, keys[0]!, 'Ask her');
    service.toggleStep(id, keys[1]!, true);
    service.removeStep(id, keys[2]!);
    expect(service.forRole('dad')[0].steps).toHaveLength(4);
    expect(service.openSteps()).toEqual([
      { goalId: id, roleId: 'dad', key: keys[0], text: 'Ask her' },
    ]);
  });

  it('writes nothing for a no-op edit, and no slice at all when there is nothing to change', () => {
    const service = setUp();
    const store = TestBed.inject(DocumentStore);
    const empty = store.document();
    service.removeForRole('dad', new Date());
    service.update('missing', { what: 'x' });
    expect(store.document()).toBe(empty);
    const id = service.add({ roleId: 'dad', what: 'x' })!;
    const doc = store.document();
    service.update(id, { what: ' ' });
    service.update(id, { what: 'x' });
    service.reopen(id);
    expect(store.document()).toBe(doc);
  });

  it('runs each change once', () => {
    const service = setUp();
    const id = service.add({ roleId: 'dad', what: 'x' })!;
    now.mockClear();
    service.update(id, { what: 'y' });
    // One clock read for the store's write stamp, one for the edit's `updatedAt`: not two runs.
    expect(now).toHaveBeenCalledTimes(2);
  });

  it('refuses writes in a read-only tab', () => {
    const service = setUp(false);
    expect(service.add({ roleId: 'dad', what: 'x' })).toBeNull();
    expect(service.all()).toEqual([]);
  });

  it('remove() and restore() round-trip', () => {
    const service = setUp();
    const id = service.add({ roleId: 'dad', what: 'x' })!;
    service.remove(id);
    expect(service.all()).toEqual([]);
    service.restore(id);
    expect(service.all().map((goal) => goal.id)).toEqual([id]);
  });
});
