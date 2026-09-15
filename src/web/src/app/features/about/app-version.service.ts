import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

interface VersionResponse {
  readonly version: string;
}

/** Reads the deployed app version reported by the API's `/api/version` endpoint. */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private readonly http = inject(HttpClient);

  /** Deployed version string, or `null` while loading or if the request fails. */
  readonly version = toSignal(
    this.http.get<VersionResponse>('/api/version').pipe(
      map((response) => response.version),
      catchError(() => of(null)),
    ),
    { initialValue: null },
  );
}
