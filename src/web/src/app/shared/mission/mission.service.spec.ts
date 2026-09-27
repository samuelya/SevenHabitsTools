import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DocumentStore } from '../../core/data/document.store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import { MAX_LINES } from './mission.logic';
import { MISSION_PATH, registerMissionModel } from './mission.model';
import { MissionService } from './mission.service';

const NOW = new Date('2026-03-10T09:00:00.000Z');

function setUp(isWriter = true): { service: MissionService; store: DocumentStore } {
  registerMissionModel();
  TestBed.configureTestingModule({
    providers: [
      { provide: CLOCK, useValue: { now: () => NOW } },
      {
        provide: WRITER_LOCK,
        useValue: { role: signal(isWriter ? 'writer' : 'reader'), isWriter: signal(isWriter) },
      },
    ],
  });
  return { service: TestBed.inject(MissionService), store: TestBed.inject(DocumentStore) };
}

describe('MissionService', () => {
  it('writes nothing, not even null, for an empty first edit', () => {
    const { service, store } = setUp();
    const before = store.document();
    expect(service.edit({ draft: '  ' })).toBe(true);
    expect(service.setRoleLine('r1', '')).toBe(true);
    expect(store.document()).toBe(before);
    // The empty document's own slot (the model's `defaults()`), untouched: same document above.
    expect(store.select(MISSION_PATH)()).toBeNull();
    expect(service.record()).toBeNull();
  });

  it('creates the record on a first "No" checklist answer', () => {
    const { service, store } = setUp();
    expect(service.setCheck('roles', false)).toBe(true);
    expect(store.select(MISSION_PATH)()).toMatchObject({ checklist: { roles: false } });
  });

  it('creates the record on the first real edit and keeps its id after', () => {
    const { service } = setUp();
    expect(service.addLine('values', ' presence ')).toBe('added');
    const id = service.record()?.id;
    expect(service.record()?.values).toEqual(['presence']);
    service.edit({ draft: 'I want to be present.' });
    expect(service.record()?.id).toBe(id);
    expect(service.record()?.createdAt).toBe(NOW.toISOString());
  });

  it('adds, deduplicates, caps and removes lines', () => {
    const { service } = setUp();
    expect(service.addLine('toBe', 'calm')).toBe('added');
    expect(service.addLine('toBe', 'CALM')).toBe('duplicate');
    expect(service.addLine('toBe', ' ')).toBe('empty');
    for (let i = 1; i < MAX_LINES; i++) {
      service.addLine('toBe', `line ${i}`);
    }
    expect(service.addLine('toBe', 'eleventh')).toBe('full');
    expect(service.record()?.toBe).toHaveLength(MAX_LINES);
    expect(service.removeLine('toBe', 0)).toBe(true);
    expect(service.record()?.toBe[0]).toBe('line 1');
  });

  it('sets role lines and review answers', () => {
    const { service } = setUp();
    service.setRoleLine('r1', 'the one who calls first');
    service.setCheck('ownWords', true);
    expect(service.record()?.roleLines).toEqual([
      { roleId: 'r1', text: 'the one who calls first' },
    ]);
    expect(service.record()?.checklist).toEqual({ ownWords: true });
  });

  it('saves a version once per change and exposes the current statement', () => {
    const { service } = setUp();
    expect(service.saveVersion()).toBeNull();
    service.edit({ draft: 'I keep my word.' });
    expect(service.currentStatement()).toBe('');
    expect(service.saveVersion()).toBe(1);
    expect(service.saveVersion()).toBeNull();
    expect(service.currentStatement()).toBe('I keep my word.');
    service.edit({ draft: 'I keep my word, especially the small ones.' });
    expect(service.saveVersion()).toBe(2);
    expect(service.record()?.versions.map((version) => version.text)).toEqual([
      'I keep my word.',
      'I keep my word, especially the small ones.',
    ]);
  });

  it('reports a refused write in a read-only tab and keeps the typed line', () => {
    const { service } = setUp(false);
    expect(service.edit({ draft: 'x' })).toBe(false);
    expect(service.addLine('values', 'time')).toBe('refused');
    expect(service.record()).toBeNull();
  });
});
