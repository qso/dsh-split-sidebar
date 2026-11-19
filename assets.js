// Exact owner-only DSH routes for immutable, explicitly named frontend assets.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require = createRequire(import.meta.url);
export function registerAssets(ctx) {
  const emulator = dirname(require.resolve('@xterm/xterm'));
  const fit = dirname(require.resolve('@xterm/addon-fit'));
  const assets = {
    'panel.mjs':new URL('./panel.js',import.meta.url),
    'terminal.mjs':new URL('./terminal.js',import.meta.url),
    'xterm.mjs':join(emulator,'xterm.mjs'),
    'fit.mjs':join(fit,'addon-fit.mjs'),
    'xterm.css':join(emulator,'../css/xterm.css'),
  };
  for (const [name,source] of Object.entries(assets)) {
    let body;
    ctx.effect(() => ctx.connection.fetch.register({
      path:'/api/split-sidebar/'+name, methods:['GET'],requestBody:'buffered',
      async fetch() {
        body ??= await readFile(source);
        return new Response(body,{headers:{'Content-Type':name.endsWith('.css')?'text/css':'text/javascript',
          'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
      },
    }),'split-sidebar: '+name);
  }
}
