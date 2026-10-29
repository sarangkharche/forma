"use client";
import { useEffect } from 'react';
import { openCodex } from './open-codex';
import { ToastStack, ToastStackProvider, useToastStack } from "@/components/arc/toast-stack/toast-stack";
function CodexLinks() {
  const { toast } = useToastStack();
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      const url = link?.getAttribute('href');
      if (!url?.startsWith('codex://threads/')) return;
      event.preventDefault();
      void openCodex(url).catch(error => toast({type:'error',title:'Could not open Codex',description:error.message}));
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, [toast]);
  return null;
}
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  return <ToastStackProvider duration={7000} limit={30}><CodexLinks/>{children}<ToastStack label="Action feedback" position="top-right" visibleToasts={5} /></ToastStackProvider>;
}
