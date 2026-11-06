// Builds the browser bundle into public/js/live. The site has no build step of its own: the output is committed.
import { build } from 'esbuild';
await build({
  entryPoints: { client: 'client/index.ts', 'admin-player': 'client/admin-player.ts' },
  bundle: true, splitting: true, format: 'esm', target: 'es2021', minify: true,
  outdir: '../public/js/live', entryNames: '[name]', chunkNames: 'c-[hash]', legalComments: 'linked',
  logLevel: 'info',
});
