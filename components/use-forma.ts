'use client';
import { useCallback, useEffect, useReducer, useRef, type Reducer } from 'react';
import { useToastStack } from '@/components/arc/toast-stack/toast-stack';
import type { Snapshot, Task } from '@/lib/types';
import { taskStateReducer } from '@/lib/client-state.mjs';
const initial:Snapshot={tasks:[],sync:{lastCheckedAt:null,lastChangedAt:null,automationId:null,schedule:null,message:'Loading your tasks.'}};
interface State { snapshot:Snapshot;phase:string;error:string;message:string;pending:Record<string,{before?:Task}> }
export function useForma() {
  const { toast, update } = useToastStack();
  const [state,dispatch]=useReducer(taskStateReducer as Reducer<State, {type:string;[key:string]:unknown}>,{snapshot:initial,phase:'loading',error:'',message:'',pending:{}} as State);
  const sequence=useRef(0),pending=useRef(new Set<string>()),request=useRef<AbortController|null>(null),active=useRef(true),createKey=useRef<string|null>(null);
  const refresh=useCallback(async()=>{
    if(pending.current.size)return;
    const token=++sequence.current;request.current?.abort();const controller=new AbortController();request.current=controller;
    try{const response=await fetch('/api/tasks',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Could not load tasks. Your saved data is unchanged.');const snapshot=await response.json();if(active.current&&token===sequence.current&&!pending.current.size)dispatch({type:'loaded',snapshot});}
    catch(error){if(active.current&&!controller.signal.aborted&&token===sequence.current)dispatch({type:'loadFailed',error:(error as Error).message});}
  },[]);
  useEffect(()=>{active.current=true;const frame=requestAnimationFrame(()=>void refresh());const interval=setInterval(()=>{if(!document.hidden)void refresh();},5000);const focus=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',focus);return()=>{active.current=false;cancelAnimationFrame(frame);clearInterval(interval);request.current?.abort();document.removeEventListener('visibilitychange',focus);};},[refresh]);
  const mutate=useCallback(async(task:Task|null,changes:Partial<Task>,message:string)=>{
    const id=task?.id||'new';if(pending.current.has(id))throw new Error('This task is already saving.');pending.current.add(id);sequence.current++;request.current?.abort();
    if(!task)createKey.current ||= crypto.randomUUID();
    const toastId=toast({type:'loading',title:'Saving task…'});
    dispatch({type:'saving',id,optimistic:task&&Object.keys(changes).length===1&&'status'in changes?changes:{}});
    try{const response=await fetch('/api/tasks',{method:task?'PATCH':'POST',headers:{'Content-Type':'application/json',...(!task?{'Idempotency-Key':createKey.current!}:{})},signal:AbortSignal.timeout(15000),body:JSON.stringify(task?{...changes,id,version:task.version}:changes)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save. Your input is still here.');if(!task)createKey.current=null;if(active.current)dispatch({type:'saved',id,task:result,message});update(toastId,{type:'success',title:message,description:result.title,duration:7000,action:{label:'View task',onClick:()=>window.dispatchEvent(new CustomEvent('forma:open-task',{detail:result.id}))}});return result as Task;}
    catch(error){const failure=(error as Error).name==='TimeoutError'?new Error('Save not confirmed. Your input is still here. Retry safely.'):error;if(active.current)dispatch({type:'saveFailed',id,error:(failure as Error).message});update(toastId,{type:'error',title:'Could not save task',description:(failure as Error).message,duration:8000});throw failure;}
    finally{pending.current.delete(id);}
  },[toast,update]);
  return {...state,loaded:state.phase==='ready',busy:Object.keys(state.pending),refresh,mutate,setError:(error:string)=>dispatch({type:'error',error})};
}
