# Seven Habits Tools

A mobile-first personal planning app for working through the exercises in *The 7 Habits of Highly
Effective People*. See the pinned "Architecture & conventions" GitHub issue for the full design.
**Not affiliated with, endorsed by or licensed by FranklinCovey.**

## Run locally

### Prerequisites
- .NET 10 SDK
- Node.js 22.22.3+ and npm 11 (see Troubleshooting if your global npm is older)
- Docker Desktop — optional, only needed for the prod-like mode

### Mode 1: UI only
```sh
cd src/web
npm start
```
Open http://localhost:4200. `/api` and `/healthz` are proxied to http://localhost:8080
(`src/web/proxy.conf.json`) when the API is also running.

### Mode 2: Full stack, no Docker (debug)
The API runs from source with the debugger attached and proxies everything but `/api` and
`/healthz` to the Angular dev server on 4200, with live reload:
```sh
# terminal 1
cd src/web && npm start

# terminal 2
dotnet run --project src/api --launch-profile "Api (full stack)"
```
Open http://localhost:8080 for the same topology as prod.

### Mode 3: Prod-like (optional, needs Docker Desktop)
```sh
cp .env.example .env   # optional, only needed for Cloud Sync / App Insights variables
docker compose up --build
```
- API: http://localhost:8080 — serves the built Angular app through YARP, plus `/healthz` and `/api/**`.
- Web (nginx): http://localhost:8081 — not normally accessed directly; the API proxies to it.

### VS Code
1. Open the repository root and install the recommended extensions (C# Dev Kit, Angular Language
   Service) when prompted.
2. Run the **Full stack** compound launch configuration to build and debug the API, start the
   Angular dev server (background task `web: start`) and open Chrome at http://localhost:8080.
   `API (.NET)` and `Web: Chrome (4200)` are also available individually.
3. Set a breakpoint in an API endpoint (e.g. `/api/version` in `src/api/Endpoints/ApiEndpoints.cs`)
   and in an Angular component; both are hit through the `Full stack` configuration.

### Rider
1. Open `src/SevenHabits.slnx`. Rider picks up the committed `.run/*.run.xml` configurations:
   `API`, `Web (npm start)`, `Web: Chrome debug (8080)` and the compound `Full stack`.
2. Run **Full stack** to start the API (via the `Api (full stack)` launch profile), the Angular
   dev server and a Chrome debug session together.
3. Breakpoints in the API and in an Angular component hit the same way as in VS Code.

### Troubleshooting
- **Port already in use (4200, 8080 or 8081):** stop the other process, or change the port
  (`ng serve --port`, or `applicationUrl` in `src/api/Properties/launchSettings.json`).
- **npm crashes on install:** this repo requires npm 11 (`packageManager` in `src/web/package.json`
  pins `npm@11.19.1`); older npm has a known crash on this project. Install it once with
  `npm install -g npm@11.19.1`, or use `corepack`.
- **Live-reload WebSocket blocked by CSP:** only Mode 2 (`ASPNETCORE_ENVIRONMENT=Development`)
  relaxes `connect-src` for `localhost:4200`; production responses are never affected.
