export type TaskStatus = "todo" | "in_progress" | "waiting" | "done" | "archived";
export type Priority = "high" | "normal" | "low";
export interface TaskLink { label: string; url: string }
export interface Task {
  id: string; sourceKey: string; title: string; notes: string; category: string;
  status: TaskStatus; priority: Priority; dueDate: string | null;
  links: TaskLink[]; origin: string; createdAt: string; updatedAt: string;
  completedAt: string | null; version: number; manualFields: string[];
  objective?: string; constraints?: string; completionCriteria?: string; nextStep?: string; workspacePath?: string; responsibility?: 'your_turn' | 'agent' | 'waiting' | 'review'; relatedChats?: string[]; artifacts?: string[];
  sourceUpdates?: { id: string; createdAt: string; changes: { field: string; before: unknown; after: unknown }[] }[]; sourceUpdatesReadId?: string;
  sourceNotes?: string; sourceLinks?: TaskLink[]; chatUrl?: string | null;
}
export interface SyncState {
  lastCheckedAt: string | null; lastChangedAt: string | null;
  automationId: string | null; schedule: string | null; message: string;
}
export interface SourceCoverage { status: "checked" | "limited" | "unavailable"; checkedAt: string | null; lastAttemptAt?: string | null; lastSuccessfulAt?: string | null; lastCheckedAt?: string | null; detail: string }
export interface Snapshot { tasks: Task[]; sync: SyncState; sources?: Record<string, SourceCoverage> }
