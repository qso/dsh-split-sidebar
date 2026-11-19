window.__ModuleLoader__.load({
  id:'dsh-dockline',
  factory(require) {
    const React = require('react');
    const {createPortal} = require('react-dom');
    const h = React.createElement;
    const mime = {mp4:'video/mp4', m4v:'video/mp4', mov:'video/quicktime', webm:'video/webm', mkv:'video/x-matroska',
      avi:'video/x-msvideo', ogv:'video/ogg', mp3:'audio/mpeg', m4a:'audio/mp4', aac:'audio/aac',
      wav:'audio/wav', ogg:'audio/ogg', flac:'audio/flac', opus:'audio/ogg'};
    function parse(address) {
      const match = /^dsh-resource:\/\/file\/session\/([^/]+)\/(.+?)(?:[?#].*)?$/.exec(address);
      if (!match) return;
      try { return {session:decodeURIComponent(match[1]), path:match[2].split('/').map(decodeURIComponent).join('/')}; } catch {}
    }
    const css = `
    .dl-dock{border-top:1px solid var(--dsw-alias-border-l2,#8885);font:inherit;color:var(--dsw-alias-label-primary,inherit)}
    .dl-bar,.dl-settings,.dl-tabs{display:flex;align-items:center;gap:4px;padding:3px 10px;flex-wrap:wrap}
    .dl-bar button,.dl-settings button,.dl-tabs button,.dl-media button,.dl-media label{color:inherit;background:transparent;border:0;border-radius:5px;padding:4px 9px;font:inherit;font-size:12px;cursor:pointer}
    .dl-dock button:hover,.dl-dock button[aria-expanded=true],.dl-media button:hover{background:var(--dsw-alias-bg-layer-2,#8882)}
    .dl-dock button:focus-visible,.dl-media button:focus-visible{outline:2px solid Highlight}
    .dl-bar button:last-child{margin-inline-start:auto}.dl-tabs,.dl-settings{border-bottom:1px solid var(--dsw-alias-border-l1,#8883);max-height:18vh;overflow:auto}
    .dl-tabs button{max-width:24em;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.dl-settings label{font-size:12px;padding:4px 8px}
    .dl-media{display:flex;flex-direction:column;gap:8px;align-items:center;width:100%;padding:8px;box-sizing:border-box}
    .dl-media video,.dl-media audio{display:block;width:100%;max-height:65vh;object-fit:contain}.dl-media p{font-size:13px;margin:6px}
    [data-dl-split] [data-files-navigator-mode=overlay]{position:relative;inset:auto;align-self:stretch;flex:0 0 min(var(--files-navigator-width),42%);width:min(var(--files-navigator-width),42%);margin:4px;height:auto}
    `;
    function apply(ctx) {
      const defaults = {showDock:true, autoSplit:true, nativePlayer:true, streaming:true, ...window.__DSH_DOCKLINE__};
      const storageKey = 'dsh-dockline.preferences.v1';
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
      const settings = {split:typeof saved.split === 'boolean' ? saved.split : defaults.autoSplit,
        terminal:saved.terminal !== false, preload:saved.preload === 'none' ? 'none' : 'metadata'};
      const notify = new EventTarget();
      function set(key, value) {
        settings[key] = value;
        try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch {}
        notify.dispatchEvent(new Event('change'));
      }
      function subscribe(fn) { notify.addEventListener('change',fn); return () => notify.removeEventListener('change',fn); }
      function useSetting(key) { return React.useSyncExternalStore(subscribe, () => settings[key]); }
      const splitPanes = new WeakSet();
      function Split() {
        const ref = React.useRef(null);
        const split = useSetting('split');
        React.useLayoutEffect(() => {
          const pane = ref.current?.closest('[data-dockkit-pane],[data-dockkit-float]');
          if (!pane) return;
          if (!split) {
            const toggle = pane.querySelector('[data-files-navigator-toggle]');
            if (splitPanes.delete(pane) && toggle?.getAttribute('aria-expanded') === 'true') toggle.click();
            pane.removeAttribute('data-dl-split'); return;
          }
          pane.setAttribute('data-dl-split','');
          function show() {
            const toggle = pane.querySelector('[data-files-navigator-toggle]');
            if (!toggle || splitPanes.has(pane) || pane.clientWidth < 400) return;
            splitPanes.add(pane);
            if (toggle.getAttribute('aria-expanded') === 'false') toggle.click();
          }
          // The host commits the toolbar and the navigator in the same frame.
          const frame = requestAnimationFrame(show);
          const observer = new ResizeObserver(show);
          observer.observe(pane);
          return () => { cancelAnimationFrame(frame); observer.disconnect(); pane.removeAttribute('data-dl-split'); };
        }, [split]);
        return h('span',{ref,hidden:true});
      }
      function FileTabs({session, close}) {
        const store = ctx.sidebarRight.openTabs;
        const rows = React.useSyncExternalStore(fn => store.subscribe(fn), () => store.getSnapshot())
          .filter(tab => tab.sessionId === session && tab.contentId.startsWith('dsh-resource://file/'));
        return h('div',{className:'dl-tabs'},rows.length ? rows.map(tab => {
          const path = parse(tab.contentId)?.path ?? tab.contentId;
          return h('button',{key:tab.tabId,title:path,onClick:() => {
            if (!ctx.sidebarRight.isExpanded()) ctx.sidebarRight.toggleExpanded();
            ctx.sidebarRight.focus(tab.tabId); close();
          }},path.split('/').at(-1));
        }) : h('small',null,'当前会话还没有打开文件'));
      }
      function Dock() {
        const [mount,setMount] = React.useState(null);
        React.useLayoutEffect(() => {setMount(document.querySelector('[data-shell-bottom]'));},[]);
        const [drawer,setDrawer] = React.useState('');
        const panels = ctx.layout.panelInfo;
        const inSession = React.useSyncExternalStore(fn => panels.subscribe(fn), () => panels.getSnapshot().activePanelId === null);
        const sessions = ctx.sessions.list;
        const current = React.useSyncExternalStore(fn => sessions.subscribe(fn), () => {
          const {ids,byId} = sessions.getSnapshot();
          return ids.find(id => byId[id]?.retainedBy.mainView > 0) ?? '';
        });
        const split = useSetting('split'), terminal = useSetting('terminal'), preload = useSetting('preload');
        React.useEffect(() => {setDrawer('');},[current]);
        const button = (label,run,props={}) => h('button',{type:'button',onClick:run,...props},label);
        const toggle = key => setDrawer(old => old === key ? '' : key);
        function open(kind) {
          if (!ctx.sidebarRight.commandTarget(null)) return;
          const tab = ctx.sidebarRight.openTabs.getSnapshot().find(t => t.sessionId === current && t.kind === kind);
          if (tab) { if (!ctx.sidebarRight.isExpanded()) ctx.sidebarRight.toggleExpanded(); ctx.sidebarRight.focus(tab.tabId); }
          else ctx.sidebarRight.openTab(kind);
          setDrawer('');
        }
        if (!mount || !current || !inSession) return null;
        return createPortal(h('div',{className:'dl-dock',onKeyDown:e => {if(e.key === 'Escape') setDrawer('');}},
          drawer === 'files' && h(FileTabs,{session:current, close:() => setDrawer('')}),
          drawer === 'settings' && h('div',{className:'dl-settings'},
            ...[['文件树与预览并排','split',split],['显示终端入口','terminal',terminal],['预读媒体信息','preload',preload === 'metadata']]
              .map(([label,key,checked]) => h('label',{key},h('input',{type:'checkbox',checked,onChange:e => set(key,key === 'preload' ? (e.target.checked?'metadata':'none') : e.target.checked)}),label))),
          h('nav',{className:'dl-bar','aria-label':'Dockline 工作台'},
            button('文件树',() => open('files')),button('已打开文件',() => toggle('files'),{'aria-expanded':drawer==='files'}),
            terminal && button('终端',() => open('terminal')),
            button('侧栏设置',() => toggle('settings'),{'aria-expanded':drawer==='settings'}))),mount);
      }
      function Media({content,resourceAddress}) {
        const state = React.useRef(content);
        state.current = content;
        const revision = content.revision;
        const preload = useSetting('preload');
        const [result,setResult] = React.useState(null);
        const [message,setMessage] = React.useState('');
        const [alternate,setAlternate] = React.useState(null);
        const [broken,setBroken] = React.useState(false);
        const life = React.useRef(null);
        React.useEffect(() => {
          const controller = new AbortController();
          life.current = controller;
          const signal = controller.signal;
          setResult(null); setMessage(''); setAlternate(null); setBroken(false);
          async function load() {
            const file = parse(resourceAddress);
            if (!file) throw Error('此文件地址无法用于媒体预览');
            let meta;
            if (defaults.streaming) {
              const ticket = await fetch(new URL('api/dockline-preview',document.baseURI), {
                method:'POST',credentials:'same-origin',redirect:'error',signal,
                headers:{'Content-Type':'application/json','X-Dockline-Preview':'1'},
                body:JSON.stringify(file),
              });
              if (ticket.ok) meta = await ticket.json();
            }
            if (!meta) {
              const response = await ctx.remote.workspaceFiles.readBytes(file.session,file.path,{range:{offset:0,length:1}},signal);
              if (!response.ok) throw Error('无法读取媒体文件');
              meta = response.value;
            }
            const type = mime[file.path.split('.').at(-1).toLowerCase()];
            let source;
            if (/^[a-f0-9]{64}$/.test(meta.docklineTicket || '')) {
              source = new URL('api/dockline-media',document.baseURI);
              source.searchParams.set('ticket',meta.docklineTicket);
            } else if (meta.bytes <= defaults.smallLimit) {
              source = new URL('api/file',document.baseURI);
              source.search = new URLSearchParams({path:meta.absolutePath,v:meta.version});
            }
            if (signal.aborted) return;
            setResult({address:resourceAddress, revision, meta, type, source:source?.href});
            state.current.loaded(meta.version);
          }
          load().catch(error => {if (!signal.aborted) { setMessage(error.message); state.current.failed(); }});
          return () => controller.abort();
        },[resourceAddress,revision]);
        React.useEffect(() => () => {if(alternate) URL.revokeObjectURL(alternate);},[alternate]);
        const item = result?.address === resourceAddress && result.revision === revision ? result : null;
        async function openNative() {
          const signal = life.current?.signal;
          const path = item?.meta.absolutePath;
          if (!path || !signal) return;
          try {
            const apps = await ctx.remote.session.workspacePathApplications({path},signal);
            if (signal.aborted) return;
            if (!apps.ok) throw Error();
            const iina = apps.value.find(app => /^IINA(?:\.app)?$/i.test(app.name));
            const opened = await ctx.remote.session.openWorkspacePath({path,...iina && {application:iina.id}},signal);
            if (!opened.ok) throw Error();
          } catch { if (!signal.aborted) setMessage('系统播放器未能打开文件'); }
        }
        if (!item) return h('p',{role:'status'},message || '正在读取媒体信息…');
        const source = alternate ?? item.source;
        return h('div',{className:'dl-media','data-dockline-media':item.type},
          source && !broken && h(item.type.startsWith('video/')?'video':'audio',
            {key:source,src:source,controls:true,playsInline:true,preload,onError:() => setBroken(true)}),
          (!source || broken) && h('p',{role:'status'},'当前文件需要其他播放方式。'),
          defaults.nativePlayer && h('button',{type:'button',onClick:openNative},'在本机播放器打开（优先 IINA）'),
          (!source || broken) && h('label',null,'选择本地媒体在侧栏播放',h('input',{type:'file',accept:'video/*,audio/*',onChange:e => {
            const file = e.target.files[0];
            if (file) {setBroken(false);setAlternate(URL.createObjectURL(file));}
          }})), message && h('p',{role:'status'},message));
      }
      ctx.effect(() => {
        const style = document.createElement('style');
        style.textContent = css; document.head.append(style);
        document.documentElement.dataset.dshDockline='0.1.0';
        return () => { style.remove(); delete document.documentElement.dataset.dshDockline; };
      }, 'dockline: style');
      const add = (name, options, component) => ctx.effect(() => ctx.slots.inject(name, () =>
        ctx.slots.register({name,...options},component)), 'dockline: '+name);
      if (defaults.showDock) add('shell.overlay',{id:'dockline.bar'},Dock);
      add('sidebar.right.tab.document.actions',{id:'dockline.navigator'},Split);
      const id = 'dsh-dockline/media', extensions = Object.keys(mime);
      ctx.effect(() => ctx.documentPreviews.register({id,extensions,binaryExtensions:extensions,priority:'extension',
        title:()=>'Dockline 媒体播放器',loading:'renderer'}),'dockline: media');
      add('sidebar.right.tab.document',{key:id},Media);
    }
    return {inject:['slots','sessions','layout','sidebarRight','documentPreviews','remote','remote.workspaceFiles','remote.session'],apply};
  },
});
