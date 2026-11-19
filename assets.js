import {readFile} from 'node:fs/promises';
import {readGhostty} from './ghostty.js';

export function registerAssets(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({
    path:'/api/split-sidebar/panel.mjs', methods:['GET'], requestBody:'buffered',
    async fetch() {
      return new Response(await readFile(new URL('./panel.js', import.meta.url)), {headers:{
        'Content-Type':'text/javascript', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff',
      }});
    },
  }), 'split-sidebar: terminal panel');
  // DSH grants these exact fetch routes to the authenticated owner. A button
  // requests the import once; no subprocess or file watcher runs on startup.
  ctx.effect(() => ctx.connection.fetch.register({
    path:'/api/split-sidebar/ghostty', methods:['POST'], requestBody:'buffered',
    async fetch(request) {
      const headers = {'Cache-Control':'no-store'};
      if (request.headers.get('X-Split-Sidebar-Import') !== 'appearance') return new Response(null,{status:403,headers});
      try {return Response.json(await readGhostty(), {headers});}
      catch (error) {return Response.json({error:error.message}, {status:422,headers});}
    },
  }), 'split-sidebar: import terminal appearance');
}
