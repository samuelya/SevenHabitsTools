import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppVersionService } from './app-version.service';

describe('AppVersionService', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads the version reported by /api/version', () => {
    const service = TestBed.inject(AppVersionService);
    expect(service.version()).toBeNull();

    httpMock.expectOne('/api/version').flush({ version: '1.2.3' });

    expect(service.version()).toBe('1.2.3');
  });

  it('falls back to null when the request fails', () => {
    const service = TestBed.inject(AppVersionService);

    httpMock.expectOne('/api/version').error(new ProgressEvent('error'));

    expect(service.version()).toBeNull();
  });
});
