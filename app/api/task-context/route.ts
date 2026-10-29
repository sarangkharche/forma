import { getStore } from '@/lib/store.mjs';
import { taskBrief, triageBrief } from '@/lib/control.mjs';
import { isLocalWrite } from '@/lib/local-request.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export function GET(request:Request) {
  try {const id=new URL(request.url).searchParams.get('id'),store=getStore();if(!id)throw new Error('Choose a task.');const task=store.get(id),activity=store.activity(id);return Response.json({activity,brief:taskBrief(task,activity),triageBrief:triageBrief(task,activity)},{headers:{'Cache-Control':'no-store'}});}
  catch(error){return Response.json({error:(error as Error).message},{status:400});}
}
export async function POST(request:Request) {
  if(!request.headers.get('origin')||!isLocalWrite(request))return Response.json({error:'Open Forma locally to record a decision.'},{status:403});
  try {const {taskId,text}=await request.json();return Response.json(getStore().addDecision(taskId,text),{status:201});}
  catch(error){return Response.json({error:(error as Error).message},{status:400});}
}
