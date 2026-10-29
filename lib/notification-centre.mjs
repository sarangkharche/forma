import { randomUUID } from 'node:crypto';
import { attentionItems } from './control.mjs';
export const defaultPreferences = { adaptive:true, inactivityDays:3, cooldownHours:24, maxDaily:3, morning:true, evening:true, quietStart:'22:00', quietEnd:'08:00', meetingLeadMinutes:15, browserDetails:false };
export function ensureInbox(store,now=new Date()) {
 return store.saveInboxState(state=>state || {startedAt:now.toISOString(),preferences:{...defaultPreferences},items:[],deliveries:{},sourceEpisodes:{}});
}
export function londonTime(now) {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 return {day:`${parts.year}-${parts.month}-${parts.day}`,minute:Number(parts.hour)*60+Number(parts.minute)};
}
const minutes=time=>Number(time.slice(0,2))*60+Number(time.slice(3));
export function isQuiet(preferences,now) {const minute=londonTime(now).minute,start=minutes(preferences.quietStart),end=minutes(preferences.quietEnd);return start===end?false:start<end?minute>=start&&minute<end:minute>=start||minute<end;}
export function setPreferences(store,input) {
 const values={};
 for(const [key,value]of Object.entries(input || {})) {
  if(!(key in defaultPreferences))throw new Error('Unknown notification preference.');
  if(typeof defaultPreferences[key]==='boolean'){if(typeof value!=='boolean')throw new Error('Check notification preferences.');}
  else if(['quietStart','quietEnd'].includes(key)){if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('Check quiet hours.');}
  else if(!Number.isInteger(value)||value<1||value>({inactivityDays:30,cooldownHours:168,maxDaily:20,meetingLeadMinutes:60}[key]||0))throw new Error('Check reminder limits.');
  values[key]=value;
 }
 ensureInbox(store);return store.saveInboxState(state=>{Object.assign(state.preferences,values);return state;});
}
function addItem(state,event,now) {if(state.items.some(item=>item.key===event.key))return;state.items.push({id:randomUUID(),...event,createdAt:now.toISOString(),readAt:null,dismissedAt:null,snoozedUntil:null});}
export function refreshInbox(store,now=new Date()) {
 ensureInbox(store,now);const tasks=store.list(),meetings=store.meetings(),control=store.controlState(),sources=store.snapshot().sources || {},{day,minute}=londonTime(now);
 const progress=new Map(tasks.map(task=>[task.id,store.lastProgress(task.id) || task.createdAt]));
 return store.saveInboxState(state=>{
 const preferences={...defaultPreferences,...state.preferences};state.preferences=preferences;
 state.sourceEpisodes ||= {};
 const open=tasks.filter(task=>!['done','archived'].includes(task.status));
 for(const item of state.items) {
  if(item.kind==='summary'&&!preferences[item.key.split(':').at(-1)])item.resolvedAt ||=now.toISOString();
  if(item.kind==='task'&&item.reason!=='high'&&!preferences.adaptive)item.resolvedAt ||=now.toISOString();
  if(item.taskId&&!open.some(task=>task.id===item.taskId))item.resolvedAt ||= now.toISOString();
  if(item.kind==='task'&&item.progressAt&&progress.get(item.taskId)!==item.progressAt)item.resolvedAt ||= now.toISOString();
  if(item.meetingKey&&!meetings.some(meeting=>meeting.sourceKey===item.meetingKey&&!meeting.cancelled&&meeting.startAt===item.meetingStart))item.resolvedAt ||= now.toISOString();
 }
 for(const [kind,time]of Object.entries({morning:550,evening:1020})) if(preferences[kind]&&minute>=time&&minute<time+30&&open.length)addItem(state,{key:`${day}:${kind}`,kind:'summary',title:kind==='morning'?'Your morning overview':'Wrap up your day',body:`${open.length} unfinished tasks. ${open.filter(task=>task.priority==='high').length} are high priority.`,expiresAt:new Date(now.getTime()+1800000).toISOString()},now);
 for(const task of open) {
  if(control.connected && control.workerAt && now-Date.parse(control.workerAt)<90000 && control.agents.some(agent=>agent.taskId===task.id&&agent.managed&&agent.status==='running'))continue;
  const lastProgress=progress.get(task.id),age=Math.max(0,Math.floor((now-Date.parse(lastProgress))/86400000));
  const previous=state.items.filter(item=>item.taskId===task.id&&item.kind==='task').at(-1);
  if(previous&&(now-Date.parse(previous.createdAt)<preferences.cooldownHours*3600000||Date.parse(previous.snoozedUntil)>now.getTime()))continue;
  const waiting=task.status==='waiting'||task.responsibility==='waiting'||task.responsibility==='agent';
  let reason,body;
  if(preferences.adaptive&&task.dueDate&&task.dueDate<day){reason='overdue';body=`The recorded due date was ${task.dueDate}. Review the next step or update the date.`;}
  else if(preferences.adaptive&&task.dueDate===day){reason='due';body='This is due today. Check the next step when you have a moment.';}
  else if(preferences.adaptive&&task.dueDate&&Date.parse(task.dueDate)-Date.parse(day)<=172800000){reason='upcoming';body=`The recorded due date is ${task.dueDate}. Is the next step planned?`;}
  else if(preferences.adaptive&&age>=preferences.inactivityDays){reason='inactive';body=waiting?`No progress recorded for ${age} days. Is it time to follow up?`:`No progress recorded for ${age} days. Could you move this forward or snooze it?`;}
  else if(task.priority==='high'&&task.createdAt>state.startedAt){reason='high';body='A new high priority task needs your attention.';}
  if(reason) { for(const previousItem of state.items.filter(item=>item.kind==='task'&&item.taskId===task.id&&item.key!==`task:${task.id}:${reason}:${day}`))previousItem.resolvedAt ||=now.toISOString();addItem(state,{key:`task:${task.id}:${reason}:${day}`,kind:'task',taskId:task.id,progressAt:lastProgress,reason,priority:task.priority,title:task.title,body,links:task.links,expiresAt:new Date(now.getTime()+86400000).toISOString()},now); }
 }
 for(const meeting of meetings.filter(item=>!item.cancelled)) {
  const start=Date.parse(meeting.startAt),remaining=start-now.getTime();
  if(remaining>preferences.meetingLeadMinutes*60000||remaining< -300000)continue;
  addItem(state,{key:`meeting:${meeting.sourceKey}:${meeting.startAt}`,kind:'meeting',meetingKey:meeting.sourceKey,meetingStart:meeting.startAt,title:meeting.title,body:remaining>0?`Starts in ${Math.ceil(remaining/60000)} minutes.`:'This meeting has just started.',links:[{label:'Open meeting',url:meeting.url}],expiresAt:new Date(start+300000).toISOString()},now);
 }
 for(const item of attentionItems(tasks,control,now.getTime()).filter(item=>['agent','command','stale'].includes(item.kind)))addItem(state,{key:`attention:${item.id}`,kind:'agent',title:item.title,body:item.detail,taskId:item.taskId,links:item.threadId?[{label:'Open in Codex',url:`codex://threads/${item.threadId}`}]:[],expiresAt:new Date(now.getTime()+86400000).toISOString()},now);
 const activeAttention=new Set(attentionItems(tasks,control,now.getTime()).map(item=>`attention:${item.id}`));
 for(const item of state.items.filter(item=>item.kind==='agent'))if(!activeAttention.has(item.key))item.resolvedAt ||=now.toISOString();
 const sourceKeys=new Set();
 for(const [name,source]of Object.entries(sources)) {
  const stale=source.checkedAt&&now-Date.parse(source.checkedAt)>7200000;
  if(source.status==='unavailable'||stale) { const signature=source.status==='unavailable'?'unavailable':'stale';const previous=state.sourceEpisodes[name];if(previous?.signature!==signature)state.sourceEpisodes[name]={signature,episode:(previous?.episode||0)+1};const sourceKey=`source:${name}:${signature}:${state.sourceEpisodes[name].episode}`;sourceKeys.add(sourceKey);addItem(state,{key:sourceKey,kind:'source',title:`${name[0].toUpperCase()+name.slice(1)} ${source.status==='unavailable'?'needs attention':'coverage is stale'}`,body:source.detail,expiresAt:new Date(now.getTime()+86400000).toISOString()},now); } else if(state.sourceEpisodes[name])state.sourceEpisodes[name].signature='healthy';
 }
 for(const item of state.items.filter(item=>item.kind==='source'))if(!sourceKeys.has(item.key))item.resolvedAt ||=now.toISOString();
 // Retain unread/snoozed records. Old handled history may be pruned after 90 days.
 state.items=state.items.filter(item=>!(item.dismissedAt||item.readAt||item.resolvedAt)||now-Date.parse(item.createdAt)<90*86400000);
 return state;
 });
}
export function inboxAction(store,id,action,now=new Date()) {
 return store.saveInboxState(state=>{
 const item=state?.items.find(item=>item.id===id);if(!item)throw new Error('This notification is no longer available.');
 if(action==='read')item.readAt=now.toISOString();
 else if(action==='dismiss')item.dismissedAt=now.toISOString();
 else if(action==='snooze'){item.snoozedUntil=new Date(now.getTime()+3600000).toISOString();item.readAt=null;item.snoozeCount=(item.snoozeCount||0)+1;if(item.kind!=='meeting')item.expiresAt=new Date(Math.max(Date.parse(item.expiresAt),now.getTime()+5400000)).toISOString();}
 else throw new Error('Unknown notification action.');return state;
 });
}
export function inboxSnapshot(store,now=new Date()) {
 const state=refreshInbox(store,now);
 return {now:now.toISOString(),preferences:state.preferences,items:state.items.filter(item=>!item.dismissedAt&&!item.resolvedAt).reverse().map(item=>({...item,delivery:Object.values(state.deliveries).filter(delivery=>delivery.itemId===item.id).map(delivery=>({status:delivery.status,attempts:delivery.attempts,error:delivery.error,nextAttemptAt:delivery.nextAttemptAt}))})),unread:state.items.filter(item=>!item.readAt&&!item.dismissedAt&&!item.resolvedAt&&!(Date.parse(item.snoozedUntil)>now.getTime())).length,meetings:store.meetings().filter(item=>!item.cancelled&&Date.parse(item.endAt)>now.getTime()).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)),sources:store.snapshot().sources||{}};
}
