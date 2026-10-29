import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../lib/store.mjs';
import { ensureInbox,refreshInbox,inboxSnapshot,inboxAction,setPreferences,isQuiet } from '../lib/notification-centre.mjs';
import { ensureState,runNotifications } from '../lib/notifications.mjs';
function fixture(t){const directory=mkdtempSync(join(tmpdir(),'forma-inbox-')),store=createStore(directory,{seed:false});t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});return {store,directory};}
const now=new Date('2027-10-15T12:00:00Z');
test('inactivity produces persistent reminders without browser subscribers and snooze survives restart',t=>{
 const {store,directory}=fixture(t);const task=store.create({title:'Recorded action'});ensureInbox(store,now);const inbox=refreshInbox(store,now),item=inbox.items.find(item=>item.taskId===task.id);assert.equal(item.reason,'inactive');assert.match(item.body,/No progress recorded/);
 inboxAction(store,item.id,'snooze',now);const other=createStore(directory,{seed:false});try{assert.equal(other.inboxState().items[0].snoozedUntil,'2027-10-15T13:00:00.000Z');assert.equal(inboxSnapshot(other,now).unread,0);}finally{other.close();}
 assert.equal(refreshInbox(store,new Date('2027-10-15T12:30:00Z')).items.length,1);
});
test('source refresh does not pretend that the user has worked on a task',t=>{
 const {store}=fixture(t);store.ingest({tasks:[{sourceKey:'s',title:'Action'}]});const task=store.list()[0];store.ingest({tasks:[{sourceKey:'s',title:'Action',notes:'Fresh source context'}]});
 assert.equal(refreshInbox(store,now).items.find(item=>item.taskId===task.id).reason,'inactive');
});
test('completed and archived tasks resolve existing reminders',t=>{
 const {store}=fixture(t);const task=store.create({title:'Action'});refreshInbox(store,now);store.update(task.id,{status:'done'},task.version);assert.equal(inboxSnapshot(store,now).unread,0);
});
test('quiet hours respect London time including daylight saving and crossing midnight',()=>{
 const preferences={quietStart:'22:00',quietEnd:'08:00'};
 assert.equal(isQuiet(preferences,new Date('2026-10-07T21:30:00Z')),true);
 assert.equal(isQuiet(preferences,new Date('2026-12-07T21:30:00Z')),false);
 assert.equal(isQuiet(preferences,new Date('2026-12-07T07:59:00Z')),true);
});
test('failed delivery persists and backs off while quiet hours defer transport only',async t=>{
 const {store}=fixture(t);store.create({title:'Private title',dueDate:'2027-10-15'});ensureState(store);store.saveNotificationState(state=>{state.subscriptions.browser={subscription:{endpoint:'https://fcm.googleapis.com/test'},enabledAt:'2026-10-01'};return state;});
 let calls=0;const fail=async()=>{calls++;throw new Error('offline');};await runNotifications(store,fail,now);await runNotifications(store,fail,new Date(now.getTime()+15000));assert.equal(calls,1);assert.equal(store.inboxState().items.length,1);assert.equal(Object.values(store.inboxState().deliveries)[0].status,'failed');
 await runNotifications(store,async(_recipient,payload)=>{calls++;assert.ok(!payload.includes('Private title'));},new Date(now.getTime()+60000));assert.equal(calls,2);assert.equal(Object.values(store.inboxState().deliveries)[0].status,'accepted');
 await runNotifications(store,async()=>{calls++;},new Date(now.getTime()+120000));assert.equal(calls,2);
});
test('read or dismissed reminders do not enter browser delivery and contextual alerts obey the daily limit',async t=>{
 const {store}=fixture(t);for(let i=0;i<5;i++)store.create({title:`Task ${i}`,dueDate:'2027-10-15'});ensureState(store);store.saveNotificationState(state=>{state.subscriptions.browser={subscription:{endpoint:'https://fcm.googleapis.com/test'},enabledAt:'2026-10-01'};return state;});const items=refreshInbox(store,now).items;
 inboxAction(store,items[0].id,'read',now);inboxAction(store,items[1].id,'dismiss',now);setPreferences(store,{maxDaily:2});let calls=0;await runNotifications(store,async()=>{calls++;},now);assert.equal(calls,2);assert.equal(store.inboxState().items.length,5);
});
test('meeting changes and cancellations invalidate earlier reminders and personal calendar data is rejected',t=>{
 const {store}=fixture(t);store.configureCalendar('user@example.com');const meeting={sourceKey:'meeting:1',accountEmail:'user@example.com',source:'google-calendar:work',title:'Work meeting',startAt:'2027-10-15T12:10:00Z',endAt:'2027-10-15T12:40:00Z',url:'https://calendar.google.com/calendar/event?eid=example'};
 assert.throws(()=>store.ingest({tasks:[],meetings:[{...meeting,accountEmail:'personal@gmail.com'}]}),/configured work/);
 store.ingest({tasks:[],meetings:[meeting]});assert.equal(inboxSnapshot(store,now).unread,1);store.ingest({tasks:[],meetings:[{...meeting,cancelled:true}]});assert.equal(inboxSnapshot(store,now).unread,0);
});
test('bounded authoritative calendar refresh removes meetings absent from that same source window',t=>{
 const {store}=fixture(t);store.configureCalendar('work@example.com');const meeting={sourceKey:'m',accountEmail:'work@example.com',source:'work',title:'Meeting',startAt:'2027-10-15T12:10:00Z',endAt:'2027-10-15T12:40:00Z',url:'https://calendar.google.com'};
 store.ingest({tasks:[],meetings:[meeting]});store.ingest({tasks:[],meetings:[],meetingWindow:{source:'work',start:'2027-10-15T00:00:00Z',end:'2027-10-16T00:00:00Z'}});assert.equal(store.meetings().length,0);
});
test('invalid meeting data rolls back the entire ingestion batch',t=>{
 const {store}=fixture(t);assert.throws(()=>store.ingest({tasks:[{sourceKey:'x',title:'Must not save'}],meetings:[{sourceKey:'broken'}]}));assert.equal(store.list().length,0);
});
test('unchanged source failures do not create fresh alerts every scan, but recovery resets the incident',t=>{
 const {store}=fixture(t);const source={status:'unavailable',checkedAt:now.toISOString(),detail:'Work account missing'};
 store.ingest({tasks:[],sources:{calendar:source}});assert.equal(refreshInbox(store,now).items.length,1);
 store.ingest({tasks:[],sources:{calendar:{...source,checkedAt:new Date(now.getTime()+900000).toISOString()}}});assert.equal(refreshInbox(store,new Date(now.getTime()+900000)).items.length,1);
 store.ingest({tasks:[],sources:{calendar:{...source,status:'checked'}}});assert.equal(inboxSnapshot(store,now).unread,0);
 store.ingest({tasks:[],sources:{calendar:source}});assert.equal(inboxSnapshot(store,now).unread,1);assert.equal(store.inboxState().items.length,2);
});
test('quiet hours keep inbox entries and waking after a meeting does not send expired alerts',async t=>{
 const {store}=fixture(t);store.configureCalendar('work@example.com');store.ingest({tasks:[],meetings:[{sourceKey:'m',accountEmail:'work@example.com',source:'work',title:'Late meeting',startAt:'2027-10-15T22:10:00Z',endAt:'2027-10-15T22:40:00Z',url:'https://calendar.google.com'}]});
 ensureState(store);store.saveNotificationState(state=>{state.subscriptions.browser={subscription:{endpoint:'https://fcm.googleapis.com/test'},enabledAt:'2026-10-01'};return state;});let calls=0;
 await runNotifications(store,async()=>{calls++;},new Date('2027-10-15T22:00:00Z'));assert.equal(calls,0);assert.equal(store.inboxState().items.length,1);
 await runNotifications(store,async()=>{calls++;},new Date('2027-10-16T08:00:00Z'));assert.equal(calls,0);
});
test('a preferences change cancels pending contextual reminders',t=>{
 const {store}=fixture(t);store.create({title:'Task',dueDate:'2027-10-15'});assert.equal(inboxSnapshot(store,now).unread,1);setPreferences(store,{adaptive:false});assert.equal(inboxSnapshot(store,now).unread,0);
});
test('recording progress clears inactivity reminders and survives more than 100 source updates',t=>{
 const {store}=fixture(t);store.ingest({tasks:[{sourceKey:'task',title:'Action'}]});const task=store.list()[0];assert.equal(inboxSnapshot(store,now).unread,1);
 store.recordProgress(task.id,now);for(let i=0;i<105;i++)store.ingest({tasks:[{sourceKey:'task',title:'Action',notes:`Source ${i}`} ]});assert.equal(store.lastProgress(task.id),now.toISOString());assert.equal(inboxSnapshot(store,new Date(now.getTime()+60000)).unread,0);
});
test('explicit snooze schedules another alert after delivery without repeated sends in between',async t=>{
 const {store}=fixture(t);store.create({title:'Task',dueDate:'2027-10-15'});ensureState(store);store.saveNotificationState(state=>{state.subscriptions.browser={subscription:{endpoint:'https://fcm.googleapis.com/test'},enabledAt:'2026-10-01'};return state;});let calls=0;const send=async()=>{calls++;};
 await runNotifications(store,send,now);assert.equal(calls,1);const item=store.inboxState().items[0];inboxAction(store,item.id,'snooze',now);
 await runNotifications(store,send,new Date(now.getTime()+1800000));assert.equal(calls,1);await runNotifications(store,send,new Date(now.getTime()+3600000));assert.equal(calls,2);await runNotifications(store,send,new Date(now.getTime()+3660000));assert.equal(calls,2);
});
