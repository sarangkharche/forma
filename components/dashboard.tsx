"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useToastStack } from "@/components/arc/toast-stack/toast-stack";
import { FormaMark } from "@/components/forma-mark";
import { useForma } from "@/components/use-forma";
import { useControl, ControlPanel, SourceHealth, TaskContext, TaskChatAction, TaskTriage } from "@/components/control-panel";
import { NotificationInbox, useInbox } from "@/components/notification-inbox";
import { Bell, Pencil, Eye, Archive, ArchiveRestore, ArrowUpRight, Check, CheckCheck, FileText, ChevronRight, Circle, Clock3, Inbox, Plus, RefreshCw, Sparkles, ThemeIcon, X } from "@/components/icons";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/arc/badge/badge";
import { BeautifulTaskRow, TaskCompletion, TaskStatusPill, SyncStatus } from "@/components/beautiful/task-row";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { SearchField } from "@/components/arc/search-field/search-field";
import { Select } from "@/components/arc/select/select";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Drawer, DrawerContent } from "@/components/arc/drawer/drawer";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import type { Priority, Task, TaskLink, TaskStatus } from "@/lib/types";

const statusLabels: Record<TaskStatus, string> = { todo: "To do", in_progress: "In progress", waiting: "Waiting", done: "Done", archived: "Archived" };
const rank: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

const categories = ["All tasks", "Security", "Peak", "Follow ups", "Platform", "Planning", "Personal"];
function dateLabel(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}${y !== 2026 ? ` ${y}` : ""}`;
}
function linkProvider(url: string): [string, string | null, boolean] {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const matches = (domain: string) => host === domain || host.endsWith(`.${domain}`);
    if (parsed.protocol === "codex:") return ["Codex", "openai", true];
    if (matches("slack.com")) return ["Slack", "slack", false];
    if (matches("atlassian.net")) return ["Jira", "jira", false];
    if (matches("github.com")) return ["GitHub", "github", true];
    if (matches("granola.ai")) return ["Granola", "granola", false];
    if (host === "docs.google.com") {
      if (parsed.pathname.startsWith("/spreadsheets/")) return ["Google Sheets", "googlesheets", false];
      if (parsed.pathname.startsWith("/document/")) return ["Google Docs", "googledocs", false];
      if (parsed.pathname.startsWith("/presentation/")) return ["Google Slides", "googleslides", false];
    }
    if (host === "drive.google.com") return ["Google Drive", "googledrive", false];
  } catch { /* Unknown links keep a neutral icon. */ }
  return ["Link", null, false];
}
function hasUnreadUpdates(task: Task) { const latest = task.sourceUpdates?.at(-1); return Boolean(latest && latest.id !== task.sourceUpdatesReadId); }
function linkKind(url: string) { return linkProvider(url)[0]; }
function ServiceLogo({ url }: { url: string }) {
  const [, icon, monochrome] = linkProvider(url);
  if (!icon) return <ArrowUpRight size={16} />;
  const asset = `url("/service-logos/${icon}.svg")`;
  return <span aria-hidden="true" className={`service-logo${monochrome ? " service-logo-mono" : ""}`} style={monochrome ? { maskImage: asset, WebkitMaskImage: asset } : { backgroundImage: asset }} />;
}

export default function Dashboard() {
  const [badgeTime, setBadgeTime] = useState(0);
  useEffect(() => {
    const initial = window.setTimeout(() => setBadgeTime(Date.now()), 0);
    const timer = window.setInterval(() => setBadgeTime(Date.now()), 60000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);
  const { snapshot, loaded, error, message, busy, refresh, mutate, setError } = useForma();
  const control = useControl();
  const { toast, update } = useToastStack();
  const seenTriage = useRef<Set<string> | null>(null);
  const previousAgents = useRef<Map<string,string> | null>(null);
  useEffect(() => {
    if (!control.data) return;
    const agents = control.data.agents.filter(agent => agent.managed && agent.taskId);
    if (previousAgents.current) for (const agent of agents) {
      if (previousAgents.current.get(agent.id) === agent.status) continue;
      if (!["running","failed","interrupted"].includes(agent.status)) continue;
      const action = { label: "View task", onClick: () => { const task = snapshot.tasks.find(task => task.id === agent.taskId); if (task) edit(task); } };
      const options = { type: (agent.status === "running" ? "loading" : agent.status === "failed" ? "error" : "info") as "loading"|"error"|"info", title: agent.status === "running" ? "Codex started" : agent.status === "failed" ? "Codex run failed" : "Codex run cancelled", description: agent.title, action, duration: agent.status === "running" || agent.status === "failed" ? Infinity : 7000 };
      toast({id:`agent:${agent.id}`,...options});
    }
    previousAgents.current = new Map(agents.map(agent => [agent.id,agent.status]));
  }, [control.data,snapshot.tasks,toast,update]);
  useEffect(() => {
    const navigate = (event: Event) => { const id = (event as CustomEvent<string>).detail; const task = snapshot.tasks.find(task => task.id === id); if (task) edit(task); };
    window.addEventListener("forma:open-task", navigate);
    return () => window.removeEventListener("forma:open-task", navigate);
  }, [snapshot.tasks]);

  useEffect(() => {
    if (!control.data) return;
    const ready = control.data.attention.filter(item => item.kind === "agent" && control.data!.agents.some(agent => agent.id === item.threadId && agent.status === "review" && Boolean(agent.result)));
    if (!seenTriage.current) {
      seenTriage.current = new Set(ready.map(item => item.id));
      return;
    }
    for (const item of ready) {
      if (seenTriage.current.has(item.id)) continue;
      seenTriage.current.add(item.id);
      toast({ id: `agent:${item.threadId}`, type: "success", title: "Triage ready", description: item.title, duration: 8000, action: { label: "View result", onClick: () => {
        const task = snapshot.tasks.find(task => task.id === item.taskId);
        if (task) edit(task);
      } } });
    }
  }, [control.data, toast, snapshot.tasks]);
  const inbox = useInbox();
  const [mode, setMode] = useState("tasks");
  const drafts = useRef<Record<string, Partial<Task>>>({});
  const [selectedDraft, setSelectedDraft] = useState<Partial<Task> | undefined>();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("open");
  const [category, setCategory] = useState("All tasks");
  const [today, setToday] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [selected, setSelected] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const syncCommand = control.data?.commands.filter(c => c.type === "sync").at(-1);
  const syncing = control.pending.includes("sync") || Boolean(syncCommand && ["queued","processing","submitted"].includes(syncCommand.status));
  const [syncOpen, setSyncOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationDirty, setNotificationDirty] = useState(false);
  const [notificationCloseRequested, setNotificationCloseRequested] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const tick = () => setToday(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }));
    const frame = requestAnimationFrame(() => {
      tick(); const saved = localStorage.getItem("todos-theme");
      if (saved === "light" || saved === "dark") { document.documentElement.dataset.theme = saved; setTheme(saved); }
    });
    const interval = setInterval(tick, 60000);
    return () => { cancelAnimationFrame(frame); clearInterval(interval); };
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") { event.preventDefault(); search.current?.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const open = snapshot.tasks.filter(task => task.status !== "done" && task.status !== "archived");
  const completed = snapshot.tasks.filter(task => task.status === "done");
  const due = open.filter(task => task.dueDate && today && task.dueDate <= today);
  const shown = snapshot.tasks.filter(task => {
    const isOpen = task.status !== "done" && task.status !== "archived";
    const matchesView = view === "open" ? isOpen : task.status === view;
    return matchesView && (category === "All tasks" || task.category === category) && (!dueOnly || (task.dueDate && task.dueDate <= today)) && `${task.title} ${task.notes} ${task.links.map(link => link.label).join(" ")}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => rank[a.priority] - rank[b.priority] || (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || a.createdAt.localeCompare(b.createdAt));
  const customCategories = [...new Set(snapshot.tasks.map(task => task.category))].filter(name => !categories.includes(name));

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next); document.documentElement.dataset.theme = next; localStorage.setItem("todos-theme", next);
  }
  function edit(task: Task | null) { setSelectedDraft(drafts.current[task?.id || "new"]); setSelected(task); setEditorOpen(true); }
  useEffect(()=>{const frame=requestAnimationFrame(()=>{if(new URLSearchParams(window.location.search).has("inbox"))setNotificationsOpen(true);});const openInbox=(event:MessageEvent)=>{if(event.data?.type==='forma-open-inbox')setNotificationsOpen(true);};navigator.serviceWorker?.addEventListener('message',openInbox);return()=>{cancelAnimationFrame(frame);navigator.serviceWorker?.removeEventListener('message',openInbox);};},[]);
  function closeEditor(value: boolean) { setEditorOpen(value); }

  return <div className="page">
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Forma home"><FormaMark /><span>Forma<span className="brand-dot">.</span></span></Link>
      <div className="overview" aria-label="Task overview">
        <Button variant="ghost" onClick={() => { setMode("tasks"); setView("open"); setDueOnly(false); setCategory("All tasks"); }}><Circle size={16} /><span><strong>{loaded ? open.length : "…"}</strong> open</span></Button>
        <span className="overview-divider" />
        <Button variant="ghost" onClick={() => { setMode("tasks"); setView("open"); setDueOnly(true); setCategory("All tasks"); }}><Clock3 size={16} /><span><strong>{loaded ? due.length : "…"}</strong> due today</span></Button>
        <span className="overview-divider" />
        <Button variant="ghost" onClick={() => { setMode("tasks"); setView("done"); setDueOnly(false); setCategory("All tasks"); }}><CheckCheck size={16} /><span><strong>{loaded ? completed.length : "…"}</strong> completed</span></Button>
      </div>
      <div className="header-actions">
        <Button variant="ghost" onClick={() => setMode("attention")} aria-label="View items needing attention">{control.data?.attention.length || 0} need you</Button>
        <Button variant="ghost" aria-busy={syncing} onClick={() => { setSyncOpen(true); if (!syncing) void control.action("sync", {action:"sync"}).catch(() => {}); }} aria-label="Sync with Codex" title="Sync with Codex"><span className={syncing ? "sync-icon is-syncing" : "sync-icon"} aria-hidden="true"><RefreshCw size={16} /></span>{syncing ? "Syncing…" : "Sync"}</Button>
        <Button variant="ghost" onClick={() => setNotificationsOpen(true)} aria-label="Notification settings"><Bell size={16} />{Boolean(inbox.data?.unread) && <span className="notification-count">{inbox.data?.unread}</span>}</Button>
        <Button variant="ghost" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}><ThemeIcon dark={theme === "dark"} /></Button>
        <Button variant="ghost" onClick={() => edit(null)}><Plus size={16} />Add task</Button>
      </div>
    </header>

    <main>
      <h1 className="sr-only">Forma tasks</h1>

      <section className="workspace" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" className="sr-only">Your tasks</h2>
        <div className="toolbar">
<div className="workspace-switches">          <SegmentedControl label="Workspace view" value={mode} onValueChange={setMode} options={[{value:"tasks",label:"Tasks"},{value:"agents",label:"Agents"},{value:"attention",label:"Attention"}]} />{mode === "tasks" && <SegmentedControl label="Task status" value={view} onValueChange={value => { setView(value); setDueOnly(false); }} options={[{ value: "open", label: "Open" }, { value: "done", label: "Completed" }, { value: "archived", label: "Archived" }]} />}</div>
          <div className="search"><SearchField ref={search} label="Search workspace" value={query} onValueChange={setQuery} placeholder="Search tasks or agents…" /><kbd>⌘ K</kbd></div>
        </div>
        {mode === "tasks" ? <>
        <div className="categories" aria-label="Filter by category">
          {[...categories, ...customCategories].map(name => <Button key={name} variant={name === category ? "secondary" : "ghost"} aria-pressed={name === category} onClick={() => setCategory(name)}>{name}{name === "All tasks" ? <span className="count">{loaded ? snapshot.tasks.filter(t => view === "open" ? t.status !== "done" && t.status !== "archived" : t.status === view).length : "…"}</span> : null}</Button>)}
          {dueOnly && <Button variant="secondary" onClick={() => setDueOnly(false)}>Due today<X size={16} /></Button>}
        </div>

        {error && <div className="error-banner" role="alert"><span>{error}</span><Button variant="ghost" onClick={() => void refresh()}><RefreshCw size={16}/>Retry</Button></div>}
        <div className="list-caption"><span>{loaded ? `${shown.length} ${shown.length === 1 ? "task" : "tasks"}` : "Loading your tasks"}</span><span>Priority first</span></div>
        {!loaded && !error ? <div className="loading-list" aria-label="Loading tasks" aria-busy="true">{[1, 2, 3, 4, 5].map(n => <div className="loading-row" key={n}><span /><div><i /><i /></div></div>)}</div> : null}
        {loaded && shown.length === 0 ? <EmptyState className="empty" title={query ? "Nothing matches that search" : view === "done" ? "A clean slate" : view === "archived" ? "Nothing archived" : "You're all caught up"} description={query || category !== "All tasks" || dueOnly ? "Try clearing your search and filters." : view === "done" ? "Tasks you finish will be here whenever you need them." : view === "archived" ? "Archived tasks stay saved so you can bring them back." : "Add a task when something new comes up."} icon={<Inbox size={24} />} action={<Button variant="ghost" onClick={() => { if (query || category !== "All tasks" || dueOnly) { setQuery(""); setCategory("All tasks"); setDueOnly(false); } else edit(null); }}>{query || category !== "All tasks" || dueOnly ? <X size={16}/> : <Plus size={16}/>} {query || category !== "All tasks" || dueOnly ? "Clear filters" : "Add task"}</Button>} /> : null}
        <ul className="task-list">
          {shown.map(task => <BeautifulTaskRow done={task.status === "done"} key={task.id}>
            <TaskCompletion done={task.status === "done"} disabled={busy.includes(task.id)} title={task.title} onChange={value => { void mutate(task, { status: value ? "done" : "todo" }, value ? "Task completed. You can reopen it from Completed." : "Task reopened.").catch(e => setError(e.message)); }} />
            <div className="task-main">
              <button className="task-title" title={task.title} onClick={() => edit(task)}><span className="task-title-label">{task.title}</span>{hasUnreadUpdates(task) && <span className="task-update-dot" role="img" aria-label="New information available" title="New information available" />}{task.status !== "done" && task.status !== "archived" && badgeTime >= Date.parse(task.createdAt) && badgeTime - Date.parse(task.createdAt) < 86400000 && <Badge tone="success" size="sm" className="task-new-badge" title="Added in the past 24 hours">New</Badge>}</button>
              <div className="task-meta">{task.responsibility && task.responsibility !== "your_turn" && <Badge>{task.responsibility === "review" ? "Review" : task.responsibility === "agent" ? "With Codex" : "Waiting"}</Badge>}{task.priority === "high" ? <Badge size="sm" tone="warning">High</Badge> : task.priority === "low" ? <Badge size="sm">Low</Badge> : null}<Badge className="task-category" title={task.category}>{<span className="tag-label">{task.category}</span>}</Badge><TaskStatusPill status={task.status} label={statusLabels[task.status]} />{task.dueDate && <><span className="meta-dot">·</span><span className={today && task.dueDate < today && task.status !== "done" ? "overdue" : ""}>{today === task.dueDate ? "Due today" : `Due ${dateLabel(task.dueDate)}`}</span></>}</div>
              <div className="task-links" role="group" aria-label={`References for ${task.title}`}><TaskChatAction compact task={task} onLinked={refresh} control={control} />{task.links.slice(0, 3).map((link, index) => <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer" title={link.label} aria-label={`${link.label || linkKind(link.url)} (opens in a new tab)`}><ServiceLogo url={link.url} /></a>)}{task.links.length > 3 && <button title="Show all links" aria-label={`Show all ${task.links.length} links for ${task.title}`} onClick={() => edit(task)}>+{task.links.length - 3}</button>}</div>
            </div>
            <div className="task-end">{control.data?.attention.some(item=>item.taskId===task.id&&item.kind==="agent"&&control.data!.agents.some(agent=>agent.id===item.threadId&&agent.status==="review"&&Boolean(agent.result)))&&<Button variant="ghost" className="task-triage-ready" aria-label={`Triage ready for ${task.title}. View result`} title="Triage ready. View result" onClick={()=>edit(task)}><FileText size={18}/></Button>}{(control.data?.agents.some(a=>a.managed&&a.taskId===task.id&&a.status==="running")||control.data?.commands.some(c=>c.type==="start"&&c.taskId===task.id&&["queued","processing"].includes(c.status)))&&<span className="task-running" role="status" aria-label="Codex is working on this task" title="Codex is working on this task"><span className="run-spinner" aria-hidden="true"/></span>}<Button variant="ghost" aria-label={`Edit ${task.title}`} title="Edit task" onClick={() => edit(task)}><ChevronRight size={12} /></Button></div>
          </BeautifulTaskRow>)}
        </ul>
        </> : <ControlPanel mode={mode} control={control} query={query} onTask={id => { const task=snapshot.tasks.find(t=>t.id===id); if(task)edit(task); }} />}
        <div className="list-footer"><span><Check size={16} />Saved on your Mac</span><span>{message || "Click a task to see its details"}</span></div>
      </section>
      <footer className="page-footer"><span><Sparkles size={16} />{snapshot.sync.schedule ? `Codex checks for new tasks ${snapshot.sync.schedule}` : "Ready for Codex updates"}</span></footer>
    </main>

    <Drawer open={editorOpen} onOpenChange={closeEditor}><DrawerContent title={selected ? "Task details" : "Add a task"} description={selected ? "Keep the next step and the links together." : "Something to do. A place to start."}><TaskEditor control={control} key={selected?.id || "new"} task={selected} draft={selectedDraft} onDraft={draft => { drafts.current[selected?.id || "new"] = draft; }} onQueued={() => { void control.refresh(); }} busy={busy.includes(selected?.id || "new")} save={async changes => { const saved = await mutate(selected, changes, selected ? "Task saved." : "Task added."); delete drafts.current[selected?.id || "new"]; setSelected(saved); }} archive={selected ? async () => { await mutate(selected, { status: selected.status === "archived" ? "todo" : "archived" }, selected.status === "archived" ? "Task restored." : "Task archived. You can restore it from Archived."); setEditorOpen(false); } : undefined} /></DrawerContent></Drawer>
    <Drawer open={notificationsOpen} onOpenChange={value=>{if(!value&&notificationDirty){setNotificationCloseRequested(true);return;}setNotificationsOpen(value);}}><DrawerContent title="Notifications" description="Important updates, reminders and your upcoming meetings."><>{notificationCloseRequested&&<div className="discard-prompt" role="alert"><p>You have unsaved reminder preferences.</p><Button variant="secondary" onClick={()=>setNotificationCloseRequested(false)}>Keep editing</Button><Button variant="ghost" onClick={()=>{setNotificationDirty(false);setNotificationCloseRequested(false);setNotificationsOpen(false);}}>Discard changes</Button></div>}<NotificationInbox inbox={inbox} onDirtyChange={setNotificationDirty} onTask={id=>{const task=snapshot.tasks.find(item=>item.id===id);if(task){setNotificationsOpen(false);edit(task);}}} /></></DrawerContent></Drawer>
    <Drawer open={syncOpen} onOpenChange={setSyncOpen}><DrawerContent title="Codex updates" description="New tasks come here. Your changes stay yours."><div className="sync-details"><SyncStatus status={syncCommand?.status} pending={control.pending.includes("sync")} error={control.error || syncCommand?.error} />{syncCommand?.threadId && <a href={`codex://threads/${syncCommand.threadId}`}>Open sync chat in Codex</a>}<Button variant="ghost" loading={syncing} disabled={syncing} onClick={() => void control.action("sync",{action:"sync"}).catch(() => {})}><RefreshCw size={16}/>Sync with Codex</Button><SourceHealth control={control.data} sources={snapshot.sources || {}} /><Badge tone={snapshot.sync.automationId ? "success" : "neutral"}>{snapshot.sync.automationId ? "Scheduled" : "Not scheduled yet"}</Badge><h3>{snapshot.sync.schedule ? `Checking ${snapshot.sync.schedule}` : "Your local workspace"}</h3><p>Codex checks your recent work chats and available work sources for tasks. It adds new tasks and source links here. Completed tasks stay completed and your edits are preserved.</p><dl><div><dt>Last check</dt><dd>{snapshot.sync.lastCheckedAt ? `${dateLabel(snapshot.sync.lastCheckedAt)} at ${snapshot.sync.lastCheckedAt.slice(11, 16)} UTC` : "No check yet"}</dd></div><div><dt>Latest update</dt><dd>{snapshot.sync.message}</dd></div></dl><p className="muted">Scheduled checks run while Codex is available on this Mac. The list refreshes every five seconds while this page is open.</p><Button variant="ghost" aria-label="Refresh task list" title="Refresh task list" onClick={() => void refresh()}><RefreshCw size={16} /></Button><a className="export-link" href="/api/tasks" target="_blank" rel="noreferrer">Open task data<ArrowUpRight size={12} /></a></div></DrawerContent></Drawer>
  </div>;
}

function TaskEditor({ task, draft, onDraft, busy, save, archive, onQueued, control }: { control:ReturnType<typeof useControl>; draft?: Partial<Task>; onDraft: (draft:Partial<Task>) => void; onQueued: () => void; task: Task | null; busy: boolean; save: (changes: Partial<Task>) => Promise<void>; archive?: () => Promise<void> }) {
  const initial = { ...task, ...draft };
  const [title, setTitle] = useState(initial?.title || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [chatUrl, setChatUrl] = useState(initial?.chatUrl || "");
  const [status, setStatus] = useState<TaskStatus>(initial?.status || "todo");
  const [priority, setPriority] = useState<Priority>(initial?.priority || "normal");
  const [category, setCategory] = useState(initial?.category || "Work");
  const [date, setDate] = useState(initial?.dueDate || "");
  const [links, setLinks] = useState<TaskLink[]>(initial?.links || []);
  const [error, setError] = useState("");
  const [objective, setObjective] = useState(initial?.objective || "");
  const [constraints, setConstraints] = useState(initial?.constraints || "");
  const [completionCriteria, setCompletionCriteria] = useState(initial?.completionCriteria || "");
  const [nextStep, setNextStep] = useState(initial?.nextStep || "");
  const [workspacePath, setWorkspacePath] = useState(initial?.workspacePath || "");
  const [responsibility, setResponsibility] = useState(initial?.responsibility || "your_turn");
  const [relatedChats, setRelatedChats] = useState((initial?.relatedChats || []).join("\n"));
  const [artifacts, setArtifacts] = useState((initial?.artifacts || []).join("\n"));
  const [contextDirty, setContextDirty] = useState(false);
  const dirty = title !== (task?.title || "") || notes !== (task?.notes || "") || chatUrl !== (task?.chatUrl || "") || status !== (task?.status || "todo") || priority !== (task?.priority || "normal") || category !== (task?.category || "Work") || date !== (task?.dueDate || "") || JSON.stringify(links) !== JSON.stringify(task?.links || []) || objective !== (task?.objective || "") || constraints !== (task?.constraints || "") || completionCriteria !== (task?.completionCriteria || "") || nextStep !== (task?.nextStep || "") || workspacePath !== (task?.workspacePath || "") || responsibility !== (task?.responsibility || "your_turn") || relatedChats !== (task?.relatedChats || []).join("\n") || artifacts !== (task?.artifacts || []).join("\n");
  const draftSink = useRef(onDraft);
  useEffect(() => { draftSink.current = onDraft; }, [onDraft]);
  useEffect(() => { draftSink.current({ title, notes, chatUrl, status, priority, category, dueDate: date || null, links, objective, constraints, completionCriteria, nextStep, workspacePath, responsibility, relatedChats: relatedChats.split("\n"), artifacts: artifacts.split("\n") }); }, [title,notes,chatUrl,status,priority,category,date,links,objective,constraints,completionCriteria,nextStep,workspacePath,responsibility,relatedChats,artifacts]);
  const [editingLinks, setEditingLinks] = useState(!task);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!title.trim()) { setError("Give the task a title."); return; }
    if (links.some(link => !link.url.trim())) { setError("Add an address for each link or remove the empty link."); return; }
    try { await save({ title, notes, status, priority, category: category.trim() || "Work", dueDate: date || null, links, chatUrl: chatUrl.trim() || null, objective, constraints, completionCriteria, nextStep, workspacePath, responsibility, relatedChats: relatedChats.split("\n").map(v=>v.trim()).filter(Boolean), artifacts: artifacts.split("\n").map(v=>v.trim()).filter(Boolean) }); } catch (e) { setError((e as Error).message); }
  }
  const patchLink = (index: number, value: Partial<TaskLink>) => setLinks(items => items.map((item, i) => i === index ? { ...item, ...value } : item));
  function toggleLinkPreview() {
    if (editingLinks) {
      const valid = links.every(link => { try { return ["https:", "http:"].includes(new URL(link.url).protocol); } catch { return false; } });
      if (!valid) { setError("Enter a full http or https address for each link before previewing."); return; }
    }
    setError(""); setEditingLinks(!editingLinks);
  }
  return <form className="task-form" onSubmit={submit}>
    {task && <TaskUpdates task={task} />}
    {task && <TaskTriage task={task} control={control} dirty={dirty || contextDirty}/> }

    <Input label="Task" autoFocus value={title} onChange={event => setTitle(event.target.value)} required maxLength={500} />
    <Textarea label="Details" value={notes} onChange={event => setNotes(event.target.value)} rows={5} maxLength={12000} placeholder="What needs to happen next?" />
    <div className="form-grid"><Select label="Status" value={status} onValueChange={value => setStatus(value as TaskStatus)} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} /><Input label="Due date" type="date" value={date} onInput={event => setDate(event.currentTarget.value)} onChange={event => setDate(event.target.value)} /></div>
    <div><p className="field-label" id="priority-label">Priority</p><SegmentedControl label="Priority" value={priority} onValueChange={value => setPriority(value as Priority)} options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }]} /></div>
    <Input label="Category" value={category} onChange={event => setCategory(event.target.value)} maxLength={100} list="task-categories" /><datalist id="task-categories">{["Work", ...categories.slice(1)].map(value => <option key={value} value={value} />)}</datalist>
    <Input label="Codex chat link" value={chatUrl} onChange={event => setChatUrl(event.target.value)} placeholder="codex://threads/…" description="Opens the source conversation in the Codex app." />
    {task && <TaskChatAction task={task} control={control} disabled={dirty} />}
    <details className="context-fields"><summary>Context and ownership</summary><div className="context-fields-body">
      <Select label="Who needs to act?" value={responsibility} onValueChange={value=>setResponsibility(value as typeof responsibility)} options={[{value:"your_turn",label:"Your turn"},{value:"agent",label:"With Codex"},{value:"waiting",label:"Waiting on someone"},{value:"review",label:"Ready to review"}]} />
      <Textarea label="Objective" value={objective} onChange={event=>setObjective(event.target.value)} rows={2}/>
      <Textarea label="Next step" value={nextStep} onChange={event=>setNextStep(event.target.value)} rows={2}/>
      <Textarea label="Constraints" value={constraints} onChange={event=>setConstraints(event.target.value)} rows={3}/>
      <Textarea label="Completion criteria" value={completionCriteria} onChange={event=>setCompletionCriteria(event.target.value)} rows={3}/>
      <Input label="Local workspace folder" value={workspacePath} onChange={event=>setWorkspacePath(event.target.value)} placeholder="/path/to/workspace"/>
      <Textarea label="Other Codex chat links" value={relatedChats} onChange={event=>setRelatedChats(event.target.value)} rows={2} description="One Codex chat link per line."/>
      <Textarea label="Local files and artifacts" value={artifacts} onChange={event=>setArtifacts(event.target.value)} rows={2} description="One absolute file path per line."/>
    </div></details>
    <section className="form-links"><div className="form-section-heading"><h3>Links</h3><Button variant="ghost" type="button" aria-label={editingLinks ? "Preview links" : "Edit links"} title={editingLinks ? "Preview links" : "Edit links"} onClick={toggleLinkPreview}>{editingLinks ? <Eye size={16}/> : <Pencil size={16}/>}</Button></div>
      {editingLinks ? <>{links.map((link, index) => <div className="link-editor" key={index}><Input label={`Link ${index + 1} name`} value={link.label} onChange={event => patchLink(index, { label: event.target.value })} /><div className="link-url"><Input label={`Link ${index + 1} address`} type="url" placeholder="https://" value={link.url} onChange={event => patchLink(index, { url: event.target.value })} /><Button variant="ghost" type="button" aria-label={`Remove link ${index + 1}`} onClick={() => setLinks(items => items.filter((_, i) => i !== index))}><X size={16} /></Button></div></div>)}<Button variant="secondary" type="button" onClick={() => setLinks(items => [...items, { label: "", url: "" }])}><Plus size={16} />Add link</Button></> : <div className="source-links">{links.length ? links.map((link, index) => <a key={index} href={link.url} target="_blank" rel="noreferrer"><span>{link.label}<small>{new URL(link.url).hostname}</small></span><ArrowUpRight size={12} /></a>) : <p className="muted">No links yet. Add one when you have it.</p>}</div>}
    </section>
    {task?.manualFields.includes("notes") && task.sourceNotes && task.sourceNotes !== task.notes && <div className="source-update"><h3>Latest source details</h3><p>{task.sourceNotes}</p></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">{archive && <Button variant="ghost" type="button" aria-label={task?.status === "archived" ? "Restore task" : "Archive task"} title={task?.status === "archived" ? "Restore task" : "Archive task"} disabled={busy || dirty || contextDirty} onClick={() => { void archive().catch(e => setError(e.message)); }}>{task?.status === "archived" ? <ArchiveRestore size={16}/> : <Archive size={16}/>}</Button>}<Button loading={busy} type="submit">{task ? "Save task" : "Add task"}</Button></div>
    {task && <TaskContext task={task} dirty={dirty} onDirtyChange={setContextDirty} onQueued={onQueued}/> }
    {task && <p className="saved-note">Added by {task.origin} · Updated {dateLabel(task.updatedAt)}</p>}
  </form>;
}

const updateLabels: Record<string, string> = { title: "Task", notes: "Details", sourceNotes: "Source details", links: "Links", sourceLinks: "Source links", dueDate: "Due date", nextStep: "Next step", completionCriteria: "Completion criteria", workspacePath: "Workspace", relatedChats: "Related chats" };
function updateValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (Array.isArray(value)) return value.map(item => typeof item === "string" ? item : `${item.label}: ${item.url}`).join("\n") || "None";
  return String(value);
}
function TaskUpdates({ task }: { task: Task }) {
  const updates = task.sourceUpdates || [];
  const latest = updates.at(-1);
  const [readError, setReadError] = useState("");
  useEffect(() => {
    if (!latest || latest.id === task.sourceUpdatesReadId) return;
    let active = true;
    fetch("/api/task-updates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task.id, updateId: latest.id }) })
      .then(response => { if (!response.ok) throw new Error("Could not mark this update as read. It will stay unread."); })
      .catch(error => { if (active) setReadError(error.message); });
    return () => { active = false; };
  }, [task.id, task.sourceUpdatesReadId, latest]);
  if (!latest) return null;
  const readIndex = updates.findIndex(item => item.id === task.sourceUpdatesReadId);
  const visible = hasUnreadUpdates(task) ? updates.slice(readIndex + 1) : [latest];
  return <section className="task-update-panel" aria-label="What changed"><h3><span className="task-update-dot" aria-hidden="true" />What changed</h3><p className="muted">Source updates. Your edits stay yours.</p>{[...visible].reverse().map(item => <div key={item.id}><time>{new Date(item.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}</time>{item.changes.map(change => <details key={change.field} open><summary>{updateLabels[change.field] || change.field}</summary><div className="task-update-values"><div><small>Before</small><p>{updateValue(change.before)}</p></div><div><small>Now</small><p>{updateValue(change.after)}</p></div></div></details>)}</div>)}{readError && <p role="alert">{readError}</p>}</section>;
}
