export function taskStateReducer(state, action) {
  switch (action.type) {
    case 'loading': return {...state, phase:state.phase==='ready'?'ready':'loading'};
    case 'loaded': if (Object.keys(state.pending).length) return state; return {...state,snapshot:action.snapshot,phase:'ready',error:''};
    case 'loadFailed': return {...state,phase:state.phase==='ready'?'ready':'error',error:action.error};
    case 'saving': {
      const before=state.snapshot.tasks.find(t=>t.id===action.id);
      return {...state,pending:{...state.pending,[action.id]:{before}},snapshot:{...state.snapshot,tasks:state.snapshot.tasks.map(t=>t.id===action.id?{...t,...action.optimistic}:t)},error:'',message:''};
    }
    case 'saved': {
      const pending={...state.pending};delete pending[action.id];
      return {...state,pending,message:action.message,error:'',snapshot:{...state.snapshot,tasks:action.id==='new'?[...state.snapshot.tasks,action.task]:state.snapshot.tasks.map(t=>t.id===action.id?action.task:t)}};
    }
    case 'saveFailed': {
      const before=state.pending[action.id]?.before,pending={...state.pending};delete pending[action.id];
      return {...state,pending,error:action.error,snapshot:{...state.snapshot,tasks:state.snapshot.tasks.map(t=>t.id===action.id&&before?before:t)}};
    }
    case 'error':return {...state,error:action.error};
    default:return state;
  }
}
