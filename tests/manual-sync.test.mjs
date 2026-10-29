import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../lib/store.mjs';
import { attentionItems } from '../lib/control.mjs';
import { queueSync, applySyncResult } from '../lib/manual-sync.mjs';
function fixture(t) { const path=mkdtempSync(join(tmpdir(),'forma-sync-'));const store=createStore(path,{seed:false});t.after(()=>{store.close();rmSync(path,{recursive:true,force:true});});return store; }
const sources=Object.fromEntries(['granola','slack','jira','codex','calendar'].map(name=>[name,{status:'unavailable',detail:'Not connected in this test',checkedAt:null}]));
test('repeated clicks reuse an active sync and completed sync permits a new request',t=>{
 const store=fixture(t);const first=queueSync(store);assert.equal(queueSync(store).id,first.id);
 applySyncResult(store,first.id,JSON.stringify({tasks:[],sources,message:'No source access in this test.'}));
 assert.equal(store.controlState().commands[0].status,'completed');assert.notEqual(queueSync(store).id,first.id);
});
test('sync rejects incomplete coverage and preserves human edits and completed tasks',t=>{
 const store=fixture(t);store.ingest({tasks:[{sourceKey:'test:one',title:'Original',links:[]}]});const task=store.list()[0];store.update(task.id,{title:'Human title',status:'done'},task.version);const sync=queueSync(store);
 assert.throws(()=>applySyncResult(store,sync.id,JSON.stringify({tasks:[],sources:{},message:'Invalid'})),/coverage/);
 assert.equal(store.controlState().commands[0].status,'queued');
 applySyncResult(store,sync.id,JSON.stringify({tasks:[{sourceKey:'test:one',title:'Changed',links:[]}],sources,message:'Verified unavailable test sources.'}));
 assert.equal(store.get(task.id).title,'Human title');assert.equal(store.get(task.id).status,'done');assert.equal(store.list().length,1);
});

test('sync accepts a JSON batch followed by Codex memory citation metadata',t=>{
 const store=fixture(t);const sync=queueSync(store);
 applySyncResult(store,sync.id,'```json\n'+JSON.stringify({tasks:[],sources,message:'Test coverage only.'})+'\n```\n<oai-mem-citation>metadata</oai-mem-citation>');
 assert.equal(store.controlState().commands[0].status,'completed');
});

test('a later successful sync clears superseded sync failure attention',()=>{
 const commands=[{id:'old',type:'sync',status:'failed'},{id:'new',type:'sync',status:'completed'}];
 assert.equal(attentionItems([],{commands,agents:[],reviewed:{}}).length,0);
 commands[1].status='failed';assert.equal(attentionItems([],{commands,agents:[],reviewed:{}})[0].id,'new');
});

test('completed sync result replay cannot import different tasks',t=>{
 const store=fixture(t), sync=queueSync(store);
 const first=applySyncResult(store,sync.id,JSON.stringify({tasks:[],sources,message:'Checked'}));
 assert.deepEqual(applySyncResult(store,sync.id,JSON.stringify({tasks:[{sourceKey:'unexpected',title:'Unexpected',links:[]}],sources,message:'Replay'})),first);
 assert.equal(store.list().length,0);
 assert.throws(()=>applySyncResult(store,'unknown','{}'),/Unknown/);
});

test('unavailable coverage preserves last successful source check',t=>{
 const store=fixture(t), checkedAt='2026-10-08T08:00:00Z';
 store.ingest({tasks:[],sources:{jira:{status:'checked',detail:'Verified',checkedAt}}});
 store.ingest({tasks:[],sources:{jira:{status:'unavailable',detail:'Transport failed',checkedAt:null}}});
 const source=store.snapshot().sources.jira;
 assert.equal(source.lastSuccessfulAt,checkedAt);
 assert.equal(source.lastCheckedAt,checkedAt);
 assert.equal(source.checkedAt,null);
 assert.ok(source.lastAttemptAt);
});
