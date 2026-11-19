import {registerAssets} from './assets.js';
import z from '@deepseek-ai/schemastery';
export const Config = z.object({
  chunkKiB: z.number().step(1).min(16).max(1024).default(256),
  showDock: z.boolean().default(true),
  autoSplit: z.boolean().default(true),
  streaming: z.boolean().default(true),
  nativePlayer: z.boolean().default(true),
});
// The desktop gateway authenticates both the ordinary read and the media
// request. Only a successful owner read can mint a short-lived playback URL.
import { randomBytes } from 'node:crypto';
import { byteRange } from './media-ranges.js';

export const inject = ['connection', 'workspaceFiles', 'attachments', 'typert'];
const media = {
  mp4:'video/mp4', mov:'video/quicktime', m4v:'video/mp4', webm:'video/webm', mkv:'video/x-matroska',
  mp3:'audio/mpeg', m4a:'audio/mp4', aac:'audio/aac', wav:'audio/wav', ogg:'audio/ogg',
  opus:'audio/ogg', flac:'audio/flac', ogv:'video/ogg', avi:'video/x-msvideo',
};
export function apply(ctx, options = {}) {
  registerAssets(ctx);
  const files = ctx.workspaceFiles;
  const chunkKiB = Number.isInteger(options.chunkKiB) ? options.chunkKiB : 256;
  const chunk = Math.max(1, Math.min(files.config.maxBytes, Math.max(16, Math.min(chunkKiB, 1024)) * 1024));
  const prefs = {
    showDock: options.showDock !== false, autoSplit: options.autoSplit !== false,
    streaming: options.streaming !== false, nativePlayer: options.nativePlayer !== false,
    smallLimit: Math.min(files.config.maxFileBytes, ctx.attachments.imageLimits.maxImageBytes),
  };
  ctx.on('webserver/index-inject', table => table.push({kind:'global', name:'__DSH_SPLIT_SIDEBAR__', value:prefs}));
  if (!prefs.streaming) return;
  const tickets = new Map();
  const ttl = 15 * 60 * 1000;
  const lookup = id => ctx.typert.lookups.get('workspaceFileScope')?.resolve(id);
  const denied = status => new Response(null, {status, headers:{'Cache-Control':'private, no-store'}});
  ctx.effect(() => () => tickets.clear(), 'split-sidebar: release playback tickets');
  // DSH grants exact fetch routes to the authenticated owner peer only.
  ctx.effect(() => ctx.connection.fetch.register({
    path:'/api/split-sidebar-preview', methods:['POST'], requestBody:'buffered',
    async fetch(request) {
      if (request.headers.get('X-Split-Sidebar-Preview') !== '1' ||
          request.headers.get('content-type') !== 'application/json') return denied(403);
      try {
        const {session, path} = await request.json();
        if (typeof session !== 'string' || !session || session.length > 256 ||
            typeof path !== 'string' || !path || path.length > 16384) return denied(400);
        const scope = await lookup(session);
        if (!scope) return denied(404);
        const mime = media[path.split('.').at(-1).toLowerCase()];
        if (typeof mime !== 'string') return denied(415);
        const meta = await files.readBytes(scope,path,{range:{offset:0,length:1}},request.signal);
        if (!Number.isSafeInteger(meta.bytes) || meta.bytes < 0) return denied(422);
        const item = {scope, path:meta.absolutePath, size:meta.bytes, version:meta.version, mime, expires:Date.now()+ttl};
        for (const [key, old] of tickets) if (Date.now() > old.expires) tickets.delete(key);
        if (tickets.size >= 32) tickets.delete(tickets.keys().next().value);
        const ticket = randomBytes(32).toString('hex');
        tickets.set(ticket, item);
        return Response.json({playbackTicket:ticket, absolutePath:meta.absolutePath, bytes:meta.bytes, version:meta.version},
          {headers:{'Cache-Control':'private, no-store'}});
      } catch { return denied(404); }
    },
  }), 'split-sidebar: open media');
  ctx.effect(() => ctx.connection.fetch.register({
    path:'/api/split-sidebar-media', methods:['GET','HEAD'], requestBody:'buffered',
    async fetch(request) {
      const key = new URL(request.url).searchParams.get('ticket');
      const item = tickets.get(key);
      if (!item || Date.now() > item.expires) { tickets.delete(key); return denied(404); }
      const scope = await lookup(item.scope.sessionId);
      if (!scope || scope.workspaceRoot !== item.scope.workspaceRoot) { tickets.delete(key); return denied(404); }
      const range = byteRange(request.headers.get('range'), item.size);
      if (!range) return new Response(null, {status:416,headers:{'Content-Range':'bytes */'+item.size,'Cache-Control':'no-store'}});
      const {start,end,status} = range;
      const headers = {'Accept-Ranges':'bytes', 'Content-Type':item.mime, 'Content-Length':String(end-start+1),
        'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"sandbox; default-src 'none'"};
      if (status === 206) headers['Content-Range'] = 'bytes '+start+'-'+end+'/'+item.size;
      item.expires = Date.now()+ttl;
      if (request.method === 'HEAD' || !item.size) return new Response(null, {status,headers});
      let offset = start;
      const life = new AbortController();
      const signal = AbortSignal.any([life.signal, request.signal]);
      return new Response(new ReadableStream({
        async pull(controller) {
          try {
            if (!tickets.has(key)) throw Error('Preview closed');
            const length = Math.min(end-offset+1, chunk);
            const data = await files.readBytes(scope, item.path, {range:{offset,length}}, signal);
            if (data.version !== item.version || data.offset !== offset || data.data.length !== length) throw Error('Media changed');
            item.expires = Date.now()+ttl;
            offset += length;
            controller.enqueue(data.data);
            if (offset > end) controller.close();
          } catch (error) { controller.error(error); }
        },
        cancel() { life.abort(); },
      }), {headers,status});
    },
  }), 'split-sidebar: media playback');
}
