import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn as realSpawn } from 'node:child_process';
import { createStore } from '../lib/store.mjs';
import { providers, selectedProvider, setProvider, claudeArgs, resumeCommand, claudeEvent } from '../lib/providers/index.mjs';
import { startProviderRun } from '../lib/providers/run.mjs';
import { ClaudeRuntime, recoverClaudeRuns } from '../lib/providers/claude-runtime.mjs';
import { queueAnalysis, controlSnapshot } from '../lib/control.mjs';
import { queueSync } from '../lib/manual-sync.mjs';
import { queueTaskChat } from '../lib/task-chat.mjs';
function fixture(t) { const dir=mkdtempSync(join(tmpdir(),'forma-provider-'));const store=createStore(dir,{seed:false});t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return {dir,store}; }
function scriptSpawn(script) { return (_command,_args,options) => realSpawn(process.execPath,['-e',script],options); }
const init=JSON.stringify({type:'system',subtype:'init',session_id:'11111111-1111-1111-1111-111111111111',tools:['Read','Glob','Grep']});
const reply=JSON.stringify({type:'result',subtype:'success',is_error:false,result:'Verified result'});
test('provider selection is validated and queued requests keep their original provider',t=>{
 const {dir,store}=fixture(t);assert.equal(selectedProvider(store),'codex');assert.throws(()=>setProvider(store,'shell'));setProvider(store,'claude');
 const task=store.create({title:'Read',workspacePath:dir});const analysis=queueAnalysis(task.id,task.version,'Read only',store),sync=queueSync(store),chat=queueTaskChat(task.id,task.version,store);
 setProvider(store,'codex');assert.equal(analysis.provider,'claude');assert.equal(sync.provider,'claude');assert.equal(chat.provider,'claude');assert.equal(analysis.cwd,dir);
 assert.equal(controlSnapshot(store).selectedProvider,'codex');assert.deepEqual(controlSnapshot(store).providers,providers);
});
test('Claude restricts initial and resumed tools and rejects unexpected tool inventory',()=>{
 assert.ok(claudeArgs().includes('--restricted'));assert.ok(claudeArgs().includes('--safe-mode'));assert.ok(claudeArgs().includes('Read,Glob,Grep'));
 assert.match(resumeCommand("/tmp/a'b",'11111111-1111-1111-1111-111111111111'),/--strict-mcp-config/);assert.throws(()=>resumeCommand('/tmp',';bad'));
 assert.match(claudeEvent({type:'system',subtype:'init',tools:['Bash']}).error,/outside/);
});
test('an existing Codex link does not block a separate Claude context session',t=>{
 const {store}=fixture(t);const task=store.create({title:'Linked context',chatUrl:'codex://threads/11111111-1111-1111-1111-111111111111'});
 setProvider(store,'claude');const first=queueTaskChat(task.id,task.version,store);
 assert.equal(first.provider,'claude');assert.equal(first.status,'queued');
 assert.equal(queueTaskChat(task.id,task.version,store).id,first.id);
 assert.equal(store.get(task.id).chatUrl,task.chatUrl);
 setProvider(store,'codex');assert.equal(queueTaskChat(task.id,task.version,store).chatUrl,task.chatUrl);
});
test('explicit provider selection or an AI request reenables AI after manual setup',t=>{
 const {dir,store}=fixture(t);const task=store.create({title:'Manual task',workspacePath:dir});
 store.saveControlState(state=>({...state,setup:{aiEnabled:false}}));
 setProvider(store,'claude');assert.equal(store.controlState().setup.aiEnabled,true);
 store.saveControlState(state=>({...state,setup:{aiEnabled:false}}));
 queueAnalysis(task.id,task.version,'Read only',store);assert.equal(store.controlState().setup.aiEnabled,true);
 assert.equal(store.get(task.id).title,'Manual task');assert.equal(store.get(task.id).status,'todo');
});
test('runner requires successful terminal output; handles malformed, error and missing results',async()=>{
 const success=startProviderRun({provider:'claude',prompt:'test',cwd:tmpdir(),spawn:scriptSpawn(`console.log(${JSON.stringify(init)});console.log(${JSON.stringify(reply)})`)});assert.equal((await success.done).text,'Verified result');
 for(const script of ["console.log('not json')","console.log('null')",'console.log(JSON.stringify({type:"assistant",message:{content:{}}}))','console.log(JSON.stringify({type:"result",subtype:"success",result:{unexpected:true}}))','console.log(JSON.stringify({type:"assistant",message:{content:[{type:"text",text:"partial"}]}}))','console.log(JSON.stringify({type:"result",subtype:"error",is_error:true,result:"denied"}))',`console.log(${JSON.stringify(reply)});process.exitCode=1`]) {
  const run=startProviderRun({provider:'claude',prompt:'test',cwd:tmpdir(),spawn:scriptSpawn(script),killGraceMs:10});await assert.rejects(run.done);
 }
});
test('cancellation and timeout cannot complete a run',async()=>{
 const script='setInterval(()=>{},1000)';
 const cancelled=startProviderRun({provider:'claude',prompt:'test',cwd:tmpdir(),spawn:scriptSpawn(script),killGraceMs:10});cancelled.cancel();await assert.rejects(cancelled.done,/interrupted/);
 const timed=startProviderRun({provider:'claude',prompt:'test',cwd:tmpdir(),spawn:scriptSpawn(script),timeoutMs:20,killGraceMs:10});await assert.rejects(timed.done,/time limit/);
});
test('spawn errors fail explicitly',async()=>{
 const run=startProviderRun({provider:'claude',prompt:'test',cwd:tmpdir(),spawn:(_c,a,o)=>realSpawn('/nonexistent/forma-cli',a,o)});await assert.rejects(run.done,/ENOENT/);
});
test('Claude sync preserves tasks and last successful checks while recording gaps',async t=>{
 const {store}=fixture(t);store.ingest({tasks:[{sourceKey:'s',title:'Existing'}],sources:{slack:{status:'checked',checkedAt:'2026-01-01T00:00:00Z',detail:'previous'}}});setProvider(store,'claude');
 const cmd=queueSync(store);await new ClaudeRuntime(store).dispatch(cmd);assert.equal(store.list().length,1);assert.equal(store.snapshot().sources.slack.status,'unavailable');assert.equal(store.snapshot().sources.slack.lastSuccessfulAt,'2026-01-01T00:00:00Z');assert.equal(store.snapshot().sources.slack.checkedAt,null);assert.equal(store.controlState().commands[0].status,'completed');
});
test('Claude lifecycle persists result and restart never retries lost work',async t=>{
 const {dir,store}=fixture(t);setProvider(store,'claude');const task=store.create({title:'Read',workspacePath:dir});const cmd=queueAnalysis(task.id,task.version,'Read only',store);
 const runtime=new ClaudeRuntime(store,{check:async()=>{},start:options=>startProviderRun({...options,spawn:scriptSpawn(`console.log(${JSON.stringify(init)});console.log(${JSON.stringify(reply)})`)})});await runtime.dispatch(cmd);await Promise.allSettled([...runtime.runs.values()].map(run=>run.done));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(store.controlState().agents[0].status,'review');assert.equal(store.get(task.id).status,'todo');
 store.saveControlState(state=>{state.agents[0].status='running';state.commands[0].status='submitted';return state;});recoverClaudeRuns(store);assert.equal(store.controlState().agents[0].status,'unknown');assert.equal(store.controlState().commands[0].status,'failed');
});
test('cancel kills a process group including a descendant that ignores SIGTERM',async t=>{
 const {dir}=fixture(t);const file=join(dir,'heartbeat');
 const grandchild=`const fs=require('fs');process.on('SIGTERM',()=>{});fs.writeFileSync(${JSON.stringify(file)},String(Date.now()));console.log(JSON.stringify({type:'assistant',message:{content:[{type:'text',text:'ready'}]}}));setInterval(()=>fs.writeFileSync(${JSON.stringify(file)},String(Date.now())),10)`;
 const script=`const {spawn}=require('child_process');process.on('SIGTERM',()=>{});spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'inherit'});setInterval(()=>{},1000)`;
 let ready;const started=new Promise(resolve=>{ready=resolve;});
 const run=startProviderRun({provider:'claude',cwd:dir,prompt:'test',spawn:scriptSpawn(script),killGraceMs:30,onUpdate:()=>ready()});
 await started;await new Promise(resolve=>setTimeout(resolve,70));run.cancel();await assert.rejects(run.done,/interrupted/);
 const {readFileSync}=await import('node:fs');const before=readFileSync(file,'utf8');await new Promise(resolve=>setTimeout(resolve,80));assert.equal(readFileSync(file,'utf8'),before);
});
test('Claude rejects a successful result without an initial tool inventory',async()=>{
 const run=startProviderRun({provider:'claude',prompt:'test',cwd:tmpdir(),spawn:scriptSpawn(`console.log(${JSON.stringify(reply)})`)});await assert.rejects(run.done,/successful result/);
});
