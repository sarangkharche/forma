import { queueTaskChat } from '@/lib/task-chat.mjs';
import { queueSync } from '@/lib/manual-sync.mjs';
import { getStore } from '@/lib/store.mjs';
import { controlSnapshot, queueAnalysis, queueTriage, cancelQueuedAnalysis } from '@/lib/control.mjs';
import { isLocalWrite } from '@/lib/local-request.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() { return Response.json(controlSnapshot(), { headers: {'Cache-Control':'no-store'} }); }
export async function POST(request: Request) {
  if (!request.headers.get('origin') || !isLocalWrite(request)) return Response.json({error:'Open Forma locally to manage agents.'},{status:403});
  try {
    const body=await request.json(),store=getStore();
    if (body.action==='chat') return Response.json(queueTaskChat(body.taskId,body.version),{status:202});
    if (body.action==='sync') return Response.json(queueSync(store),{status:202});
    if (body.action==='triage') return Response.json(queueTriage(body.taskId,body.version),{status:202});
    if (body.action==='cancelQueued') return Response.json(cancelQueuedAnalysis(body.commandId));
    if (body.action==='start') return Response.json(queueAnalysis(body.taskId,body.version,body.brief),{status:202});
    if (body.action==='review') {
      const current=controlSnapshot();if (!current.attention.some((item: {id:string})=>item.id===body.id)) throw new Error('This attention item changed. Refresh first.');
      store.saveControlState((state: {reviewed:Record<string,string>})=>{state.reviewed[body.id]=new Date().toISOString();return state;});return Response.json({ok:true});
    }
    if (body.action==='interrupt') {
      store.saveControlState((state: {agents:Array<{id:string;managed:boolean;turnId:string;status:string}>;commands:Array<{threadId?:string;type:string;status:string;[key:string]:unknown}>})=>{
        const agent=state.agents.find(a=>a.id===body.threadId && a.managed && a.status==='running');if(!agent) throw new Error('Only an active Forma run can be interrupted.');
        if(state.commands.some(c=>c.type==='interrupt'&&c.threadId===agent.id&&['queued','processing'].includes(c.status))) throw new Error('This interruption is already queued.');
        if(state.commands.filter(c=>c.status==='queued').length>=5) throw new Error('Wait for queued requests to finish.');
        state.commands=state.commands.slice(-99);
        state.commands.push({id:crypto.randomUUID(),type:'interrupt',threadId:agent.id,turnId:agent.turnId,status:'queued',createdAt:new Date().toISOString()});return state;
      });return Response.json({ok:true},{status:202});
    }
    throw new Error('Unknown agent action.');
  } catch(error) {const e=error as Error & {status?:number};return Response.json({error:e.message},{status:e.status||400});}
}
