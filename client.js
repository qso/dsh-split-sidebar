window.__ModuleLoader__.load({
  id:'dsh-split-sidebar',
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
    .ss-icon,.ss-tab-action{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;padding:0;background:transparent;color:inherit;border:0;border-radius:6px;cursor:pointer}
    .ss-icon:hover,.ss-icon[aria-pressed=true],.ss-tab-action:hover{background:var(--dsw-alias-bg-layer-2,#8882)}
    .ss-icon:focus-visible,.ss-panel button:focus-visible{outline:2px solid Highlight}
    .ss-settings{padding:16px;display:grid;align-content:start;gap:14px}.ss-settings label{display:flex;align-items:center;gap:8px}
    .dl-media button,.dl-media label{cursor:pointer;color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l1,#8883);border-radius:6px;padding:4px 8px}
    .dl-media{display:flex;flex-direction:column;gap:8px;align-items:center;width:100%;padding:8px;box-sizing:border-box}
    .dl-media video,.dl-media audio{display:block;width:100%;max-height:65vh;object-fit:contain}.dl-media p{font-size:13px;margin:6px}
    [data-dl-split] [data-files-navigator-mode=overlay]{position:relative;inset:auto;align-self:stretch;flex:0 0 min(var(--files-navigator-width),42%);width:min(var(--files-navigator-width),42%);margin:4px;height:auto}
    `;
    function apply(ctx) {
      const defaults = {showDock:true, autoSplit:true, nativePlayer:true, streaming:true, ...window.__DSH_SPLIT_SIDEBAR__};
      const storageKey = 'dsh-split-sidebar.preferences.v1';
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem('dsh-dockline.preferences.v1') || '{}') || {}; } catch {}
      const settings = {split:typeof saved.split === 'boolean' ? saved.split : defaults.autoSplit,
        defaultTab:saved.defaultTab === 'files' || saved.terminal === false ? 'files' : 'terminal', preload:saved.preload === 'none' ? 'none' : 'metadata'};
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
      function Icon({name}) {
        const paths={split:'M3.5 5h17v14h-17z M4 13.5h16',settings:'M10.4 3h3.2l.6 2.3 2 .9 2.1-.9 1.6 2.8-1.7 1.6.2 2.3 1.5 1.7-1.6 2.8-2.2-.6-1.9 1.1-.6 2.3h-3.2l-.7-2.3-2-1-2.1.6L4 13.8l1.6-1.6.1-2.3L4 8.3l1.6-2.8 2.2.7 2-1z M14.5 11.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0'};
        return h('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,
          strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[name]}));
      }
      function Settings() {
        const split=useSetting('split'),preload=useSetting('preload'),first=useSetting('defaultTab');
        return h('section',{className:'ss-settings','aria-label':'分屏侧栏设置'},
          h('label',null,h('input',{type:'checkbox',checked:split,onChange:e=>set('split',e.target.checked)}),'文件树与预览并排'),
          h('label',null,h('input',{type:'checkbox',checked:preload==='metadata',onChange:e=>set('preload',e.target.checked?'metadata':'none')}),'打开媒体时预读播放信息'),
          h('label',null,'空面板首次打开',h('select',{value:first,onChange:e=>set('defaultTab',e.target.value)},
            h('option',{value:'terminal'},'终端'),h('option',{value:'files'},'已打开的文件'))));
      }
      const settingsKind='split-sidebar-settings';
      function SettingsGear() {
        return h('button',{className:'ss-icon',type:'button',title:'分屏侧栏设置','aria-label':'分屏侧栏设置',
          onClick:()=>ctx.sidebarRight.openTab(settingsKind)},h(Icon,{name:'settings'}));
      }
      const opened=new Set();
      let panelModule, workbench, disposed=false;
      function loadPanel() {
        panelModule ??= import(new URL('api/split-sidebar/panel.mjs',document.baseURI).href)
          .then(m=>{ if(disposed) throw Error('侧栏已关闭'); return workbench=m.createWorkbench(React,ctx,{Settings,Icon,settings}); })
          .catch(error=>{panelModule=undefined;throw error;});
        return panelModule;
      }
      ctx.effect(()=>()=>{disposed=true;workbench?.dispose();opened.clear();},'split-sidebar: panel lifetime');
      function HeaderButton({sessionId}) {
        const ref=React.useRef(null);
        const [open,setOpen]=React.useState(()=>opened.has(sessionId));
        const [panel,setPanel]=React.useState(()=>workbench);
        const [error,setError]=React.useState('');
        const [attempt,retry]=React.useReducer(n=>n+1,0);
        React.useEffect(()=>{
          if(!open || panel)return;
          let active=true;
          loadPanel().then(value=>{if(active)setPanel(value);}).catch(()=>{if(active)setError('分屏载入失败');});
          return ()=>{active=false;};
        },[open,panel,attempt]);
        function toggle() {
          if(open)opened.delete(sessionId);else opened.add(sessionId);
          setOpen(!open);setError('');
        }
        const shell=ref.current?.closest('[data-phase]');
        const button=h('button',{ref,type:'button',className:'ss-icon','data-split-sidebar-toggle':'',
          title:open?'收起下方分屏':'向下分屏','aria-label':open?'收起下方分屏':'向下分屏','aria-expanded':open,onClick:toggle},h(Icon,{name:'split'}));
        return h(React.Fragment,null,button,open&&shell&&createPortal(panel?
          h(panel.Panel,{session:sessionId,collapse:toggle}):
          h('div',{role:'status'},error?h('button',{onClick:()=>{setError('');retry();}},error+'，重试'):'正在打开分屏…'),shell));
      }
      function Header({sessionId}) { return h(HeaderButton,{key:sessionId,sessionId}); }
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
              const ticket = await fetch(new URL('api/split-sidebar-preview',document.baseURI), {
                method:'POST',credentials:'same-origin',redirect:'error',signal,
                headers:{'Content-Type':'application/json','X-Split-Sidebar-Preview':'1'},
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
            if (/^[a-f0-9]{64}$/.test(meta.playbackTicket || '')) {
              source = new URL('api/split-sidebar-media',document.baseURI);
              source.searchParams.set('ticket',meta.playbackTicket);
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
        return h('div',{className:'dl-media','data-split-sidebar-media':item.type},
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
        document.documentElement.dataset.dshSplitSidebar='0.2.0';
        return () => { style.remove(); delete document.documentElement.dataset.dshSplitSidebar; };
      }, 'split-sidebar: style');
      const add = (name, options, component) => ctx.effect(() => ctx.slots.inject(name, () =>
        ctx.slots.register({name,...options},component)), 'split-sidebar: '+name);
      if (defaults.showDock) add('conversation.session.header.utilities',{id:'split-sidebar.horizontal',order:10},Header);
      const settingsId='dsh-split-sidebar/settings';
      ctx.effect(()=>ctx.sidebarRightTabs.register({id:settingsId,kind:settingsKind,multiple:false,priority:'extension',title:()=>'分屏侧栏设置'}),
        'split-sidebar: settings tab');
      add('sidebar.right.pane.tab',{key:settingsId},Settings);
      add('sidebar.right.tab.guide.actions',{id:'split-sidebar.settings'},SettingsGear);
      add('sidebar.right.tab.document.actions',{id:'split-sidebar.settings'},SettingsGear);
      add('sidebar.right.tab.document.actions',{id:'split-sidebar.navigator'},Split);
      const id = 'dsh-split-sidebar/media', extensions = Object.keys(mime);
      ctx.effect(() => ctx.documentPreviews.register({id,extensions,binaryExtensions:extensions,priority:'extension',
        title:()=>'侧栏媒体播放器',loading:'renderer'}),'split-sidebar: media');
      add('sidebar.right.tab.document',{key:id},Media);
    }
    return {inject:['slots','sessions','sidebarRight','sidebarRightTabs','webTerminals','remote.terminal','documentPreviews','remote','remote.workspaceFiles','remote.session'],apply};
  },
});
