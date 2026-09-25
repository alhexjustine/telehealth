// `jest-axe` ships no types (its own `package.json` has no `types` field and
// `@types/jest-axe` pulls in `@types/jest`, which we don't want alongside
// Vitest's globals). This is the minimal ambient shape this app actually
// uses — see `routes/public/accessibility.test.tsx`.
declare module 'jest-axe' {
  import type AxeCore from 'axe-core';

  export function axe(
    html: Element | Document | string,
    options?: AxeCore.RunOptions,
  ): Promise<AxeCore.AxeResults>;
}
