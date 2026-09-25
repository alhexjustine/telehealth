#!/usr/bin/env node
/**
 * Scans the built web app for any reference to an external host, so no
 * page, script, or stylesheet can silently start depending on a
 * SaaS/CDN/analytics/font/image service (`Requirement: Self-contained
 * public assets`). Run after `vite build`, against `dist/`.
 *
 * Two things keep this from being a blunt regex that fails on every build:
 *
 * 1. Protocol-relative `//host` URLs are only checked in HTML/CSS/SVG,
 *    where `//host` unambiguously means a browser request (a `src`, `href`,
 *    or `url(...)`). Minified JS is full of unrelated `//` substrings —
 *    regex-literal flags, split/replace patterns, placeholder base URLs —
 *    that are not requests; a real external call in JS always carries an
 *    explicit scheme (`fetch('https://…')`), which the `https?://` check
 *    below still catches everywhere, including `.js` files.
 * 2. A short, explicit allow-list covers host strings confirmed (by reading
 *    the built bundle) to be inert — vendor documentation/error-message
 *    text or schema identifiers, never fetched — the same exception the
 *    spec already grants XML namespace identifiers. Each entry says which
 *    dependency it comes from and why it's safe; anything else still fails
 *    the build.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url));

// Files where a bare `//host` (no scheme) is meaningfully a browser request.
const PROTOCOL_RELATIVE_EXTENSIONS = new Set(['.html', '.css', '.svg']);
// Every file type this check reads at all.
const SCANNED_EXTENSIONS = new Set(['.html', '.js', '.css', '.svg', '.json']);

// Stops at backtick/`${`/`}` too, on top of the usual quote/whitespace/paren
// delimiters — minified JS builds URLs at runtime as template-literal
// concatenations (`` `https://`+host ``, `` `http://[${addr}]` ``), and
// without this a match runs straight through the following code.
const URL_STOP_CHARS = String.raw`[^\s"')<>` + '`${}]+';
const SCHEME_URL_PATTERN = new RegExp(String.raw`https?:\/\/${URL_STOP_CHARS}`, 'g');
const PROTOCOL_RELATIVE_PATTERN = new RegExp(String.raw`(?<!:)\/\/${URL_STOP_CHARS}`, 'g');

// A real DNS host (or the start of an IPv4/IPv6 literal) always starts with
// a letter or digit. This is what tells a genuine external host apart from
// a bare `https://` scheme, or a `[` about to be filled in by a template
// variable (`` `http://[${addr}]` ``) — both concatenation artifacts above,
// not references to anything.
const HOST_START_PATTERN = /^(?:https?:)?\/\/[a-zA-Z0-9]/;

const ALLOWED_URL_PATTERNS = [
  // XML/W3C namespace identifiers on every inline `<svg>` — not a request.
  { pattern: /^https?:\/\/www\.w3\.org\//, reason: 'XML/SVG namespace identifier' },
  { pattern: /^https?:\/\/json\.schemastore\.org\//, reason: 'JSON Schema self-identifier' },
  // zod's `.toJSONSchema()` writes these as the `$schema` identifier value
  // on generated schema objects — an identifier, never fetched.
  { pattern: /^https?:\/\/json-schema\.org\//, reason: "zod: JSON Schema '$schema' identifier" },
  { pattern: /^http:\/\/json-schema\.org\//, reason: "zod: JSON Schema '$schema' identifier" },
  // React's minified-error decoder link, embedded verbatim in React's own
  // build for a console error message ("see https://react.dev/errors/###").
  { pattern: /^https:\/\/react\.dev\//, reason: 'React: minified-error decoder link (console text only)' },
  // react-router's own dev-warning message text (data-router usage, and a
  // recommendation to polyfill URLSearchParams on old browsers).
  { pattern: /^https:\/\/reactrouter\.com\//, reason: 'react-router: dev-warning message text' },
  { pattern: /^https:\/\/github\.com\/ungap\//, reason: 'react-router: dev-warning message text' },
  // socket.io-client's own error message when talking to an incompatible
  // server version.
  { pattern: /^https:\/\/socket\.io\//, reason: 'socket.io-client: error message text' },
  // Tailwind's compiled-output license/attribution comment banner.
  { pattern: /^https:\/\/tailwindcss\.com\b/, reason: "Tailwind CSS's own attribution comment" },
  // react-router's fallback base URL for resolving relative URLs when no
  // `window` exists — not a network request, and not a third-party host.
  { pattern: /^https?:\/\/localhost\b/, reason: 'react-router: same-machine fallback base URL' },
];

function isAllowed(url) {
  return ALLOWED_URL_PATTERNS.some(({ pattern }) => pattern.test(url));
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (SCANNED_EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  let files;
  try {
    files = await walk(DIST_DIR);
  } catch (error) {
    console.error(`Could not read ${DIST_DIR} — run "vite build" first.`);
    console.error(error);
    process.exitCode = 1;
    return;
  }

  const offenses = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const ext = extname(file);
    const candidates = content.match(SCHEME_URL_PATTERN) ?? [];
    if (PROTOCOL_RELATIVE_EXTENSIONS.has(ext)) {
      candidates.push(...(content.match(PROTOCOL_RELATIVE_PATTERN) ?? []));
    }
    for (const match of candidates) {
      if (HOST_START_PATTERN.test(match) && !isAllowed(match)) {
        offenses.push({ file, url: match });
      }
    }
  }

  if (offenses.length > 0) {
    console.error('Found references to external hosts in the built web app:\n');
    for (const offense of offenses) {
      console.error(`  ${offense.file.replace(DIST_DIR, 'dist')} → ${offense.url}`);
    }
    console.error(
      `\n${offenses.length} offending reference(s). Public pages must be fully self-contained ` +
        '(no external scripts, styles, fonts, images, or data).',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Checked ${files.length} file(s) in dist/ — no external references found.`);
}

await main();
