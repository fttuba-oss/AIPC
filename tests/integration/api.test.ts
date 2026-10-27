import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { practiceApiMiddleware } from '../../src/modules/practice/server';
import { scoreApiMiddleware } from '../../src/modules/score/server';
import type { AppSession } from '../../src/contracts';

test('role-aware HTTP APIs dispatch, synchronize completion, and prevent cross-student updates', async () => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(),'aipc-api-'));
 fs.writeFileSync(path.join(root,'students.json'),JSON.stringify([{id:'s1',name:'Student one',instrument:'Flute'},{id:'s2',name:'Student two',instrument:'Tuba'}]));
 let session: AppSession | null = {userId:'t1',displayName:'Teacher',role:'teacher'};
 const options = {storageRoot:root,resolveSession:()=>session};
 const score = scoreApiMiddleware(options), practice = practiceApiMiddleware(options);
 const server = createServer((req,res)=>score(req,res,()=>practice(req,res,()=>{res.statusCode=404;res.end();})));
 server.listen(0,'127.0.0.1'); await once(server,'listening');
 const address = server.address() as {port:number};
 const call = async (url:string,method='GET',value?:unknown) => fetch(`http://127.0.0.1:${address.port}${url}`,{method,headers:{'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});
 try {
  let response = await call('/api/storage/scores','POST',{title:'Test score',fileName:'test.xml',xml:'<score-partwise version="4.0"></score-partwise>'});
  assert.equal(response.status,201); const uploaded=await response.json();
  response=await call(uploaded.xmlPath);assert.equal(response.status,200);assert.match(await response.text(),/score-partwise/);
  response=await call('/api/practice/plans','POST',{teacherId:'forged',title:'New plan',score:uploaded,studentId:'s1',range:[1,2],notes:'Go slowly'});
  assert.equal(response.status,201);const plan=await response.json();assert.equal(plan.teacherId,'t1');
  session={userId:'s2',displayName:'Other',role:'student'};
  assert.equal((await (await call('/api/practice/plans?studentId=s1')).json()).length,0);
  assert.equal((await call(`/api/practice/plans/${plan.id}/status`,'PATCH',{studentId:'s1',status:'completed'})).status,404);
  assert.equal((await call('/api/practice/plans','POST',{})).status,403);
  assert.equal((await call('/api/storage/scores','POST',{})).status,403);
  session={userId:'s1',displayName:'Student one',role:'student'};
  assert.equal((await call(`/api/practice/plans/${plan.id}/status`,'PATCH',{status:'completed'})).status,200);
  session={userId:'t1',displayName:'Teacher',role:'teacher'};
  assert.equal((await (await call('/api/practice/plans')).json())[0].status,'completed');
  assert.equal((await call(`/api/practice/plans/${plan.id}/status`,'PATCH',{studentId:'s1',status:'assigned'})).status,403);
  session=null;assert.equal((await call('/api/practice/plans')).status,401);
 } finally { await new Promise<void>(resolve=>server.close(()=>resolve()));fs.rmSync(root,{recursive:true,force:true}); }
});
