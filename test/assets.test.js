import test from 'node:test';
import assert from 'node:assert/strict';
import {registerAssets} from '../assets.js';
import {appearanceFromConfig} from '../ghostty.js';

test('serves the panel locally and requires an explicit appearance import',async()=>{
  const routes=new Map();
  registerAssets({effect(fn){fn();},connection:{fetch:{register(route){routes.set(route.path,route);}}}});
  const panel=routes.get('/api/split-sidebar/panel.mjs');
  const response=await panel.fetch();
  assert.equal(response.headers.get('content-type'),'text/javascript');
  assert.match(await response.text(),/createWorkbench/);
  const importer=routes.get('/api/split-sidebar/ghostty');
  assert.deepEqual(importer.methods,['POST']);
  assert.equal((await importer.fetch(new Request('https://example.invalid'))).status,403);
});

test('imports only appearance, using the platform font scale and DSH limits',()=>{
  const source=['font-family = Example Mono','font-family = Example Symbols','font-size = 12',
    'env = EXAMPLE=ignored','command = ignored','foreground = #eeeeee','background = invalid',
    'palette = 0=#112233','palette = 99=#000000','window-padding-x = 6,12'].join('\n');
  assert.deepEqual(appearanceFromConfig(source,'darwin'),{fontFamily:'Example Mono, Example Symbols',
    fontSize:12,foreground:'#eeeeee',paddingX:[6,12]});
  assert.equal(appearanceFromConfig(source,'linux').fontSize,16);
  assert.equal(appearanceFromConfig('font-size = 72','darwin').fontSize,20);
});
