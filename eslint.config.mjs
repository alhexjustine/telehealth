import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'docs/.vitepress/cache/**',
      'docs/.vitepress/dist/**',
      'apps/api/src/generated/**',
      'packages/api-client/src/schema.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'apps/api/test/**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Plain Node ESM scripts, not part of any package's tsconfig project (they run directly with
    // `node`, never compiled) — same reason `apps/api/scripts` compiles under `apps/api`'s own
    // tsconfig but these repo-root scripts have none of their own. `projectService: false`
    // (rather than just `disableTypeChecked`'s rule changes) is what's needed here: unlike
    // `**/*.spec.ts` above — which IS inside `apps/api/tsconfig.json`'s `src/**/*.ts` glob, so
    // `disableTypeChecked` alone suffices to skip only the type-checked *rules* — these `.mjs`
    // files aren't covered by any tsconfig at all, so project-aware parsing itself must be turned
    // off or every file fails to parse ("was not found by the project service").
    files: ['scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: { projectService: false, project: false },
      globals: { ...globals.node },
    },
  },
);
