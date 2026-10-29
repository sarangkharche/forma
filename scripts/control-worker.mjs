import { attachTaskChat, FORMA_CHAT_WORKSPACE } from '../lib/task-chat.mjs';
import { taskBrief } from '../lib/control.mjs';
import { startSyncRun } from '../lib/sync-runner.mjs';
import { CodexBridge } from '../lib/codex-bridge.mjs';
import { getStore } from '../lib/store.mjs';
import { mkdirSync, readdirSync, unlinkSync, statSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
const store = getStore(), bridge = new CodexBridge(), syncRuns = new Set();
let running = false, stopped = false;
store.saveControlState(state => { for (const command of state.commands) if (command.status === 'processing' || (command.type === 'sync' && command.status === 'submitted')) { command.status = 'failed'; command.error = 'Worker restarted during this request. Check Codex before retrying.'; } return state; });
function amend(id, changes) { store.saveControlState(state => { const command = state.commands.find(c => c.id === id); if (command) Object.assign(command, changes); return state; }); }
async function tick() {
  if (running || stopped) return; running = true;
  try {
    const commands = store.controlState().commands.filter(c => c.status === 'queued');
    for (const command of commands) {
      if (store.controlState().commands.find(c=>c.id===command.id)?.status !== 'queued') continue;
      amend(command.id,{status:'processing'});
      try {
        if (command.type === 'sync') {
          const child = startSyncRun(store,command,FORMA_CHAT_WORKSPACE); syncRuns.add(child); child.on('close',()=>syncRuns.delete(child));
        } else if (command.type === 'chat') {
          const task = store.get(command.taskId);
          if (task.chatUrl) { amend(command.id,{status:'completed',chatUrl:task.chatUrl}); continue; }
          const created = command.threadId ? await bridge.call('thread/resume',{threadId:command.threadId,cwd:command.cwd}) : await bridge.call('thread/start',{cwd:command.cwd,sandbox:'read-only',approvalPolicy:'never',developerInstructions:'This chat holds Forma task context for the user. Do not perform the task or modify files or external records unless the user explicitly requests it.'});
          amend(command.id,{threadId:created.thread.id});
          await bridge.call('turn/start',{threadId:created.thread.id,input:[{type:'text',text:`${task.title}\n\nForma task context. Do not start work. Briefly acknowledge this context and wait for the user.\n\n${taskBrief(task,store.activity(task.id))}`}]});
          const linked = attachTaskChat(task.id,created.thread.id,store);
          amend(command.id,{status:'completed',chatUrl:linked.chatUrl,completedAt:new Date().toISOString()});
        } else if (command.type === 'start') {
          const created = await bridge.call('thread/start',{ cwd:command.cwd, sandbox:'read-only', approvalPolicy:'never', developerInstructions:'Perform read only analysis. Do not modify files, send messages, update external records, merge, deploy or change access. Return findings for review.' });
          amend(command.id,{threadId:created.thread.id});
          const result = await bridge.call('turn/start',{threadId:created.thread.id,input:[{type:'text',text:command.text}]});
          amend(command.id,{status:'submitted',turnId:result.turn.id});
          store.saveControlState(state => { state.agents = [{id:created.thread.id,title:store.get(command.taskId).title,taskId:command.taskId,managed:true,status:'running',turnId:result.turn.id,updatedAt:new Date().toISOString(),cwd:command.cwd,result:''},...state.agents.filter(a=>a.id!==created.thread.id)];return state; });
        } else if (command.type === 'interrupt') {
          await bridge.call('turn/interrupt',{threadId:command.threadId,turnId:command.turnId});amend(command.id,{status:'submitted'});
        }
      } catch (error) { amend(command.id,{status:'failed',error:error.message.slice(0,500)}); }
    }
    const listed = await bridge.call('thread/list',{limit:40,sortKey:'updated_at',useStateDbOnly:true});
    const previous = store.controlState();
    for (const command of previous.commands.filter(c => c.type === 'chat' && c.status === 'completed' && c.threadId)) {
      const turns = await bridge.call('thread/turns/list', { threadId: command.threadId, limit: 1, sortDirection: 'desc', itemsView: 'summary' });
      if (['completed', 'failed', 'interrupted'].includes(turns.data[0]?.status)) {
        await bridge.call('thread/unsubscribe', { threadId: command.threadId });
      }
    }
    const managed = new Map(previous.agents.filter(a=>a.managed).map(a=>[a.id,a]));
    const threads = new Map(listed.data.map(t=>[t.id,t]));
    const linked = new Set(store.list().flatMap(t=>[t.chatUrl,...(t.relatedChats||[])].filter(Boolean).map(url=>url.split('/').at(-1))));
    for (const id of new Set([...managed.keys(),...linked,...previous.commands.map(command=>command.threadId).filter(Boolean)])) if (!threads.has(id)) { try { const result=await bridge.call('thread/read',{threadId:id,includeTurns:false});threads.set(id,result.thread); } catch { /* Keep any managed record marked stale below. */ } }
    const agents = [];
    for (const thread of threads.values()) {
      const existing=managed.get(thread.id);
      const agent={...existing,id:thread.id,title:existing?.title || thread.name || thread.preview.slice(0,100) || 'Untitled chat',cwd:thread.cwd,updatedAt:new Date(thread.updatedAt*1000).toISOString(),managed:Boolean(existing),status:'saved',evidence:'Saved chat metadata. Desktop live status is not available through this connection.',result:existing?.result || ''};
      if (existing) {
        try {
          const turns=await bridge.call('thread/turns/list',{threadId:thread.id,limit:1,sortDirection:'desc',itemsView:'summary'});
          const turn=turns.data[0];agent.turnId=turn?.id || existing.turnId;
          agent.status=turn?.status==='completed'?'review':turn?.status==='failed'?'failed':turn?.status==='interrupted'?'interrupted':thread.status.type==='active'?'running':'unknown';
          agent.evidence=`Codex reported ${turn?.status || thread.status.type}.`;
          if (agent.status === 'running' && agent.turnId) {
            const messages = await bridge.call('thread/items/list',{threadId:thread.id,turnId:agent.turnId,limit:30,sortDirection:'desc'});
            const updates = messages.data.map(entry=>entry.item || entry).filter(item=>item.type==='agentMessage');
            agent.progress = updates.reverse().map(item=>item.text).filter(Boolean).join('\n\n');
          }
          if (['review','failed','interrupted'].includes(agent.status)) {
            const messages=await bridge.call('thread/items/list',{threadId:thread.id,turnId:agent.turnId,limit:30,sortDirection:'desc'});
            agent.result=messages.data.map(entry=>entry.item || entry).find(item=>item.type==='agentMessage' && item.phase==='final_answer')?.text || agent.result || turn?.error?.message || '';
            await bridge.call('thread/unsubscribe', { threadId: thread.id });
          }
        } catch { agent.status='unknown';agent.evidence='Could not refresh this run. Open Codex to check it.'; }
      }
      agents.push(agent);
    }
    for (const [id, agent] of managed) if (!threads.has(id)) agents.push({...agent,status:'unknown',evidence:'Could not refresh this run.'});
    store.saveControlState(state=>{state.agents=agents;state.workerAt=new Date().toISOString();state.connected=true;state.connectionError=null;return state;});

  } catch (error) { store.saveControlState(state=>{state.workerAt=new Date().toISOString();state.connected=false;state.connectionError=error.message.slice(0,500);return state;});bridge.close(); }
  finally {
    try {
    const previousBackup = store.controlState().backup;
    if (!previousBackup?.at || Date.now()-Date.parse(previousBackup.at)>86400000) {
      const dir=join(process.env.TODOS_DATA_DIR || join(process.cwd(),'.todos'),'backups');mkdirSync(dir,{recursive:true,mode:0o700});
      const file=join(dir,`tasks-${new Date().toISOString().replaceAll(':','-')}.sqlite`);await store.backupTo(file);chmodSync(file,0o600);
      const files=readdirSync(dir).filter(f=>f.startsWith('tasks-')&&f.endsWith('.sqlite')).sort();
      for (const old of files.slice(0,-7)) { const path=join(dir,old);if(statSync(path).isFile())unlinkSync(path); }
      store.saveControlState(state=>{state.backup={at:new Date().toISOString(),path:file};state.backupError=null;return state;});
    }
    } catch (error) { store.saveControlState(state=>{state.backupError=error.message.slice(0,500);return state;}); }
    running=false;
  }
}
await tick();const timer=setInterval(tick,15000);
function stop(){stopped=true;for(const child of syncRuns) child.kill();clearInterval(timer);bridge.close();store.close();process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
