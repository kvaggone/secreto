import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  // @secreto/lib and @secreto/crypto are workspace-only packages that are
  // never published to npm on their own, so bundle their code directly into
  // the CLI output. Everything declared in `dependencies` (commander, chalk,
  // and lib's real npm deps) stays external and is installed normally.
  noExternal: ['@secreto/lib', '@secreto/crypto'],
});
