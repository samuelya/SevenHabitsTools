# Seven Habits Tools web app

Angular (standalone components, signals, Angular Material). See the pinned GitHub issue
"Architecture & conventions (read first)" for the rules every change follows.

```bash
npm ci
npm start            # http://localhost:4200
npm run lint         # ESLint + Prettier check
npm test             # Vitest, single run
npm run build        # dist/web/browser
```

## Layout

- `src/app/route-registry.ts`: one line per feature. `app.routes.ts` is generated from it; do not edit it.
- `src/app/features/<feature>/`: a feature's routes, components, model and tests.
- `src/app/core/`: shell (navigation, top app bar, title), habits list, routing helpers.
- `src/app/shared/`: reusable UI.

## Container

`Dockerfile` (build context `src/web`) builds the app and serves it with unprivileged nginx on port 8081
(`nginx/default.conf`).
