import webpush from 'web-push';
import { getStore } from './store.mjs';
import { attentionItems } from './control.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { refreshInbox, isQuiet, londonTime } from './notification-centre.mjs';

export const schedule = { morning: '09:10', evening: '17:00', timeZone: 'Europe/London' };
const idFor = endpoint => createHash('sha256').update(endpoint).digest('hex');
export function validateSubscription(value) {
  const url = new URL(value?.endpoint);
  const allowed = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !allowed.includes(url.hostname)) throw new Error('This browser push service is not supported. Use Chrome, Firefox or Safari.');
  if (!/^[A-Za-z0-9_-]{87}$/.test(value?.keys?.p256dh || '') || !/^[A-Za-z0-9_-]{22}$/.test(value?.keys?.auth || '')) throw new Error('Invalid push subscription keys.');
  return { endpoint: url.href, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
}
export function ensureState(store = getStore()) {
  return store.saveNotificationState(state => state || { keys: webpush.generateVAPIDKeys(), subscriptions: {}, delivered: {}, lastWorkerAt: null, lastError: null });
}
export function subscribe(value, store = getStore(), now = new Date()) {
  const subscription = validateSubscription(value); ensureState(store);
  return store.saveNotificationState(state => {
    const id = idFor(subscription.endpoint);
    state.subscriptions[id] = { ...state.subscriptions[id], subscription, enabledAt: state.subscriptions[id]?.enabledAt || now.toISOString() };
    return state;
  });
}
export function unsubscribe(endpoint, store = getStore()) {
  ensureState(store);
  store.saveNotificationState(state => { delete state.subscriptions[idFor(endpoint)]; return state; });
}
export function notificationEvents(tasks, enabledAt, now = new Date(), control = { agents: [], commands: [] }) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: schedule.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`, minute = Number(parts.hour) * 60 + Number(parts.minute);
  const open = tasks.filter(t => !['done', 'archived'].includes(t.status));
  const events = [];
  for (const [kind, time] of Object.entries({ morning: schedule.morning, evening: schedule.evening })) {
    const [h,m] = time.split(':').map(Number);
    if (minute >= h*60+m && minute < h*60+m+30 && open.length) events.push({ key: `${day}:${kind}`, title: kind === 'morning' ? 'Forma: your morning overview' : 'Forma: wrap up your day', body: `${open.length} unfinished tasks, ${open.filter(t => t.priority === 'high').length} high priority and ${open.filter(t => t.dueDate && t.dueDate <= day).length} due or overdue. Open Forma to review.`, tag: `forma-${kind}` });
  }
  const high = open.filter(t => t.priority === 'high' && t.createdAt > enabledAt);
  if (high.length) events.push({ key: `high:${high.map(t => t.id).sort().join(',')}`, taskIds: high.map(t => t.id), title: 'Forma: high priority tasks', body: `${high.length} new high priority ${high.length === 1 ? 'task needs' : 'tasks need'} your attention. Open Forma to review.`, tag: 'forma-high' });
  for (const item of attentionItems(tasks, control, now.getTime()).filter(item => ['agent', 'command'].includes(item.kind))) {
    const source = item.threadId ? control.agents.find(agent => agent.id === item.threadId) : control.commands.find(command => command.id === item.id);
    if ((source?.updatedAt || source?.createdAt || '') > enabledAt) events.push({ key: `attention:${item.id}`, title: 'Forma: AI needs your attention', body: 'An agent result or request needs your review. Open Forma to check.', tag: 'forma-attention' });
  }
  return events;
}
export async function runNotifications(store = getStore(), send = webpush.sendNotification.bind(webpush), now = new Date()) {
  const state = ensureState(store), inbox = refreshInbox(store,now);
  if (!isQuiet(inbox.preferences,now)) for (const [id,record] of Object.entries(state.subscriptions)) {
    const lastSent = taskId => Math.max(0,...Object.values(inbox.deliveries).filter(value=>value.subscriberId===id&&value.sentAt&&inbox.items.find(item=>item.id===value.itemId)?.taskId===taskId).map(value=>Date.parse(value.sentAt)));
    const candidates=[...inbox.items].sort((a,b)=>lastSent(a.taskId||a.id)-lastSent(b.taskId||b.id)||({high:0,normal:1,low:2}[a.priority]??1)-({high:0,normal:1,low:2}[b.priority]??1));
    for (const item of candidates) {
      if(item.readAt || item.dismissedAt || item.resolvedAt || Date.parse(item.snoozedUntil)>now.getTime() || Date.parse(item.expiresAt)<=now.getTime() || item.createdAt<record.enabledAt)continue;
      const key=`${id}:${item.id}:${item.snoozeCount||0}`,current=store.inboxState(),delivery=current.deliveries[key];
      if(['accepted','shown'].includes(delivery?.status)||Date.parse(delivery?.nextAttemptAt)>now.getTime()||(delivery?.status==='sending'&&now-Date.parse(delivery.startedAt)<30000))continue;
      const sentToday=Object.values(current.deliveries).filter(value=>value.subscriberId===id&&['accepted','shown'].includes(value.status)&&value.contextual&&londonTime(new Date(value.sentAt)).day===londonTime(now).day).length;
      const contextual=!item.snoozeCount&&!['summary','meeting'].includes(item.kind);
      if(contextual&&sentToday>=current.preferences.maxDaily)continue;
      const token=randomUUID(),attempts=(delivery?.attempts||0)+1;
      if(attempts>6)continue;
      store.saveInboxState(value=>{value.deliveries[key]={...delivery,itemId:item.id,subscriberId:id,token,status:'sending',attempts,startedAt:now.toISOString(),contextual};return value;});
      try {
        const payload={title:current.preferences.browserDetails?item.title:'Forma: an update needs your attention',body:current.preferences.browserDetails?item.body:item.kind==='summary'?item.body:'Open Forma to review your latest reminders.',tag:`forma-${item.id}`,id:item.id,deliveryToken:token,renotify:Boolean(item.snoozeCount)};
        await send(record.subscription,JSON.stringify(payload),{vapidDetails:{subject:'https://forma.local',...state.keys},TTL:Math.min(1800,Math.max(1,Math.floor((Date.parse(item.expiresAt)-now.getTime())/1000))),timeout:10000});
        store.saveInboxState(value=>{if(value.deliveries[key].status!=='shown')value.deliveries[key].status='accepted';value.deliveries[key].sentAt=now.toISOString();value.deliveries[key].error=null;return value;});
        store.saveNotificationState(value=>{value.delivered[id] ||= {};value.delivered[id][item.key]=now.toISOString();value.lastError=null;return value;});
      } catch(error) {
        store.saveInboxState(value=>{Object.assign(value.deliveries[key],{status:'failed',error:`Push service rejected or could not confirm this attempt${error.statusCode?` (${error.statusCode})`:''}.`,nextAttemptAt:new Date(now.getTime()+Math.min(3600000,60000*2**(attempts-1))).toISOString()});return value;});
        store.saveNotificationState(value=>{if([404,410].includes(error.statusCode))delete value.subscriptions[id];value.lastError='Browser notification delivery failed. The reminder remains in Forma.';return value;});
        break;
      }
    }
  }
  store.saveNotificationState(current=>{current.lastWorkerAt=now.toISOString();return current;});
}
