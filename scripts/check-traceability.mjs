#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fails CI if any `#### Scenario:` in an `openspec/specs/<capability>/spec.md` file has no automated test whose
 * name contains the scenario's exact title (case-insensitive), unless the scenario is listed in
 * `openspec/manual-verification.md` with a justification. See the `journey-verification` spec's
 * "Scenario-to-test traceability" requirement and design.md's "Traceability check".
 *
 * Scenario titles repeat across capabilities (and occasionally twice within one capability, e.g.
 * two "Signed-out denied" requirements in the same spec). Matching is a maximum bipartite
 * matching between scenario occurrences and test titles containing them, so each test title can
 * satisfy at most one occurrence — this is what "one match per capability occurrence" means in
 * practice, without requiring every qualifier to literally spell out its capability slug (the
 * existing test suite's qualifiers are free-form, e.g. "Signed-out denied (search)").
 */

const SCENARIO_HEADING = /^#### Scenario: (.+)$/gm;
// Matches it(...), test(...), describe(...), and their .skip/.only/.each/.todo variants, capturing
// a plain (non-interpolated) string literal title as the first argument.
const TEST_CALL = /\b(?:it|test|describe)(?:\.\w+)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', 'generated', '.vite']);

/** @typedef {{ capability: string, title: string }} ScenarioOccurrence */

/** Parses every `#### Scenario: <title>` in `openspec/specs/<capability>/spec.md`. */
export function parseScenarios(specsDir) {
  /** @type {ScenarioOccurrence[]} */
  const scenarios = [];
  let capabilities;
  try {
    capabilities = readdirSync(specsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return scenarios;
  }
  for (const dir of capabilities) {
    const specPath = join(specsDir, dir.name, 'spec.md');
    let content;
    try {
      content = readFileSync(specPath, 'utf8');
    } catch {
      continue;
    }
    for (const match of content.matchAll(SCENARIO_HEADING)) {
      scenarios.push({ capability: dir.name, title: match[1].trim() });
    }
  }
  return scenarios;
}

function walk(dir, files) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (SOURCE_EXTENSIONS.has(full.slice(full.lastIndexOf('.')))) {
      files.push(full);
    }
  }
}

/** Scans every `it(`/`test(`/`describe(` string-literal title under the given root directories. */
export function parseTestTitles(rootDirs) {
  /** @type {string[]} */
  const titles = [];
  for (const root of rootDirs) {
    if (!statOrNull(root)) continue;
    const files = [];
    walk(root, files);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(TEST_CALL)) {
        const raw = match[2];
        // Skip anything with template interpolation left in (a `${...}` couldn't have matched the
        // backtick branch's no-backslash rule anyway unless escaped, but guard explicitly too).
        if (raw.includes('${')) continue;
        // Unescape backslash-escaped characters (e.g. `\'` in a single-quoted title like
        // `'Subscribing to someone else\'s workspace'`) so the title compares equal to the
        // spec's unescaped scenario text.
        titles.push(raw.replace(/\\(.)/g, '$1'));
      }
    }
  }
  return titles;
}

/**
 * Scenarios from every *active* (not yet archived) change's own delta specs, e.g.
 * `openspec/changes/harden-core-journey/specs/<capability>/spec.md` — an ADDED capability
 * (`demo-data`, `ui-resilience`, `journey-verification` here) has no main spec yet, and a MODIFIED
 * capability's delta only restates the requirements that changed (see `openspec/config.yaml`'s
 * archive step: deltas merge into `openspec/specs/` only once archived). Without this, a scenario
 * that only exists in an in-flight change's delta — like `local-deployment`'s new "Ready to
 * explore" — would never be checked at all until after archiving, which defeats the point of
 * running this check *during* the change. Archived changes live under `openspec/changes/archive/`
 * and are skipped: their deltas are already reflected in `openspec/specs/`, so re-scanning them
 * would double-count every scenario they ever touched.
 */
export function parseActiveChangeScenarios(changesDir) {
  let entries;
  try {
    entries = readdirSync(changesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const scenarios = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'archive') continue;
    scenarios.push(...parseScenarios(join(changesDir, entry.name, 'specs')));
  }
  return scenarios;
}

/**
 * Merges an active change's delta scenarios into the main-spec scenario list, skipping any
 * (capability, title) pair the main specs already have — a MODIFIED requirement's delta restates
 * its unchanged scenarios verbatim (see `parseActiveChangeScenarios`), and those must not count as
 * a second occurrence requiring a second test. A pair only in the delta (an ADDED capability, or a
 * genuinely new scenario on a MODIFIED requirement) is appended.
 */
export function mergeScenarios(mainScenarios, changeScenarios) {
  const seen = new Set(mainScenarios.map((s) => `${s.capability}::${s.title}`));
  const merged = [...mainScenarios];
  for (const scenario of changeScenarios) {
    const key = `${scenario.capability}::${scenario.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(scenario);
  }
  return merged;
}

function statOrNull(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

/** @typedef {{ capability: string, title: string, howVerified: string, why: string }} RegisterEntry */

/**
 * Parses the manual-verification register: a Markdown table with columns Capability, Scenario,
 * How verified, Why not automated (in that order; header/separator rows and blank lines are
 * ignored).
 */
export function parseRegister(path) {
  /** @type {RegisterEntry[]} */
  const entries = [];
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return entries;
  }
  const lines = content.split('\n').filter((line) => line.trim().startsWith('|'));
  for (const line of lines) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 4) continue;
    const [capability, title, howVerified, why] = cells;
    if (capability.toLowerCase() === 'capability') continue; // header row
    if (/^-+$/.test(capability.replace(/[: ]/g, ''))) continue; // separator row
    if (!capability || !title) continue;
    entries.push({ capability, title, howVerified, why });
  }
  return entries;
}

/**
 * Maximum bipartite matching between scenario occurrences and test titles that contain them
 * (case-insensitive substring), so a test title is claimed by at most one occurrence. Occurrences
 * left unmatched are then checked against the register, one register row per leftover occurrence
 * of that exact (capability, title) pair. Returns the scenarios that are neither.
 */
export function findMissingScenarios(scenarios, testTitles, register) {
  const lowerTestTitles = testTitles.map((t) => t.toLowerCase());
  const testMatch = new Array(testTitles.length).fill(-1);
  const scenarioMatch = new Array(scenarios.length).fill(-1);

  function tryAugment(si, visited) {
    const needle = scenarios[si].title.toLowerCase();
    for (let ti = 0; ti < lowerTestTitles.length; ti++) {
      if (visited[ti] || !lowerTestTitles[ti].includes(needle)) continue;
      visited[ti] = true;
      if (testMatch[ti] === -1 || tryAugment(testMatch[ti], visited)) {
        testMatch[ti] = si;
        scenarioMatch[si] = ti;
        return true;
      }
    }
    return false;
  }

  for (let si = 0; si < scenarios.length; si++) {
    tryAugment(si, new Array(testTitles.length).fill(false));
  }

  const unmatched = scenarios.filter((_, si) => scenarioMatch[si] === -1);

  const registerCounts = new Map();
  for (const entry of register) {
    const key = `${entry.capability}::${entry.title.toLowerCase()}`;
    registerCounts.set(key, (registerCounts.get(key) ?? 0) + 1);
  }

  const missing = [];
  for (const scenario of unmatched) {
    const key = `${scenario.capability}::${scenario.title.toLowerCase()}`;
    const available = registerCounts.get(key) ?? 0;
    if (available > 0) {
      registerCounts.set(key, available - 1);
    } else {
      missing.push(scenario);
    }
  }
  return missing;
}

function main() {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  const mainScenarios = parseScenarios(join(repoRoot, 'openspec/specs'));
  const activeChangeScenarios = parseActiveChangeScenarios(join(repoRoot, 'openspec/changes'));
  const scenarios = mergeScenarios(mainScenarios, activeChangeScenarios);
  const testTitles = parseTestTitles([
    join(repoRoot, 'apps/api/src'),
    join(repoRoot, 'apps/api/test'),
    join(repoRoot, 'apps/web/src'),
    join(repoRoot, 'e2e'),
    // `scripts/check-traceability.test.mjs` is itself the test for the journey-verification
    // spec's own "Missing test"/"Registered manual scenario" scenarios (see design.md's
    // "Traceability check").
    join(repoRoot, 'scripts'),
  ]);
  const register = parseRegister(join(repoRoot, 'openspec/manual-verification.md'));

  const missing = findMissingScenarios(scenarios, testTitles, register);

  console.log(`Traceability: ${scenarios.length} scenarios, ${testTitles.length} test titles scanned, ${register.length} manual entries.`);

  if (missing.length === 0) {
    console.log('All scenarios are covered by a test or the manual-verification register.');
    return;
  }

  const byCapability = new Map();
  for (const scenario of missing) {
    const list = byCapability.get(scenario.capability) ?? [];
    list.push(scenario.title);
    byCapability.set(scenario.capability, list);
  }

  console.error(`\n${missing.length} scenario(s) have no matching test and no register entry:\n`);
  for (const [capability, titles] of [...byCapability.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.error(`  ${capability}:`);
    for (const title of titles) {
      console.error(`    - ${title}`);
    }
  }
  process.exitCode = 1;
}

const isMainModule = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main();
}
