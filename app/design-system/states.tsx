'use client';
import { useState } from 'react';
import { Checkbox } from '@/components/arc/checkbox/checkbox';
import { Select } from '@/components/arc/select/select';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { EmptyState } from '@/components/arc/empty-state/empty-state';
import { Drawer, DrawerContent } from '@/components/arc/drawer/drawer';
import { Button } from '@/components/arc/button/button';
import { motionTokens } from '@/components/arc/motion-tokens';
import { RefreshCw } from '@/components/icons';
const rows = [
 ['Button','Rest','Ghost is transparent; primary is filled; secondary has a quiet border. Label and icon identify intent.'],
 ['Button','Hover / press','Ghost gains a muted surface. Primary fades slightly. Press uses the existing spring. Popup triggers do not scale while their layer is measured.'],
 ['Button','Keyboard focus','Visible neutral outline. Tab order follows the document. Enter and Space invoke the action.'],
 ['Button','Loading','aria-busy and aria-disabled communicate pending work. Loader is decorative. Repeat clicks are swallowed; keyboard focus remains.'],
 ['Button','Disabled','Unavailable prerequisite, muted label and no action. Explain the prerequisite nearby when needed.'],
 ['Field','Empty / populated','Visible label, example placeholder and stable border. Preserve user content during refresh.'],
 ['Field','Focus / error','Neutral focus treatment. Invalid feedback identifies the problem and is associated with the field. Do not reintroduce a blue halo.'],
 ['Checkbox','Unchecked / checked / mixed','Task completion uses a button with checkbox semantics and a Morphicons checked mark. Other checkbox controls use Radix state through the existing Arc component.'],
 ['Select','Closed / open / selected / disabled','Label remains visible; menu placement comes from Radix. Keyboard selection updates the value. Disabled options are unavailable.'],
 ['Segmented control','Unselected / selected','Selected value remains visually distinct and accessible. Filters convey choices rather than imperative actions.'],
 ['Drawer','Opening / open / closing','Radix provides dialog semantics. Title describes content. Escape and outside interaction follow the configured dismissal handler. Preserve drafts before unmounting.'],
 ['Task','To do / in progress / blocked / done / archived','Lifecycle belongs to the task, not the agent. Archive preserves data. Done and archived items stop reminder delivery.'],
 ['Responsibility','Your turn / agent / waiting / review','Responsibility is independent from lifecycle. Record ownership only from explicit evidence.'],
 ['Agent','Queued / starting / running','Queue acknowledges submission. Running shows local motion, latest sampled progress and a stop control.'],
 ['Agent','Review / failed / interrupted / unknown','Review is not task completion. Failure retains error context. Interrupted is not success. Unknown presents a source or chat link.'],
 ['Data','Initial load / refresh / stale / failure','Use a local status. Preserve existing content during refresh. Separate old evidence from a failed new check.'],
 ['Empty view','No matches / no archived / all caught up','Differentiate filtered emptiness from real absence. Offer a relevant clear or create action.'],
 ['Notification','Unread / read / snoozed / dismissed','Persistent inbox owns state. Snooze is one hour. Read and dismissed suppress delivery.'],
 ['Delivery','Accepted / shown / failed / expired','Service acceptance and browser display are distinct. Neither proves the person read the alert.'],
 ['Source','Checked / limited / unavailable / unknown','Always keep scope, identity, time and access limitations. Unknown is not zero work.'],
];
const recipes = [
 ['Routine action',`import { Button } from '@/components/arc/button/button';\nimport { Plus } from '@/components/icons';\n<Button variant="ghost" onClick={openEditor}>\n  <Plus size={16}/>Add task\n</Button>`],
 ['Primary mutation',`<Button type="submit" loading={saving}>Save task</Button>\n// Preserve input and show an inline error if saving fails.\n// Do not disable merely to implement loading.`],
 ['Stop control',`<div className="triage-status-row">\n  <p role="status">Codex is checking this task…</p>\n  <Button variant="danger" className="triage-stop"\n    aria-label="Cancel triage" title="Cancel triage"\n    loading={cancelling} onClick={cancel}>\n    <CircleX size={18}/>\n  </Button>\n</div>`],
 ['Field',`<Input label="Task" value={title}\n  onChange={event => setTitle(event.target.value)}\n  error={error || undefined}/>\n<Textarea label="Details" value={details}\n  onChange={event => setDetails(event.target.value)}/>`],
 ['Layout',`.task-row {\n  display: grid;\n  grid-template-columns: 44px minmax(0, 1fr) auto auto 44px;\n  align-items: center;\n  min-height: 60px;\n}\n/* Narrow rows expose metadata below the title. */`],
 ['Evidence link',`<a href={verifiedUrl} target="_blank" rel="noreferrer">\n  Jira ticket<ArrowUpRight size={12}/>\n</a>\n// Use a service logo in dense rows, not arbitrary initials.`],
];
export function StateReference() {
 const [drawer,setDrawer]=useState(false),[view,setView]=useState('open');
 return <><section id="state-matrix"><h2>State matrix</h2><p>Reference behavior for every major control and product state. This is a review checklist, not a claim that every interaction has passed a live acceptance test.</p><div className="ds-table-wrap"><table><thead><tr><th>Element</th><th>State</th><th>Presentation and behavior</th></tr></thead><tbody>{rows.map(([a,b,c])=><tr key={a+b}><th scope="row">{a}</th><td>{b}</td><td>{c}</td></tr>)}</tbody></table></div><h3>Choice and drawer specimens</h3><div className="ds-examples"><Checkbox label="Unchecked"/><Checkbox label="Checked" defaultChecked/><Checkbox label="Mixed" defaultChecked="indeterminate"/><Checkbox label="Disabled" disabled/></div><Select label="Status specimen" defaultValue="todo" options={[{value:'todo',label:'To do'},{value:'in_progress',label:'In progress'},{value:'blocked',label:'Blocked'},{value:'done',label:'Done'}]}/><div className="ds-examples"><SegmentedControl label="Task view specimen" value={view} onValueChange={setView} options={[{value:'open',label:'Open'},{value:'done',label:'Completed'},{value:'archived',label:'Archived'}]}/><Button variant="ghost" onClick={()=>setDrawer(true)}>Open drawer example</Button></div><Drawer open={drawer} onOpenChange={setDrawer}><DrawerContent title="Drawer specimen" description="A safe component example. No task data is changed."><p>Use a clear heading, readable fields and one primary action. This example can be dismissed by its close control, Escape or outside interaction.</p><Button onClick={()=>setDrawer(false)}>Done</Button></DrawerContent></Drawer><EmptyState title="No matches" description="Try another search or clear your filters." action={<Button variant="ghost"><RefreshCw size={16}/>Clear filters</Button>}/></section>
 <section id="motion-spec"><h2>Motion specification</h2><p>The exact JavaScript presets imported by Arc components. CSS duration aliases and product process durations are documented separately. Avoid unnecessary perpetual motion.</p><pre className="ds-code">{JSON.stringify(motionTokens,null,2)}</pre><dl className="ds-rules"><div><dt>Control transitions</dt><dd>Changed labels rise slightly and fade with brief blur. Icons scale and crossfade. Reduced motion uses fades. Width morphs follow changed content; passive reflows should settle directly.</dd></div><div><dt>Selection motion</dt><dd>Segmented highlights and checkbox marks animate selection. Preserve a stable accessible value during visual transitions. Do not announce outgoing animated copies.</dd></div><div><dt>Process motion</dt><dd>Shimmer and rotation indicate verified active work only. Do not animate static results, source timestamps or stale progress. Reduced motion keeps a readable static state.</dd></div></dl></section>
 <section id="recipes"><h2>Implementation recipes</h2><p>Copy these patterns into a new Forma view. Supply actual state and handlers; example names are placeholders, not application APIs.</p>{recipes.map(([title,code])=><div key={title}><h3>{title}</h3><pre className="ds-code"><code>{code}</code></pre></div>)}<h3>Reusable screen recipe</h3><ol className="ds-checklist"><li>Start with a compact heading and routine action toolbar.</li><li>Expose searchable, scanable content with metadata and primary references.</li><li>Use a drawer for the selected item, with labelled fields and a deliberate save action.</li><li>Place active work, feedback and errors beside the action that caused them.</li><li>Preserve evidence links, draft edits and lifecycle status.</li><li>Verify narrow layouts, keyboard interaction and reduced motion.</li></ol></section></>;
}
