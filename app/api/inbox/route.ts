import { getStore } from '@/lib/store.mjs';
import { isLocalWrite } from '@/lib/local-request.mjs';
import { inboxSnapshot, inboxAction, setPreferences, ensureInbox } from '@/lib/notification-centre.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(){return Response.json(inboxSnapshot(getStore()),{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){
 if(!isLocalWrite(request))return Response.json({error:'Open Forma locally to manage notifications.'},{status:403});
 try{const body=await request.json(),store=getStore();ensureInbox(store);
 if(body.action==='preferences')setPreferences(store,body.preferences);
 else if(body.action==='progress')store.recordProgress(body.taskId);
 else if(body.action==='shown'){
  if(typeof body.token!=='string')throw new Error('Invalid delivery confirmation.');
  store.saveInboxState((state:{deliveries:Record<string,{token:string;status:string;shownAt?:string}>})=>{const item=Object.values(state.deliveries).find(value=>value.token===body.token);if(!item)throw new Error('Delivery not found.');item.status='shown';item.shownAt=new Date().toISOString();return state;});
 }else inboxAction(store,body.id,body.action);
 return Response.json({ok:true});
 }catch(error){return Response.json({error:(error as Error).message},{status:400});}
}
