import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  findMissingScenarios,
  parseScenarios,
  parseTestTitles,
  parseRegister,
  parseActiveChangeScenarios,
  mergeScenarios,
} from './check-traceability.mjs';

describe('findMissingScenarios', () => {
  test('Missing test', () => {
    const scenarios = [{ capability: 'widgets', title: 'Widget spins' }];
    const missing = findMissingScenarios(scenarios, [], []);
    assert.deepEqual(missing, scenarios);
  });

  test('a matching test title covers the scenario', () => {
    const scenarios = [{ capability: 'widgets', title: 'Widget spins' }];
    const missing = findMissingScenarios(scenarios, ["Widget spins when clicked"], []);
    assert.deepEqual(missing, []);
  });

  test('Registered manual scenario', () => {
    const scenarios = [{ capability: 'widgets', title: 'Widget spins' }];
    const register = [{ capability: 'widgets', title: 'Widget spins', howVerified: 'manual click-through', why: 'flaky in CI' }];
    const missing = findMissingScenarios(scenarios, [], register);
    assert.deepEqual(missing, []);
  });

  test('a register entry for a different capability does not cover the scenario', () => {
    const scenarios = [{ capability: 'widgets', title: 'Widget spins' }];
    const register = [{ capability: 'gadgets', title: 'Widget spins', howVerified: 'x', why: 'y' }];
    const missing = findMissingScenarios(scenarios, [], register);
    assert.deepEqual(missing, scenarios);
  });

  test('repeated scenario titles within one capability each need their own match (qualifier rule)', () => {
    const scenarios = [
      { capability: 'availability', title: 'Signed-out denied' },
      { capability: 'availability', title: 'Signed-out denied' },
    ];
    // Only one distinct test title contains the phrase — the second occurrence stays missing.
    const missing = findMissingScenarios(scenarios, ['Signed-out denied (schedule)'], []);
    assert.equal(missing.length, 1);

    const bothCovered = findMissingScenarios(
      scenarios,
      ['Signed-out denied (schedule)', 'Signed-out denied (slots)'],
      [],
    );
    assert.deepEqual(bothCovered, []);
  });

  test('the same scenario title across different capabilities is matched independently', () => {
    const scenarios = [
      { capability: 'appointments', title: 'Signed-out denied' },
      { capability: 'notifications', title: 'Signed-out denied' },
    ];
    const missing = findMissingScenarios(
      scenarios,
      ['Signed-out denied (appointments)', 'Signed-out denied (notifications)'],
      [],
    );
    assert.deepEqual(missing, []);
  });

  test('a test title only claims one scenario occurrence, even if it could match several', () => {
    const scenarios = [
      { capability: 'a', title: 'Empty list' },
      { capability: 'b', title: 'Empty list' },
    ];
    // Only one test title exists; it can satisfy at most one of the two occurrences.
    const missing = findMissingScenarios(scenarios, ['Empty list'], []);
    assert.equal(missing.length, 1);
  });

  test('matching is case-insensitive', () => {
    const scenarios = [{ capability: 'widgets', title: 'Widget Spins' }];
    const missing = findMissingScenarios(scenarios, ['widget spins on load'], []);
    assert.deepEqual(missing, []);
  });
});

describe('parseScenarios', () => {
  test('parses #### Scenario headings grouped by capability directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'traceability-specs-'));
    try {
      mkdirSync(join(dir, 'widgets'));
      writeFileSync(
        join(dir, 'widgets', 'spec.md'),
        '# widgets\n\n### Requirement: Spinning\n\n#### Scenario: Widget spins\n- WHEN x\n- THEN y\n\n#### Scenario: Widget stops\n- WHEN x\n- THEN y\n',
      );
      const scenarios = parseScenarios(dir);
      assert.deepEqual(scenarios, [
        { capability: 'widgets', title: 'Widget spins' },
        { capability: 'widgets', title: 'Widget stops' },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns an empty list for a missing directory', () => {
    assert.deepEqual(parseScenarios(join(tmpdir(), 'does-not-exist-xyz')), []);
  });
});

describe('parseTestTitles', () => {
  test('collects it/test/describe string-literal titles and unescapes them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'traceability-tests-'));
    try {
      writeFileSync(
        join(dir, 'widget.spec.ts'),
        [
          "describe('Widget', () => {",
          "  it('Widget spins', () => {});",
          '  test("Widget stops", () => {});',
          "  it('Subscribing to someone else\\'s workspace', () => {});",
          '  it(`has a ${dynamic} title`, () => {});',
          '});',
        ].join('\n'),
      );
      const titles = parseTestTitles([dir]);
      assert.deepEqual(
        titles.sort(),
        ['Subscribing to someone else\'s workspace', 'Widget', 'Widget spins', 'Widget stops'].sort(),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('ignores non-source files and returns an empty list for a missing directory', () => {
    assert.deepEqual(parseTestTitles([join(tmpdir(), 'does-not-exist-xyz')]), []);
  });
});

describe('parseActiveChangeScenarios', () => {
  test('scans every non-archived change dir, skipping "archive"', () => {
    const dir = mkdtempSync(join(tmpdir(), 'traceability-changes-'));
    try {
      mkdirSync(join(dir, 'my-change', 'specs', 'widgets'), { recursive: true });
      writeFileSync(
        join(dir, 'my-change', 'specs', 'widgets', 'spec.md'),
        '#### Scenario: New widget behavior\n- WHEN x\n- THEN y\n',
      );
      mkdirSync(join(dir, 'archive', 'old-change', 'specs', 'widgets'), { recursive: true });
      writeFileSync(
        join(dir, 'archive', 'old-change', 'specs', 'widgets', 'spec.md'),
        '#### Scenario: Already archived, should not be scanned\n- WHEN x\n- THEN y\n',
      );
      const scenarios = parseActiveChangeScenarios(dir);
      assert.deepEqual(scenarios, [{ capability: 'widgets', title: 'New widget behavior' }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns an empty list when there is no changes directory', () => {
    assert.deepEqual(parseActiveChangeScenarios(join(tmpdir(), 'does-not-exist-xyz')), []);
  });
});

describe('mergeScenarios', () => {
  test('adds a new capability from the change untouched', () => {
    const main = [];
    const change = [{ capability: 'demo-data', title: 'Doctor search is populated' }];
    assert.deepEqual(mergeScenarios(main, change), change);
  });

  test('does not duplicate a scenario the delta restates verbatim (a MODIFIED requirement)', () => {
    const main = [
      { capability: 'local-deployment', title: 'Fresh start with default configuration' },
      { capability: 'local-deployment', title: 'Data survives a restart' },
    ];
    const change = [
      { capability: 'local-deployment', title: 'Fresh start with default configuration' },
      { capability: 'local-deployment', title: 'Data survives a restart' },
      { capability: 'local-deployment', title: 'Ready to explore' },
    ];
    const merged = mergeScenarios(main, change);
    assert.equal(merged.length, 3);
    assert.ok(merged.some((s) => s.title === 'Ready to explore'));
  });
});

describe('parseRegister', () => {
  test('parses a Markdown table, skipping header and separator rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'traceability-register-'));
    try {
      const path = join(dir, 'manual-verification.md');
      writeFileSync(
        path,
        [
          '# Manual verification register',
          '',
          '| Capability | Scenario | How verified | Why not automated |',
          '| --- | --- | --- | --- |',
          '| widgets | Widget spins | Clicked through manually | Requires physical hardware |',
        ].join('\n'),
      );
      const entries = parseRegister(path);
      assert.deepEqual(entries, [
        {
          capability: 'widgets',
          title: 'Widget spins',
          howVerified: 'Clicked through manually',
          why: 'Requires physical hardware',
        },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns an empty list when the register file does not exist', () => {
    assert.deepEqual(parseRegister(join(tmpdir(), 'does-not-exist-xyz.md')), []);
  });
});
