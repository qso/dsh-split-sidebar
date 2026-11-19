// Only the selected tab mounts the DSH terminal screen. Each tab holds its
// process independently of the screen while collapsed or in another session.
const prefix = 'dsh-split-sidebar.tabs.v2.';
const provider = '@deepseek-ai/dsh-client-ui-sidebar-terminal';
const css = `
.ss-panel{box-sizing:border-box;position:absolute;inset:auto 0 0;display:flex;flex-direction:column;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.ss-resize{position:absolute;z-index:2;top:0;left:0;right:0;height:5px;cursor:row-resize;touch-action:none}
.ss-toolbar{display:flex;align-items:center;gap:4px;padding-inline:10px 6px;flex:none}
.ss-tabs{display:flex;align-items:center;gap:3px;min-width:0;overflow:auto;scrollbar-width:none}
.ss-chip{display:flex;align-items:center;position:relative;flex:0 0 auto;border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary)}
.ss-chip[data-active=true]{background:var(--dsw-alias-markdown-tag);color:var(--dsw-alias-label-primary)}
.ss-chip [role=tab]{font:inherit;font-size:var(--dsh-content-font-size-secondary,13px);color:inherit;line-height:1;white-space:nowrap;height:28px;min-width:80px;padding:0 26px 0 10px;text-align:left;border:0;border-radius:inherit;background:transparent;cursor:pointer}
.ss-chip .ss-close{position:absolute;top:4px;right:4px;width:20px;height:20px;display:grid;place-content:center;padding:0;color:var(--dsw-alias-label-tertiary);border:0;border-radius:var(--dsw-radius-sm);background:transparent;cursor:pointer;opacity:0;pointer-events:none}
.ss-chip:focus-within .ss-close,.ss-chip[data-active=true] .ss-close{opacity:1;pointer-events:auto}
.ss-toolbar .ss-add{width:28px;height:28px;padding:0;color:var(--dsw-alias-label-secondary)}
@media(hover:hover){.ss-chip:hover,.ss-chip .ss-close:hover{background:var(--dsw-alias-interactive-bg-hover)}.ss-chip:hover .ss-close{opacity:1;pointer-events:auto}}
.ss-body{display:flex;flex:1;min-height:0;min-width:0;overflow:hidden}
.ss-resize:focus-visible,.ss-chip button:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:-2px}
`;
const newTab = number => ({id:crypto.randomUUID(),kind:'terminal',number});
const title = tab => '终端 '+tab.number;
function readLayout(session) {
  try {
    const saved=JSON.parse(sessionStorage.getItem(prefix+session));
    const tabs=saved?.tabs?.filter(t=>t?.kind==='terminal'&&typeof t.id==='string'&&Number.isSafeInteger(t.number)&&t.number>0);
    if(tabs?.length)return {tabs,active:tabs.some(t=>t.id===saved.active)?saved.active:tabs[0].id,
      next:Math.max(...tabs.map(t=>t.number),Number.isSafeInteger(saved.next)?saved.next-1:0)+1};
  } catch {}
  const tab=newTab(1);
  return {tabs:[tab],active:tab.id,next:2};
}

export function createWorkbench(React,ctx,{ui,useTheme}) {
  const h=React.createElement, leases=new Map(), layouts=new Map();
  const {Button,Tooltip,IconPlusOutlineRegular,IconCloseOutlineRegular}=ui;
  const t=ctx.locale.bind('sidebarTerminal');
  const slot='sidebar.right.pane.tab';
  const subscribeBody=listener=>ctx.slots.subscribe(slot,listener);
  const getBody=()=>ctx.slots.entriesOfSlot(slot).find(entry=>entry.options.key===provider)?.component;
  let dead=false;
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

  function Terminal({session,tab,replace}) {
    const Body=React.useSyncExternalStore(subscribeBody,getBody);
    const [model,setModel]=React.useState(null);
    React.useEffect(()=>{setModel(modelFor(session,tab));},[session,tab.id]);
    const info={tab:{id:tab.id,visible:true,actions:{openTab:replace}}};
    if(!Body)return h('p',{role:'status'},'请在 DSH 中启用原生侧栏终端。');
    if(!model)return null;
    return h(Body,{useTabInfo:()=>info,useTheme,view:()=>model,
      useTerminal:()=>React.useSyncExternalStore(model.state.subscribe.bind(model.state),model.state.getSnapshot.bind(model.state)),
      t:(key,...args)=>key==='title'?title(tab)+'输入':t(key,...args)});
  }

  function Panel({session,collapse}) {
    const [layout,setLayout]=React.useState(()=>layouts.get(session)??readLayout(session));
    const panel=React.useRef(null),drag=React.useRef(null);
    React.useLayoutEffect(()=>{
      if(layout.tabs.length)layouts.set(session,layout);else layouts.delete(session);
      try{if(layout.tabs.length)sessionStorage.setItem(prefix+session,JSON.stringify(layout));
        else sessionStorage.removeItem(prefix+session);}catch{}
    },[layout,session]);

    function add() {
      setLayout(prev=>{
        const tab=newTab(prev.next);
        return {tabs:[...prev.tabs,tab],active:tab.id,next:prev.next+1};
      });
    }
    function release(tab) {
      ctx.webTerminals.close(session,tab.id,'split-sidebar://terminal/'+tab.id);
      leases.get(tab.id)?.end();leases.delete(tab.id);
    }
    function close(tab,replace=false) {
      release(tab);
      const index=layout.tabs.indexOf(tab),tabs=layout.tabs.filter(t=>t.id!==tab.id);
      if(replace)tabs.splice(index,0,newTab(layout.next));
      const active=layout.active===tab.id?tabs[Math.min(index,tabs.length-1)]?.id:layout.active;
      setLayout({tabs,active,next:layout.next+Number(replace)});
      if(!tabs.length)collapse();
    }
    function resize(value,save) {
      const el=panel.current?.parentElement;
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
    const selected=layout.tabs.find(tab=>tab.id===layout.active);
    return h('section',{className:'ss-panel',ref:panel,'aria-label':'底部终端','data-split-sidebar-panel':''},
      h('style',null,css),
      h('div',{className:'ss-resize',role:'separator','aria-label':'调整底部终端高度','aria-orientation':'horizontal',tabIndex:0,
        onPointerDown:e=>{if(e.button!==0)return;const el=panel.current;drag.current={y:e.clientY,h:el.offsetHeight};
          el.parentElement.dataset.resizing='';e.currentTarget.setPointerCapture(e.pointerId);},
        onPointerMove:e=>{if(drag.current)resize(drag.current.h+drag.current.y-e.clientY,false);},
        onPointerUp:e=>{if(drag.current)resize(drag.current.h+drag.current.y-e.clientY,true);},
        onLostPointerCapture:()=>{drag.current=null;delete panel.current.parentElement.dataset.resizing;},
        onKeyDown:e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();resize(panel.current.offsetHeight+(e.key==='ArrowUp'?24:-24),true);}}}),
      h('div',{className:'ss-toolbar'},h('div',{className:'ss-tabs',role:'tablist','aria-label':'底部终端标签'},layout.tabs.map(tab=>
        h('div',{className:'ss-chip',key:tab.id,'data-active':String(tab===selected),
          onMouseDown:e=>{if(e.button===1)e.preventDefault();},
          onAuxClick:e=>{if(e.button===1){e.preventDefault();e.stopPropagation();close(tab);}}},
          h('button',{type:'button',role:'tab','aria-selected':tab===selected,tabIndex:tab===selected?0:-1,
            onKeyDown:moveTab,onClick:()=>setLayout({...layout,active:tab.id})},title(tab)),
          h('button',{type:'button',className:'ss-close','aria-label':'关闭'+title(tab),onClick:()=>close(tab)},h(IconCloseOutlineRegular,{size:12}))))),
        h(Tooltip,{label:'新建终端',side:'bottom',delayMs:500},h(Button,{className:'ss-add',size:'sm','aria-label':'新建终端',onClick:add},
          h(IconPlusOutlineRegular,{size:15})))),
      h('div',{className:'ss-body',role:'tabpanel','aria-label':selected?title(selected):'底部终端'},selected&&
        h(Terminal,{key:selected.id,session,tab:selected,replace:()=>close(selected,true)})));
  }
  return {Panel,dispose(){dead=true;for(const lease of leases.values())lease.end();leases.clear();layouts.clear();}};
}
