import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../lib/store.mjs';
import { queueAnalysis, attentionItems, taskBrief, controlSnapshot } from '../lib/control.mjs';
import { taskStateReducer } from '../lib/client-state.mjs';
function fixture(t) { const directory=mkdtempSync(join(tmpdir(),'forma-control-'));const store=createStore(directory,{seed:false});t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});return {store,directory}; }
test('agent queue rejects stale versions, missing folders and duplicate starts without changing tasks', t=>{
 const {store,directory}=fixture(t);const task=store.create({title:'Investigate',workspacePath:directory});
 assert.throws(()=>queueAnalysis(task.id,task.version+1,'Read only',store),e=>e.status===409);
 queueAnalysis(task.id,task.version,'Read only',store);
 assert.throws(()=>queueAnalysis(task.id,task.version,'Again',store),e=>e.status===409);
 assert.equal(store.get(task.id).status,'todo');assert.equal(store.controlState().commands.length,1);
 const missing=store.create({title:'Missing',workspacePath:'/not/a/real/forma/folder'});assert.throws(()=>queueAnalysis(missing.id,missing.version,'Read only',store),/existing local workspace/);
 assert.equal(controlSnapshot(store).commands[0].text,undefined);
});
test('agent completion needs review and cannot complete the personal task', t=>{
 const {store}=fixture(t);const task=store.create({title:'Research'});const agent={id:'chat',turnId:'turn',taskId:task.id,title:task.title,managed:true,status:'review'};
 const control={agents:[agent],commands:[],reviewed:{},workerAt:new Date().toISOString()};
 const attention=attentionItems(store.list(),control);assert.equal(attention.length,1);assert.equal(store.get(task.id).status,'todo');
 control.reviewed[attention[0].id]='now';assert.equal(attentionItems(store.list(),control).length,0);
 control.reviewed={};store.update(task.id,{status:'done'},task.version);assert.equal(attentionItems(store.list(),control).length,0);
});
test('lost agent progress is surfaced rather than presented as completion',()=>{
 const task={id:'t',title:'Task',status:'todo'};const agent={id:'a',taskId:'t',title:'Run',managed:true,status:'running'};
 assert.equal(attentionItems([task],{agents:[agent],commands:[],workerAt:null})[0].kind,'stale');
 assert.equal(attentionItems([task],{agents:[{...agent,status:'unknown'}],commands:[]})[0].kind,'agent');
});
test('decisions persist separately and background enrichment preserves edited context',t=>{
 const {store}=fixture(t);store.ingest({tasks:[{sourceKey:'source',title:'Task',objective:'Source objective'}]});const task=store.list()[0];
 store.update(task.id,{objective:'My objective',responsibility:'review'},task.version);store.addDecision(task.id,'Use verified sources.');
 store.ingest({tasks:[{sourceKey:'source',title:'Task',objective:'Changed source',responsibility:'agent'}],sources:{slack:{status:'unavailable',detail:'Not connected',checkedAt:null}}});
 assert.equal(store.get(task.id).objective,'My objective');assert.equal(store.get(task.id).responsibility,'review');
 assert.match(taskBrief(store.get(task.id),store.activity(task.id)),/Use verified sources/);assert.equal(store.snapshot().sources.slack.status,'unavailable');
 assert.throws(()=>store.ingest({tasks:[],sources:{jira:{status:'made-up',detail:'',checkedAt:null}}}));
});
test('SQLite backups contain committed tasks and recorded decisions',async t=>{
 const {store,directory}=fixture(t);const task=store.create({title:'Keep me'});store.addDecision(task.id,'Keep this decision');
 const target=join(directory,'backup.sqlite');await store.backupTo(target);
 const {DatabaseSync}=await import('node:sqlite');const copy=new DatabaseSync(target);try{assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM tasks').get().n,1);assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM activity').get().n,2);}finally{copy.close();}
});
test('failed optimistic saves restore only the affected task and preserve another successful save',()=>{
 const a={id:'a',status:'todo',version:1},b={id:'b',status:'todo',version:1};let state={snapshot:{tasks:[a,b]},phase:'ready',pending:{},error:'',message:''};
 state=taskStateReducer(state,{type:'saving',id:'a',optimistic:{status:'done'}});assert.equal(state.snapshot.tasks[0].status,'done');
 state=taskStateReducer(state,{type:'loaded',snapshot:{tasks:[a,b]}});assert.equal(state.snapshot.tasks[0].status,'done');
 state=taskStateReducer(state,{type:'saving',id:'b',optimistic:{status:'done'}});
 state=taskStateReducer(state,{type:'saved',id:'b',task:{...b,status:'done',version:2},message:'Saved'});
 state=taskStateReducer(state,{type:'saveFailed',id:'a',error:'Conflict'});
 assert.equal(state.snapshot.tasks[0].status,'todo');assert.equal(state.snapshot.tasks[1].status,'done');assert.deepEqual(state.pending,{});assert.equal(state.error,'Conflict');
 state=taskStateReducer(state,{type:'loadFailed',error:'Offline'});assert.equal(state.phase,'ready');assert.equal(state.snapshot.tasks.length,2);
});

test('triage uses saved context without changing the task and supports queued cancellation', async t=>{
 const {queueTriage,cancelQueuedAnalysis}=await import('../lib/control.mjs');
 const {store}=fixture(t);const task=store.create({title:'Find incident guides',links:[{label:'Jira',url:'https://example.com/ticket/TASK-123'}]});
 const command=queueTriage(task.id,task.version,store);
 assert.equal(command.cwd,process.env.FORMA_CHAT_WORKSPACE || process.cwd());
 assert.match(command.text,/Still unknown/);assert.match(command.text,/TASK-123/);
 assert.throws(()=>queueTriage(task.id,task.version,store),e=>e.status===409);
 assert.deepEqual(store.get(task.id),task);
 cancelQueuedAnalysis(command.id,store);
 assert.equal(store.controlState().commands[0].status,'cancelled');
 assert.throws(()=>cancelQueuedAnalysis(command.id,store),e=>e.status===409);
 const next=queueTriage(task.id,task.version,store);assert.notEqual(next.id,command.id);
});
