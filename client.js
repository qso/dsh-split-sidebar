window.__ModuleLoader__.load({
  id:'dsh-split-sidebar',
  factory(require) {
    const React = require('react');
    const {createPortal} = require('react-dom');
    const ui = require('@deepseek-ai/dsh-client-ui-primitives');
    const {Button, Tooltip, IconPanelLeftOutlineRegular, MenuItemButton, Input, Switch} = ui;
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
    @font-face{font-family:"DSH Prompt Separators";src:local("Symbols Nerd Font Mono"),local("SymbolsNerdFontMono-Regular"),url("data:font/woff2;base64,d09GMgABAAAAAAGsAAoAAAAABAwAAAFhAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAANAqBCG4BNgIkAwwLDAAEIAWCYgdMGzUDAJ4FTlkWp+YIMoeNQzwKP/JJGQ8fa+39c0kGSaerTNdQITQqhKIpWugMJe6QrJ3k/b+bd0CBfpC2hpO753PUpgIgcRRHp27yfxMsoEldlKe0FoVdGKUBraWSwGtt0ijydJvMUjsKRJWC4u+tsjGLl7ycwbQAB4uS1+QjCymWwhfAFuUZZNELQ8U5i8jlg+QjTc/S6PGFc4QB5EEFOXSwBMgBwtLZQly8VizC1vxKZ9hYmEqoRWcjWThJmL5b2A8Cwf+kPC2GeSmb/eH73iAEpFTMsovIyoDg7mnMmNIA/MhTPgnkFQTIMGtKbjAIfQTIKOrHbM7IEKFgYEtW5MrCmquYzWi4Y3O2PawoWPd5SlY4u498vnCpT37z97if76rq6wNgC4VOlH8ZGskKzu4jny+41Ce/+Xvcz6btl/jeedAi6kWlrHp3LNYCQJ7IRDZykS/e7n5qjhufaIku6AEAAAA=") format("woff2");unicode-range:U+E0B0-E0B3;font-display:swap}
    .ss-toggle{width:28px;padding:0!important;flex:none;color:var(--dsw-alias-label-secondary)}
    .ss-toggle svg{width:15px;height:15px;transform:rotate(90deg) scaleX(-1)}
    .ss-settings{color:var(--dsw-alias-label-primary);width:100%;box-sizing:border-box;min-width:0}
    .ss-settings-side{padding:8px 18px;overflow:auto}
    .ss-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);flex-wrap:wrap}
    .ss-row section{flex:1 1 9em;min-width:0}.ss-row strong{font-size:14px;font-weight:500;line-height:22px}
    .ss-row p,.ss-settings [role=status]{margin:3px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
    .ss-row input{max-width:100%;box-sizing:border-box}.ss-row .ss-family{width:min(210px,100%)}.ss-row .ss-size{width:72px}
    .ss-motion{min-height:0;max-height:65%;flex:0 0 0px;position:relative;overflow:clip;transition:flex-basis var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
    .ss-motion[data-open=true]{flex-basis:min(var(--ss-height,240px),var(--ss-limit,65%))}
    .ss-motion>.ss-panel{height:min(var(--ss-height,240px),var(--ss-limit,100vh));transform:translateY(100%);transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
    .ss-motion[data-open=true]>.ss-panel{transform:translateY(0)}
    .ss-motion[data-resizing]{transition:none}
    @starting-style{.ss-motion[data-open=true]{flex-basis:0px}.ss-motion[data-open=true]>.ss-panel{transform:translateY(100%)}}
    @media(prefers-reduced-motion:reduce){.ss-motion,.ss-motion>.ss-panel{transition:none}}
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
        appearance:saved.appearance || null, preload:saved.preload === 'none' ? 'none' : 'metadata'};
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
      const watchTheme = listener => ctx.on('theme/change', listener);
      const getTheme = () => ctx.theme.getTheme();
      const useTheme = () => React.useSyncExternalStore(watchTheme,getTheme);
      const settingsKind='split-sidebar-settings';
      // CSS font-family can name a missing font. Explicitly offer an actual
      // Powerline face ahead of generic system fallback for the four dividers.
      // Apply it to painted cells only. The host still measures the text font.
      ctx.effect(() => {
        const style=document.createElement('style');
        document.head.append(style);
        const sheet=style.sheet;
        const index=sheet.insertRule('[data-sidebar-terminal] .xterm-rows > div {}');
        const rule=sheet.cssRules[index].style;
        const fallback='"DSH Prompt Separators"';
        let last;
        function update(){
          const preference=getTheme().fontFamilies.terminal;
          if(preference===last)return;
          last=preference;
          const families=preference.split(',').map(name=>name.trim()).filter(Boolean);
          const generic=families.findIndex(name=>!name.startsWith('"'));
          families.splice(generic<0?families.length:generic,0,fallback);
          rule.fontFamily=[...families,'ui-monospace','SFMono-Regular','Menlo','Consolas','monospace'].join(', ');
        }
        update();
        const off=watchTheme(update);
        return ()=>{off();style.remove();};
      },'split-sidebar: terminal glyph fallback');
      function applyColors(style, profile) {
        const valid = color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
        const root = '[data-sidebar-terminal]';
        const bg = profile?.background, fg = profile?.foreground;
        const rules = [];
        if (valid(bg)) rules.push(root+'{--dsw-alias-bg-base:'+bg+';background:'+bg+'}',root+' .xterm-scrollable-element{background-color:'+bg+'!important}');
        if (valid(fg)) rules.push(root+'{--dsw-alias-label-primary:'+fg+'}',root+' .xterm-rows{color:'+fg+'}');
        const pad = (pair,i) => Array.isArray(pair) && Number.isInteger(pair[i]) ? Math.max(0,Math.min(64,pair[i]))+'px' : '8px';
        if (profile?.paddingX || profile?.paddingY) {
          rules.push(root+'{padding-top:0;--ss-screen-top:'+pad(profile.paddingY,0)+'}');
          rules.push(root+' div:has(> .xterm){padding:'+[
            pad(profile.paddingY,0),pad(profile.paddingX,1),pad(profile.paddingY,1),pad(profile.paddingX,0)].join(' ')+'}');
        }
        style.textContent = rules.join('\n');
      }
      ctx.effect(() => {
        const style = document.createElement('style'); document.head.append(style);
        const update = () => applyColors(style,settings.appearance);
        update(); const off = subscribe(update);
        return () => {off(); style.remove();};
      },'split-sidebar: shared terminal appearance');
      function Settings({inSidebar=false}) {
        const theme=useTheme(), split=useSetting('split'), colors=useSetting('appearance');
        const [status,setStatus]=React.useState(''), [busy,setBusy]=React.useState(false);
        const family=theme.fontFamilies.terminal, size=theme.fontSizes.terminal;
        async function importAppearance(){
          setBusy(true);setStatus('');
          try {
            const response=await fetch(new URL('api/split-sidebar/ghostty',document.baseURI),{method:'POST',
              credentials:'same-origin',redirect:'error',headers:{'X-Split-Sidebar-Import':'appearance'}});
            if (!response.ok) throw Error('无法读取本机 Ghostty 配置。请确认已安装 Ghostty。');
            const profile=await response.json();
            set('appearance',profile);
            ctx.theme.setFontFamily('terminal',profile.fontFamily || '');
            if (Number.isInteger(profile.fontSize)) ctx.theme.setFontSize('terminal',profile.fontSize);
            setStatus('已应用到底部和右侧终端。');
          } catch(error) {setStatus(error.message);} finally {setBusy(false);}
        }
        const row=(id,title,description,control)=>h('div',{className:'ss-row',key:id},
          h('section',null,h('strong',null,title),description&&h('p',null,description)), control);
        const field=(key,props,save)=>h(Input,{key,defaultValue:key,size:'sm',...props,
          onBlur:e=>save(e.currentTarget),onKeyDown:e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing)e.currentTarget.blur();}});
        return h('div',{className:'ss-settings'+(inSidebar?' ss-settings-side':''),'aria-label':'分屏侧栏设置'},
          row('family','终端字体','底部与右侧终端共用。',field(family,{'aria-label':'终端字体',className:'ss-family',maxLength:200,
            placeholder:'系统等宽字体',spellCheck:false},el=>{ctx.theme.setFontFamily('terminal',el.value);el.value=getTheme().fontFamilies.terminal;})),
          row('size','终端字号','10–20 像素',field(size,{'aria-label':'终端字号',className:'ss-size',type:'number',min:10,max:20,step:1},
            el=>{const n=el.valueAsNumber;if(Number.isInteger(n)&&n>=10&&n<=20)ctx.theme.setFontSize('terminal',n);el.value=String(getTheme().fontSizes.terminal);})),
          row('import','Ghostty 外观','导入字体、字号、前景色、背景色和内边距。',
            h(Button,{size:'sm',disabled:busy,onClick:importAppearance},busy?'正在读取…':'从 Ghostty 导入')),
          colors&&row('reset','终端配色与间距','恢复为当前 DSH 主题。',h(Button,{size:'sm',onClick:()=>{set('appearance',null);setStatus('已恢复 DSH 配色和间距。');}},'恢复默认')),
          status&&h('p',{role:'status'},status),
          row('split','文件双列','右侧空间足够时，并排显示目录树与文件预览。',h(Switch,{checked:split,label:'文件双列',onChange:v=>set('split',v)})));
      }
      function SettingsRow({onDismiss}) {
        return h(MenuItemButton,{separatorBefore:true,onSelect:()=>{onDismiss();ctx.sidebarRight.openTab(settingsKind);}},'设置');
      }
      const opened=new Set();
      let panelModule, workbench, disposed=false;
      function loadPanel() {
        panelModule ??= import(new URL('api/split-sidebar/panel.mjs?v=0.3.1',document.baseURI).href)
          .then(m=>{ if(disposed) throw Error('侧栏已关闭'); return workbench=m.createWorkbench(React,ctx,{ui,useTheme}); })
          .catch(error=>{panelModule=undefined;throw error;});
        return panelModule;
      }
      ctx.effect(()=>()=>{disposed=true;workbench?.dispose();opened.clear();},'split-sidebar: panel lifetime');
      function HeaderButton({sessionId}) {
        const [shell,setShell]=React.useState(null);
        const locateShell=React.useCallback(node=>{if(node)setShell(node.closest('[data-phase]'));},[]);
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
          if(!open && resetTabs.current){resetTabs.current=false;setGeneration(n=>n+1);}
          setOpen(!open);setError('');
        }
        const [mounted, setMounted]=React.useState(open);
        const resetTabs=React.useRef(false);
        const [generation,setGeneration]=React.useState(0);
        React.useLayoutEffect(()=>{if(open)setMounted(true);},[open]);
        const motion=React.useRef(null);
        // Keep the terminal grid at its final height during the slide. Only
        // actual resizing should reflow a running shell or send PTY resizes.
        React.useLayoutEffect(()=>{
          const el=motion.current;
          if(!el || !shell)return;
          const measure=()=>el.style.setProperty('--ss-limit',Math.floor(shell.clientHeight*.65)+'px');
          measure();
          const observer=new ResizeObserver(measure);observer.observe(shell);
          return ()=>observer.disconnect();
        },[shell,mounted]);
        React.useLayoutEffect(()=>{
          const el=motion.current;
          if(!el)return;
          el.inert=!open;
          if(open || !mounted)return;
          let alive=true;
          const moving=el.getAnimations().filter(a=>a.transitionProperty==='flex-basis');
          Promise.allSettled(moving.map(a=>a.finished)).then(()=>{if(alive)setMounted(false);});
          return ()=>{alive=false;};
        },[open,mounted]);
        const label=open?'收起底部终端':'展开底部终端';
        const button=h(Tooltip,{label,side:'bottom',delayMs:500},h(Button,{size:'sm',className:'ss-toggle',
          'aria-label':label,'aria-expanded':open,'data-split-sidebar-toggle':'',onClick:toggle},h(IconPanelLeftOutlineRegular,{'aria-hidden':true})));
        const size=Number.parseInt(localStorage.getItem('dsh-split-sidebar.height'),10);
        return h(React.Fragment,null,h('span',{ref:locateShell,style:{display:'inline-flex'}},button),(mounted||open)&&shell&&createPortal(
          h('div',{ref:motion,className:'ss-motion','data-open':String(open),'aria-hidden':!open,
            style:{'--ss-height':(Number.isFinite(size)?Math.min(800,Math.max(78,size)):240)+'px'}},
            panel?h(panel.Panel,{key:generation,session:sessionId,collapse:()=>{resetTabs.current=true;opened.delete(sessionId);setOpen(false);}}):
              h('div',{role:'status'},error?h(Button,{size:'sm',onClick:()=>{setError('');retry();}},error+'，重试'):'正在打开终端…')),shell));
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
        document.documentElement.dataset.dshSplitSidebar='0.3.1';
        return () => { style.remove(); delete document.documentElement.dataset.dshSplitSidebar; };
      }, 'split-sidebar: style');
      const add = (name, options, component) => ctx.effect(() => ctx.slots.inject(name, () =>
        ctx.slots.register({name,...options},component)), 'split-sidebar: '+name);
      if (defaults.showDock) add('conversation.session.header.utilities',{id:'split-sidebar.horizontal',order:10},Header);
      const settingsId='dsh-split-sidebar/settings';
      ctx.effect(()=>ctx.sidebarRightTabs.register({id:settingsId,kind:settingsKind,multiple:false,priority:'extension',title:()=>'分屏侧栏设置'}),
        'split-sidebar: settings tab');
      add('sidebar.right.pane.tab',{key:settingsId},()=>h(Settings,{inSidebar:true}));
      add('plugins.bundle.config',{key:'dsh-split-sidebar'},Settings);
      add('sidebar.right.tab.guide.actions',{id:'split-sidebar.settings'},SettingsRow);
      add('sidebar.right.tab.document.actions',{id:'split-sidebar.navigator'},Split);
      const id = 'dsh-split-sidebar/media', extensions = Object.keys(mime);
      ctx.effect(() => ctx.documentPreviews.register({id,extensions,binaryExtensions:extensions,priority:'extension',
        title:()=>'侧栏媒体播放器',loading:'renderer'}),'split-sidebar: media');
      add('sidebar.right.tab.document',{key:id},Media);
    }
    return {inject:['slots','theme','locale','sessions','sidebarRight','sidebarRightTabs','webTerminals','remote.terminal','documentPreviews','remote','remote.workspaceFiles','remote.session'],apply};
  },
});
