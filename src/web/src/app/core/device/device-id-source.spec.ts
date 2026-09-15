import { TestBed } from '@angular/core/testing';
import { DEVICE_ID_SOURCE } from './device-id-source';

describe('DEVICE_ID_SOURCE', () => {
  it('the default source returns a distinct id each call', () => {
    const source = TestBed.inject(DEVICE_ID_SOURCE);
    expect(source.id()).not.toBe(source.id());
  });

  it('can be swapped for a fixed id in tests', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: DEVICE_ID_SOURCE, useValue: { id: () => 'device-1' } }],
    });

    expect(TestBed.inject(DEVICE_ID_SOURCE).id()).toBe('device-1');
  });
});
