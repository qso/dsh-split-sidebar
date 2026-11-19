import test from 'node:test';
import assert from 'node:assert/strict';
import {registerAssets} from '../assets.js';

test('the lazy panel, terminal modules and emulator CSS are served from fixed local routes',async()=>{
  const routes=new Map();
  registerAssets({effect(fn){fn();},connection:{fetch:{register(route){routes.set(route.path,route);}}}});
  const expected={'panel.mjs':'createWorkbench','terminal.mjs':'createScreen','xterm.mjs':'Terminal','fit.mjs':'FitAddon','xterm.css':'.xterm'};
  assert.equal(routes.size,Object.keys(expected).length);
  for(const [file,marker] of Object.entries(expected)){
    const route=routes.get('/api/split-sidebar/'+file);
    assert.deepEqual(route.methods,['GET']);
    const response=await route.fetch();
    assert.ok(response.ok);
    assert.equal(response.headers.get('content-type'),file.endsWith('.css')?'text/css':'text/javascript');
    assert.ok((await response.text()).includes(marker));
  }
});
