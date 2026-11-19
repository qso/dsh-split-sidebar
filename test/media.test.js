import test from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../index.js';
import {byteRange} from '../media-ranges.js';

test('range forms, unsatisfiable requests and empty files',() => {
  assert.deepEqual(byteRange('bytes=10-',20),{start:10,end:19,status:206});
  assert.deepEqual(byteRange('bytes=-3',20),{start:17,end:19,status:206});
  assert.deepEqual(byteRange('bytes=0-999',20),{start:0,end:19,status:206});
  for(const r of ['bytes=-0','bytes=-','bytes=20-','bytes=4-3','bytes=0-1,3-4']) assert.equal(byteRange(r,20),null);
  assert.equal(byteRange('bytes=0-',0),null);
});
test('ticket issuance requires an explicit media request, seeking reads only requested bytes, changed versions fail',async() => {
  let version='a';const routes={};
  const ranges=[],disposers=[];
  const files={config:{maxBytes:1024,maxFileBytes:50},ctx:{invocation:{peer:{principal:{kind:'owner'}}}},
    async readBytes(_scope,_path,{range}){ranges.push(range);return {bytes:200000,absolutePath:'/sample.mp4',version,
      offset:range.offset,data:new Uint8Array(range.length)};}};
  const native=files.readBytes;
  const ctx={workspaceFiles:files,typert:{lookups:{get:()=>({resolve:sessionId=>({sessionId,workspaceRoot:'/'})})}},attachments:{imageLimits:{maxImageBytes:50}},
    connection:{fetch:{register(r){routes[r.path]=r;return ()=>{};}}},on(){},effect(fn){disposers.push(fn());}};
  apply(ctx);
  const mint=(headers)=>routes['/api/dockline-preview'].fetch(new Request('http://localhost/api/dockline-preview',
    {method:'POST',headers,body:JSON.stringify({session:'s',path:'sample.mp4'})}));
  const request=(ticket,range,method='GET')=>routes['/api/dockline-media'].fetch(new Request('http://localhost/api/dockline-media?ticket='+ticket,
    {method,headers:range?{Range:range}:{}}));
  try {
    assert.equal((await mint({})).status,403);
    const {docklineTicket}=await (await mint({'X-Dockline-Preview':'1','Content-Type':'application/json'})).json();assert.match(docklineTicket,/^[a-f0-9]{64}$/);
    assert.equal((await request('unknown','bytes=0-1')).status,404);
    assert.equal((await request(docklineTicket,'bytes=3-2')).status,416);
    ranges.length=0;
    const response=await request(docklineTicket,'bytes=100000-102047');
    assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 100000-102047/200000');
    assert.equal((await response.arrayBuffer()).byteLength,2048);assert.deepEqual(ranges,[{offset:100000,length:1024},{offset:101024,length:1024}]);
    version='b';await assert.rejects((await request(docklineTicket,'bytes=0-4')).arrayBuffer());
  } finally {for(const fn of disposers.reverse())fn();}
  assert.equal(files.readBytes,native);
});
