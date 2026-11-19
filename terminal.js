import {Terminal} from './xterm.mjs';
import {FitAddon} from './fit.mjs';

// The emulator interprets terminal control sequences. DSH owns PTYs, their
// workspace, user input, retention and the ordered output snapshots.
export function createScreen(React) {
  const h=React.createElement;
  return function Screen({getModel,label}) {
    const element=React.useRef(null),[model,setModel]=React.useState(null);
    const [status,setStatus]=React.useState('正在连接终端…');
    React.useEffect(()=>{
      const node=element.current;
      const model=getModel();
      setModel(model);
      const terminal=new Terminal({fontSize:13,fontFamily:'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        cursorBlink:true,scrollback:1500,theme:{background:'#17191d',foreground:'#e8eaed'},disableStdin:true});
      const fit=new FitAddon();
      terminal.loadAddon(fit);terminal.open(node);
      terminal.textarea?.setAttribute('aria-label',label+'输入');
      let alive=true,revision=-1,lastGesture=-Infinity,hadInput=false;
      const gesture=()=>{lastGesture=performance.now();};
      const inputEvents=['keydown','paste','compositionend','drop','pointerdown'];
      for(const name of inputEvents)node.addEventListener(name,gesture,true);
      const input=terminal.onData(data=>model.write(data,performance.now()-lastGesture<1000&&!['\x1b[I','\x1b[O'].includes(data)));
      function measure() {
        const state=model.state.getSnapshot(),d=fit.proposeDimensions();
        if(!state.writable||!d||!node.clientWidth||!node.clientHeight)return;
        const cols=Math.min(d.cols,state.environment?.maxCols??d.cols),rows=Math.min(d.rows,state.environment?.maxRows??d.rows);
        if(cols<2||rows<1)return;
        if(cols!==terminal.cols||rows!==terminal.rows)terminal.resize(cols,rows);
        if(cols!==state.info?.cols||rows!==state.info?.rows)model.resize(cols,rows);
      }
      function draw(){
        const state=model.state.getSnapshot(),render=state.render;
        const ended=state.info?.state==='exited'||state.phase==='closed';
        const text=ended?'终端已结束':state.phase==='failed'?String(state.error??'无法连接终端'):
          state.phase==='disconnected'?'终端连接已断开':state.phase==='connected'?(state.writable?'':'只读终端'):'正在连接终端…';
        setStatus(text);
        terminal.options.disableStdin=!state.writable;
        if(render&&render.revision!==revision) {
          revision=render.revision;
          const {frame}=render;
          if(frame.type==='snapshot'){terminal.reset();terminal.resize(frame.info.cols,frame.info.rows);}
          terminal.write(frame.type==='snapshot'?frame.screen:frame.data,()=>{if(alive){model.acknowledge(render.revision);if(frame.type==='snapshot')measure();}});
        }
        if(state.writable&&!hadInput){measure();terminal.focus();}
        hadInput=state.writable;
      }
      const observer=new ResizeObserver(measure);observer.observe(node);
      const off=model.state.subscribe(draw);const detach=model.mount();draw();
      return ()=>{alive=false;off();detach();observer.disconnect();input.dispose();
        for(const name of inputEvents)node.removeEventListener(name,gesture,true);
        terminal.dispose();};
    },[]);
    return h('div',{className:'ss-term'},h('link',{rel:'stylesheet',href:new URL('xterm.css',import.meta.url).href}),
      status&&h('div',{className:'ss-term-status',role:'status'},status,
        model&&['failed','disconnected'].includes(model.state.getSnapshot().phase)&&h('button',{onClick:()=>model.refresh()},'重新连接')),
      h('div',{className:'ss-screen',ref:element}));
  };
}
