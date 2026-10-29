"use client";

import type { ReactNode } from "react";
import { Check, CircleX, RefreshCw } from "@/components/icons";
import { syncPresentation } from "./sync-status.mjs";
import styles from "./task-row.module.css";

// Adapted from Beautiful UI TaskRows at 44a274e598395ab61e7c96c26fda2758780253b7.
// Keep saved task state and independent controls instead of the demo sequence.
export function BeautifulTaskRow({ done, children }: { done: boolean; children: ReactNode }) {
  return <li className={`task-row ${styles.row}${done ? " is-done" : ""}`}>{children}</li>;
}

export function TaskCompletion({ done, disabled, title, onChange }: { done: boolean; disabled: boolean; title: string; onChange: (value: boolean) => void }) {
  return <button type="button" role="checkbox" aria-checked={done} aria-label={`${done ? "Reopen" : "Complete"} ${title}`} disabled={disabled} className={styles.completion} onClick={() => onChange(!done)}>
    <span className={`${styles.ring}${done ? ` ${styles.checked}` : ""}`} aria-hidden="true">{done && <Check size={13} />}</span>
  </button>;
}

export function TaskStatusPill({ status, label }: { status: string; label: string }) {
  return <span className={styles.pill} data-tone={status === "done" ? "done" : status === "in_progress" ? "active" : "idle"}>{label}</span>;
}

export function SyncStatus({ status, pending, error }: { status?: string; pending: boolean; error?: string }) {
  const state = syncPresentation(status, pending, error);
  return <section className={styles.sync} data-tone={state.tone} aria-label="Source sync status" role={state.tone === "failed" ? "alert" : "status"}>
    <span className={`${styles.ring} ${styles.syncRing}`} aria-hidden="true" data-tone={state.tone}>
      {state.tone === "done" ? <Check size={14} /> : state.tone === "failed" ? <CircleX size={16} /> : <RefreshCw size={14} />}
    </span>
    <div className={styles.syncCopy}><h3>{state.label}</h3><p>{state.detail}</p></div>
    <span className={styles.pill} data-tone={state.tone}>{state.tone === "active" ? "Working" : state.tone === "done" ? "Updated" : state.tone === "failed" ? "Needs attention" : "Idle"}</span>
  </section>;
}
