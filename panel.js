// Imported only after the user opens the horizontal split. All tab metadata
// belongs to its session. The only live terminal screen is the selected tab.
const css = `
.ss-panel{position:relative;display:flex;flex-direction:column;box-sizing:border-box;min-width:0;min-height:78px;max-height:65%;flex:0 1 var(--ss-height,240px);border-top:1px solid var(--dsw-alias-border-l2,#8886);background:var(--dsw-alias-bg-base,Canvas);color:var(--dsw-alias-label-primary,CanvasText)}
.ss-resize{position:absolute;inset:-4px 0 auto;height:7px;cursor:row-resize;touch-action:none;z-index:2}.ss-resize:focus-visible{outline:2px solid Highlight}
.ss-toolbar,.ss-tabs,.ss-tab{display:flex;align-items:center;min-width:0}.ss-toolbar{padding:4px 8px;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1,#8883)}
.ss-tabs{overflow-x:auto;gap:3px}.ss-tab{border-radius:6px;flex:none}.ss-tab:has([aria-selected=true]){background:var(--dsw-alias-bg-layer-2,#8883)}
.ss-tab button,.ss-menu button,.ss-files button{font:inherit;font-size:12px;color:inherit;border:0;background:transparent;padding:5px 8px;cursor:pointer}.ss-tab button[aria-label^=关闭]{opacity:.65;padding:3px 5px}
.ss-actions{display:flex;align-items:center;margin-inline-start:auto}.ss-new{position:relative}.ss-menu{position:absolute;left:0;top:100%;display:grid;z-index:5;min-width:130px;padding:4px;background:var(--dsw-alias-bg-base,Canvas);color:var(--dsw-alias-label-primary,CanvasText);border:1px solid var(--dsw-alias-border-l2,#8885);border-radius:7px;box-shadow:0 4px 12px #0002}
.ss-menu button,.ss-files button{text-align:left;border-radius:4px}.ss-menu button:hover,.ss-files button:hover{background:var(--dsw-alias-bg-layer-2,#8882)}
.ss-body{flex:1 1 0;min-height:0;overflow:auto}.ss-files{padding:6px;display:grid}.ss-files button{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ss-empty{padding:8px 12px;font-size:13px}
.ss-term{height:100%;box-sizing:border-box;padding:4px 6px;background:#17191d;color:#eee;display:flex;flex-direction:column}.ss-screen{flex:1 1 0;min-height:0;overflow:hidden}.ss-term-status{font-size:12px}.ss-screen .xterm{height:100%}
`;
const keyPrefix='dsh-split-sidebar.tabs.v2.';
const tabsFor=new Set(['terminal','files','settings']);
function newTab(kind,number) {
  return {id:crypto.randomUUID(),kind,number};
}
function readLayout(session,defaultTab) {
  try {
    const saved=JSON.parse(sessionStorage.getItem(keyPrefix+session));
    const tabs=saved?.tabs?.filter(t=>tabsFor.has(t?.kind)&&typeof t.id==='string'&&Number.isSafeInteger(t.number));
    if(tabs?.length) return {tabs,active:tabs.some(t=>t.id===saved.active)?saved.active:tabs[0].id,next:Math.max(0,...tabs.filter(t=>t.kind==='terminal').map(t=>t.number))+1};
  } catch {}
  const tab=newTab(defaultTab,defaultTab==='terminal'?1:0);
  return {tabs:[tab],active:tab.id,next:tab.number+1};
}
function heightPreference() {
  try {return Math.min(800,Math.max(96,Number(localStorage.getItem('dsh-split-sidebar.height'))||240));} catch {return 240;}
}
function title(t) {return t.kind==='terminal'?'终端 '+t.number:t.kind==='files'?'已打开的文件':'分屏设置';}

export function createWorkbench(React,ctx,{Settings,Icon,settings}) {
  const h=React.createElement, leases=new Map(), layouts=new Map();
  let dead=false, terminalModule;
  function loadTerminal() {
    terminalModule ??= import('./terminal.mjs').then(m=>m.createScreen(React)).catch(e=>{terminalModule=undefined;throw e;});
    return terminalModule;
  }
  function modelFor(session,tab) {
    const existing=leases.get(tab.id);
    if(existing)return existing.model;
    const address='split-sidebar://terminal/'+tab.id;
    const model=ctx.webTerminals.view(session,tab.id,address);
    // Native right-sidebar membership and bottom-pane membership are distinct.
    // Keep the bottom tab's own window hold even while its screen is detached.
    let stream,starting=false,released=false;
    function holdWhenReady() {
      const info=model.state.getSnapshot().info;
      if(info && info.state!=='running' && stream){const old=stream;stream=undefined;void old.dispose();}
      if(dead||released||starting||stream||info?.state!=='running')return;
      starting=true;
      try{
        stream=ctx.remote.$stream({name:'split-sidebar terminal hold',
          open:signal=>ctx.remote.terminal.retain(session,model.id,signal)});
        const active=stream;
        (async()=>{try{for await(const frame of active)frame.accept();}catch{}finally{if(stream===active)stream=undefined;}})();
      }finally{starting=false;}
    }
    const unsubscribe=model.state.subscribe(holdWhenReady);
    leases.set(tab.id,{model,end(){released=true;unsubscribe();void stream?.dispose();}});
    holdWhenReady();
    return model;
  }
  function Terminal({session,tab}) {
    const [Screen,setScreen]=React.useState(null),[error,setError]=React.useState(false);
    const [attempt,retry]=React.useReducer(n=>n+1,0);
    React.useEffect(()=>{
      let alive=true;
      loadTerminal().then(component=>{if(alive)setScreen(()=>component);}).catch(()=>{if(alive)setError(true);});
      return ()=>{alive=false;};
    },[attempt]);
    if(!Screen)return h('div',{className:'ss-empty',role:'status'},error?
      h('button',{onClick:()=>{setError(false);retry();}},'终端载入失败，重试'):'正在打开终端…');
    return h(Screen,{getModel:()=>modelFor(session,tab),label:title(tab)});
  }
  function Files({session}) {
    const store=ctx.sidebarRight.openTabs;
    const rows=React.useSyncExternalStore(store.subscribe.bind(store),store.getSnapshot.bind(store))
      .filter(tab=>tab.sessionId===session&&tab.contentId.startsWith('dsh-resource://file/'));
    return rows.length?h('div',{className:'ss-files'},rows.map(t=>{
      let path=t.contentId;
      try {path=decodeURIComponent(new URL(path).pathname.split('/').slice(3).join('/'));}catch{}
      return h('button',{key:t.tabId,title:path,onClick:()=>{
        if(!ctx.sidebarRight.isExpanded())ctx.sidebarRight.toggleExpanded();
        ctx.sidebarRight.focus(t.tabId);
      }},path);
    })):h('div',{className:'ss-empty'},'本会话还没有打开的文件。',h('button',{onClick:()=>ctx.sidebarRight.openTab('files')},'浏览文件'));
  }
  function Panel({session,collapse}) {
    const [layout,setLayout]=React.useState(()=>layouts.get(session)??readLayout(session,settings.defaultTab));
    const [menu,setMenu]=React.useState(false),panel=React.useRef(null),newMenu=React.useRef(null),drag=React.useRef(null);
    React.useEffect(()=>{
      layouts.set(session,layout);
      try{if(layout.tabs.length)sessionStorage.setItem(keyPrefix+session,JSON.stringify(layout));
        else sessionStorage.removeItem(keyPrefix+session);}catch{}
    },[layout,session]);
    React.useEffect(()=>{
      if(!menu)return;
      const close=e=>{if(!newMenu.current?.contains(e.target))setMenu(false);};
      document.addEventListener('pointerdown',close,true);
      return ()=>document.removeEventListener('pointerdown',close,true);
    },[menu]);
    function add(kind) {
      setMenu(false);
      setLayout(prev=>{
        const exist=kind!=='terminal'&&prev.tabs.find(t=>t.kind===kind);
        if(exist)return {...prev,active:exist.id};
        const tab=newTab(kind,prev.next);
        return {tabs:[...prev.tabs,tab],active:tab.id,next:prev.next+Number(kind==='terminal')};
      });
    }
    function close(t) {
      if(t.kind==='terminal'){
        const lease=leases.get(t.id);
        ctx.webTerminals.close(session,t.id,'split-sidebar://terminal/'+t.id);
        lease?.end();leases.delete(t.id);
      }
      const ix=layout.tabs.indexOf(t),tabs=layout.tabs.filter(tab=>tab.id!==t.id);
      if(!tabs.length){
        layouts.delete(session);
        try{sessionStorage.removeItem(keyPrefix+session);}catch{}
        collapse();return;
      }
      setLayout({...layout,tabs,active:layout.active===t.id?tabs[Math.min(ix,tabs.length-1)].id:layout.active});
    }
    function resize(value,save) {
      const el=panel.current;
      if(!el)return;
      const px=Math.max(78,Math.min(value,el.parentElement.clientHeight*.65));
      el.style.setProperty('--ss-height',px+'px');
      if(save)try{localStorage.setItem('dsh-split-sidebar.height',String(Math.round(px)));}catch{}
    }
    function moveTab(e) {
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      const ix=layout.tabs.findIndex(t=>t.id===layout.active),n=layout.tabs.length;
      const next=e.key==='Home'?0:e.key==='End'?n-1:(ix+(e.key==='ArrowLeft'?-1:1)+n)%n;
      e.preventDefault();setLayout({...layout,active:layout.tabs[next].id});
      panel.current.querySelectorAll('[role=tab]')[next]?.focus();
    }
    const t=layout.tabs.find(tab=>tab.id===layout.active);
    return h('section',{className:'ss-panel',ref:panel,'aria-label':'会话下方分屏','data-split-sidebar-panel':'',style:{'--ss-height':heightPreference()+'px'}},
      h('style',null,css),
      h('div',{className:'ss-resize',role:'separator','aria-label':'调整下方分屏高度','aria-orientation':'horizontal',tabIndex:0,
        onPointerDown:e=>{if(e.button!==0)return;drag.current={y:e.clientY,h:panel.current.offsetHeight};e.currentTarget.setPointerCapture(e.pointerId);},
        onPointerMove:e=>{if(drag.current)resize(drag.current.h+drag.current.y-e.clientY,false);},
        onPointerUp:e=>{if(drag.current)resize(drag.current.h+drag.current.y-e.clientY,true);drag.current=null;},
        onPointerCancel:()=>{drag.current=null;},onLostPointerCapture:()=>{drag.current=null;},
        onKeyDown:e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();resize(panel.current.offsetHeight+(e.key==='ArrowUp'?24:-24),true);}}}),
      h('div',{className:'ss-toolbar'},h('div',{className:'ss-tabs',role:'tablist','aria-label':'下方分屏标签'},layout.tabs.map(tab=>
        h('div',{key:tab.id,className:'ss-tab'},h('button',{role:'tab','aria-selected':tab.id===layout.active,tabIndex:tab.id===layout.active?0:-1,
          onKeyDown:moveTab,onClick:()=>setLayout({...layout,active:tab.id})},title(tab)),
        h('button',{type:'button','aria-label':'关闭'+title(tab),title:tab.kind==='terminal'?'关闭标签并结束此终端':'关闭标签',onClick:()=>close(tab)},'×')))),
      h('div',{className:'ss-new',ref:newMenu,onKeyDown:e=>{if(e.key==='Escape'){setMenu(false);newMenu.current.querySelector('button')?.focus();}}},
        h('button',{className:'ss-tab-action',type:'button',title:'新建标签','aria-label':'新建分屏标签','aria-expanded':menu,onClick:()=>setMenu(!menu)},'＋'),
        menu&&h('div',{className:'ss-menu'},h('button',{onClick:()=>add('terminal')},'新建终端'),h('button',{onClick:()=>add('files')},'已打开的文件'))),
      h('div',{className:'ss-actions'},h('button',{className:'ss-icon',title:'分屏设置','aria-label':'分屏设置',onClick:()=>add('settings')},h(Icon,{name:'settings'})))),
      h('div',{className:'ss-body',role:'tabpanel','aria-label':title(t)},t.kind==='terminal'?h(Terminal,{key:t.id,session,tab:t}):t.kind==='files'?h(Files,{session}):h(Settings)));
  }
  return {Panel,dispose(){dead=true;for(const lease of leases.values())lease.end();leases.clear();layouts.clear();}};
}
