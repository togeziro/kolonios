#!/usr/bin/env bun
/**
 * E2E login helper for BrowserOS MCP sessions.
 *
 * Better-auth is configured with `basePath: '/api/v1/auth'`
 * (see src/lib/auth/auth.server.ts). The sign-in endpoint returns
 * a `Set-Cookie` for `better-auth.session_token` (HttpOnly, SameSite=Lax,
 * 7-day Max-Age).
 *
 * Usage:
 *   bun run scripts/browser-harness/login.mjs --email admin@example.com
 *     → prints the full Set-Cookie header value
 *   bun run scripts/browser-harness/login.mjs --email admin@example.com --json
 *     → prints { status, cookie }
 *
 * Browser-side application: from a `broseros_evaluate` call, paste the
 * fetched cookie via document.cookie (note: HttpOnly cannot be set from
 * JS — use this script's `Set-Cookie` value as the `Cookie` header on
 * the actual navigation). For full programmatic login, prefer:
 *
 *   await fetch('/api/v1/auth/sign-in/email', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ email, password }),
 *     credentials: 'include'
 *   });
 *
 * from a page-context `evaluate` so cookies land in the browser.
 */

import { parseArgs } from 'node:util';

const DEFAULT_BASE = process.env.E2E_BASE_URL ?? 'https://172.17.16.3:8082';
const DEFAULT_PASSWORD = 'Password123!';

const { values } = parseArgs({
  options: {
    email: { type: 'string', short: 'e' },
    password: { type: 'string', short: 'p', default: DEFAULT_PASSWORD },
    base: { type: 'string', short: 'b', default: DEFAULT_BASE },
    json: { type: 'boolean', default: false }
  }
});

if (!values.email) {
  console.error(
    'Usage: bun run scripts/browser-harness/login.mjs --email <email> [--password <pw>] [--base <url>] [--json]'
  );
  process.exit(2);
}

const url = `${values.base.replace(/\/$/, '')}/api/v1/auth/sign-in/email`;

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: values.email, password: values.password })
});

const setCookie = res.headers.get('set-cookie') ?? '';
const body = await res.text();

if (values.json) {
  console.log(
    JSON.stringify({ status: res.status, cookie: setCookie, body: body.slice(0, 500) }, null, 2)
  );
} else {
  console.log(`status: ${res.status}`);
  if (setCookie) console.log(`cookie: ${setCookie}`);
  if (res.status >= 400) console.log(`body:   ${body.slice(0, 500)}`);
}
process.exit(res.ok ? 0 : 1);
