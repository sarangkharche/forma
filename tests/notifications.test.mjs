import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../lib/store.mjs';
import { notificationEvents, ensureState, runNotifications, validateSubscription } from '../lib/notifications.mjs';
const task = { id:'a', title:'Private task title', priority:'high', status:'todo', createdAt:'2026-10-07T08:05:00Z', dueDate:'2026-10-06' };
test('London reminders use summer and winter time and expire after 30 minutes', () => {
 assert.equal(notificationEvents([task], '2026-10-08', new Date('2026-10-07T08:10:00Z'))[0].tag,'forma-morning');
 assert.equal(notificationEvents([task], '2026-10-08', new Date('2026-12-07T09:10:00Z'))[0].tag,'forma-morning');
 assert.equal(notificationEvents([task], '2026-10-08', new Date('2026-10-07T16:00:00Z'))[0].tag,'forma-evening');
 assert.equal(notificationEvents([task], '2026-10-08', new Date('2026-10-07T08:40:00Z')).length,0);
});
test('closed tasks and preexisting high priority tasks do not generate alerts', () => {
 assert.equal(notificationEvents([{...task,status:'done'}], '2026-10-01',new Date('2026-10-07T08:10:00Z')).length,0);
 assert.equal(notificationEvents([task], '2026-10-07T08:06:00Z',new Date('2026-10-07T12:00:00Z')).length,0);
});
test('push payload uses counts rather than task details', () => {
 const events=notificationEvents([task], '2026-10-01',new Date('2026-10-07T08:10:00Z'));
 assert.equal(events.length,2); assert.ok(!JSON.stringify(events).includes(task.title)); assert.match(events[0].body,/1 due or overdue/);
});
test('subscriptions reject local, spoofed and unsupported endpoints', () => {
 for (const endpoint of ['http://localhost:5184','https://fcm.googleapis.com.evil.test/x','https://127.0.0.1/x']) assert.throws(()=>validateSubscription({endpoint}));
});
async function isolated(work) { const dir=mkdtempSync(join(tmpdir(),'forma-push-'));const store=createStore(dir,{seed:false});try { await work(store); } finally {store.close();rmSync(dir,{recursive:true,force:true});} }
function recipient(store) { ensureState(store); store.saveNotificationState(s=>{s.subscriptions.browser={subscription:{endpoint:'https://fcm.googleapis.com/test'},enabledAt:'2026-10-01T00:00:00Z'};return s;}); }
test('successful delivery is deduplicated and later high tasks still notify',async()=>isolated(async store=>{
 recipient(store); store.create({title:'First',priority:'high'});let calls=0;const send=async()=>{calls++;};
 await runNotifications(store,send,new Date('2026-10-07T12:00:00Z'));await runNotifications(store,send,new Date('2026-10-07T12:01:00Z'));assert.equal(calls,1);
 store.create({title:'Second',priority:'high'});await runNotifications(store,send,new Date('2026-10-07T12:02:00Z'));assert.equal(calls,2);
}));
test('failed sends remain eligible and expired subscriptions are removed',async()=>isolated(async store=>{
 recipient(store);store.create({title:'Task',priority:'high'});
 await runNotifications(store,async()=>{throw new Error('network');},new Date('2026-10-07T12:00:00Z'));assert.deepEqual(store.notificationState().delivered,{});
 let calls=0;await runNotifications(store,async()=>{calls++;},new Date('2026-10-07T12:01:00Z'));assert.equal(calls,1);
 await runNotifications(store,async()=>{const e=new Error('gone');e.statusCode=410;throw e;},new Date('2026-10-07T16:00:00Z'));assert.equal(Object.keys(store.notificationState().subscriptions).length,0);
}));
test('new review results notify once and acknowledged results do not notify',async()=>isolated(async store=>{
 recipient(store);const task=store.create({title:'Private research'});
 store.saveControlState(state=>{state.agents=[{id:'chat',turnId:'turn',taskId:task.id,title:task.title,managed:true,status:'review',updatedAt:'2026-10-07T11:00:00Z'}];return state;});
 let calls=0;await runNotifications(store,async(_recipient,payload)=>{calls++;assert.ok(!payload.includes(task.title));},new Date('2026-10-07T12:00:00Z'));
 await runNotifications(store,async()=>{calls++;},new Date('2026-10-07T12:01:00Z'));assert.equal(calls,1);
 store.saveControlState(state=>{state.reviewed['chat:turn:review']='now';return state;});
 assert.equal(notificationEvents(store.list(),'2026-10-01',new Date('2026-10-07T12:00:00Z'),store.controlState()).length,0);
}));
