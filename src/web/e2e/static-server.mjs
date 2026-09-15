#!/usr/bin/env node
// Serves a built Angular bundle for the Playwright suite. Single responsibility: static files
// with SPA fallback and the production Content-Security-Policy, mirroring the two rules that
// matter from the production nginx config (nginx/default.conf) — deep links fall back to the app
// shell, and index.html is never cached — without pulling in Docker or an extra runtime
// dependency.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

// Mirrors `SecurityHeadersMiddleware.Headers["Content-Security-Policy"]`
// (src/api/Middleware/SecurityHeadersMiddleware.cs) exactly, so a build that only works because
// this suite is more permissive than production (issue #118) fails here too. src/api is owned by
// backend-coder and out of scope for src/web changes — keep this in sync by hand if that policy
// ever changes; the value is quoted verbatim in a comment there for easy diffing.
const PRODUCTION_CSP =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'";

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** Resolves `pathname` to a file under `root`, refusing to escape it via `..` segments. */
async function resolveStaticFile(root, pathname) {
  const safeSuffix = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(root, safeSuffix);
  if (!filePath.startsWith(root + sep) && filePath !== root) {
    return null;
  }
  try {
    const stats = await stat(filePath);
    return stats.isFile() ? filePath : null;
  } catch {
    return null;
  }
}

function startServer(root, port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const requested = decodeURIComponent(url.pathname);
    const filePath = (await resolveStaticFile(root, requested)) ?? join(root, 'index.html');
    const isAppShell = filePath === join(root, 'index.html');
    try {
      const body = await readFile(filePath);
      res.writeHead(200, {
        'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
        'cache-control': isAppShell ? 'no-cache' : 'public, max-age=31536000, immutable',
        'content-security-policy': PRODUCTION_CSP,
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

const [, , rootArg, portArg] = process.argv;
if (!rootArg) {
  console.error('Usage: static-server.mjs <root> [port]');
  process.exit(1);
}

const root = resolve(rootArg);
await startServer(root, Number(portArg ?? 4300));
console.log(`Serving ${root} at http://localhost:${portArg ?? 4300}`);
