import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import { Project, registerProjectsModel } from './projects.model';
import { ProjectsService } from './projects.service';

const T0 = '2026-09-01T00:00:00.000Z';

function project(id: string, fields: Partial<Project> = {}): Project {
  return {
    id,
    createdAt: T0,
    updatedAt: T0,
    name: id,
    desiredResult: 'Done well.',
    criteria: [],
    steps: [
      { key: `${id}-1`, text: 'Ticked', done: true },
      { key: `${id}-2`, text: 'Open', done: false },
    ],
    status: 'underWay',
    ...fields,
  };
}

function setUp(isWriter = true): ProjectsService {
  registerProjectsModel();
  TestBed.configureTestingModule({
    providers: [
      { provide: CLOCK, useValue: { now: () => new Date('2026-09-10T10:00:00') } },
      {
        provide: WRITER_LOCK,
        useValue: { role: signal(isWriter ? 'writer' : 'reader'), isWriter: signal(isWriter) },
      },
    ],
  });
  return TestBed.inject(ProjectsService);
}

describe('ProjectsService', () => {
  it('allOpenSteps() offers open steps of live, non-sample projects under way only', () => {
    const service = setUp();
    service.update(() => [
      project('mine'),
      project('finished', { status: 'done' }),
      project('dropped', { status: 'dropped' }),
      project('example', { sample: true }),
      project('deleted', { deletedAt: T0 }),
    ]);
    expect(service.allOpenSteps()).toEqual([{ projectId: 'mine', key: 'mine-2', text: 'Open' }]);
  });

  it('updates allOpenSteps() when a step is ticked', () => {
    const service = setUp();
    service.update(() => [project('mine')]);
    service.update((list) =>
      list.map((p) => ({ ...p, steps: p.steps.map((step) => ({ ...step, done: true })) })),
    );
    expect(service.allOpenSteps()).toEqual([]);
  });

  it('refuses writes in a read-only tab', () => {
    const service = setUp(false);
    expect(service.update(() => [project('mine')])).toBe(false);
    expect(service.value()).toEqual([]);
  });
});
