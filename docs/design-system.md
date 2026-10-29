# Forma design system

Companion specification for http://localhost:5184/design-system. Updated 12 October 2026.

## Glance first

Keep the main list compact. Show the task, priority, due date, references and active work together. Details belong in the drawer. Avoid repeated introductions, decorative cards and large empty headers.

## Evidence before confidence

Label checked, limited and unavailable source coverage honestly. Missing access does not mean no tasks exist. Separate completed work, plans, recommendations and unverified outcomes.

## Human control

Analysis produces findings for review. It does not complete tasks, send workplace messages or publish changes. Review the exact brief before an agent starts.

## Quiet reliability

Keep background refreshes quiet. Notify for useful changes, failures or action needed. Persistent reminders live in the inbox; temporary interaction feedback belongs in a toast.

## Neutral identity

Use the existing monochrome surfaces. Reserve semantic colors for meaningful status. Removed bot avatars, profile decoration and broad accent recoloring are not part of the current direction.

## Page grid

Maximum page width is 1296px. Base grid uses 2 columns, 12px gutters and 16px margins. Responsive rules in app/globals.css override these values at larger widths. Components span the grid with min-width: 0 to allow wrapping.

## Task row

Desktop columns are 44px, flexible title, metadata, references and 44px action. Minimum row height is 60px. Task rows adopt Beautiful UI’s list presentation with circular completion controls and compact lifecycle pills, using Forma tokens and Morphicons. Titles truncate only in the list; full titles remain in details and accessible labels.

## Mobile

Below 767px use a second compact row for priority, responsibility, status and due date. Categories are omitted from narrow rows. Some references are hidden on mobile; all references remain available in task details.

## Grouping

Use spacing and thin rules before adding containers. A running status and its stop action share one row. Never position stop above the section heading.

## Responsive constraints

Use flexible widths, overflow-wrap for paths and source text, and wrapping metadata. Do not let long identifiers or URLs force horizontal page scrolling. Review at narrow widths and with increased text size.

## Family

Body and display: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif. Code uses ui-monospace, SFMono-Regular, Menlo, monospace.

## Scale

12px metadata, 14px body and controls, 16px larger body, 20px supporting display and 28px major headings at a 16px root. Use rem tokens so browser preferences remain effective.

## Leading

Global body leading is 20px. Dense process results use 1.6 line height and 14px type. Long explanations should wrap naturally without preserved accidental line breaks.

## Hierarchy

One page h1, section h2 or h3 as appropriate, then subordinate headings. Weight and space communicate structure. Avoid oversized headings for routine statuses.

## Readable results

Render headings, numbered lists, strong text, inline code and labelled source links. Never show raw Markdown punctuation as a finished result. Avoid long visible URLs when a descriptive link works.

## Surfaces

Use background for the page, surface for a panel, surface-raised for elevated content and surface-muted for hover or subtle separation. Avoid stacking several cards inside a drawer.

## Borders

Use border for normal separators and border-strong for fields that need definition. Keep rules thin. Do not use thick highlighted input halos.

## Corners

Input and textarea field radius is 8px. Foundation control, panel and surface tokens remain available but are not a reason to make text fields pill shaped. Pills are for compact badges and segmented choices.

## Focus

The product removed blue focus halos. Retain visible neutral keyboard focus and field border feedback. Do not globally remove keyboard focus just to match pointer screenshots.

## Semantic color

Success marks positive operational state; warning marks high priority or caution; danger marks destructive controls, overdue conditions or failure. Meaning must also be conveyed by text or an accessible label.

## Text and icon

Use Arc Button variant ghost for Add task in the header, Sync, Retry, Review brief, Record decision, recorded progress and opening a related task. Transparent at rest with visible hover and keyboard feedback.

## Filled primary

Use primary for Save task, Add task in the creation form, Save preferences and starting a reviewed analysis. Keep the action label explicit. Do not make every control primary.

## Outlined secondary

Use secondary for selected filters or an action that needs separation from adjacent content. It is not the default for every minor operation.

## Icon only

Use for dense, familiar utilities: copy, edit links, preview links, refresh, archive, restore, dismiss and stop. Supply an accessible name and tooltip. Preserve 44px hit areas where practical.

## Destructive

Stop is a red CircleX within a semantic button beside the running status. The loading state prevents repeat requests and retains focus. Deleting, discarding and cancelling must use clear labels.

## Pending and disabled

Set loading for an active mutation. Arc exposes aria-busy and blocks repeat presses while keeping the control focusable. Use disabled for an unavailable prerequisite. Explain why when it is not obvious.

## Links

Navigation is an anchor with a destination. An action is a button. Open Codex Chat uses the verified codex://threads link; Create Codex Chat queues creation only when no linked chat exists.

## Labels

Every field has a visible label or a justified accessible name. Placeholders are examples, not substitutes for labels. Associate help and validation text with the field.

## Text inputs

Use Arc Input with type appropriate to the value. Keep 8px field corners and a neutral border. Use error feedback for invalid values without relying on color alone.

## Long text

Use Arc Textarea where available. Expand fields to show longer text rather than introducing an internal scrollbar for ordinary details. Code and custom briefs may need a dedicated editor treatment.

## Drafts

Task field drafts survive drawer dismissal in the current implementation. Custom decision and brief drafts remain a known gap; do not claim every draft is preserved. Closing should not create a surprising discard flow.

## Save failures

Preserve typed values. Show actionable inline errors and allow retry. Optimistic updates roll back the affected task without overwriting another successful mutation.

## Concurrency

Submit saved task version with agent requests. Stale edits need a clear refresh or reconciliation path. Deduplicate requests rather than opening multiple agents from repeated clicks.

## Renderer

Import from components/icons.tsx. Lucide provides geometry; morphicons/react renders it. Default size is 16px, chevrons 12px, stroke width 1.5 with absoluteStrokeWidth and reducedMotion user.

## Service identity

Slack links use the Slack logo, Jira uses Jira, Google Docs and Sheets use their respective service marks. Codex references use the OpenAI service mark. Never substitute arbitrary initials for a verified service logo.

## Sizing

Service marks use an 18px visual size. A small visual icon does not justify a small click target. Align icons to the label baseline and use shared spacing.

## Accessible meaning

Decorative icons accompanying text are hidden from assistive technology when redundant. Icon only controls require destination or action specific aria-label. Do not use a clickable SVG instead of a button.

## Consistency

Use Plus for create, Check for recorded progress, Pencil for editing or recording a decision, Eye for preview, Copy for copy, RefreshCw for sync, Archive for archive and CircleX for stopping work.

## Loading

Use a local loader where work is happening. Keep existing content visible during refresh when available. Initial load can show a concise status. Do not replace the whole app with a blocking overlay.

## Running

Use ProcessLabel shimmer for current work and a small spinner on the associated task. Sync rotates RefreshCw only while queued, processing or submitted. Stop motion on completion, failure or unavailable progress.

## Reduced motion

Respect prefers-reduced-motion. Replace repeated rotation and shimmer with a static readable label. Morphicons and Motion components already expose reduced motion behavior.

## Cadence

Task and control views refresh every five seconds while visible. Worker progress is sampled separately, so the UI is not a token by token live stream. State this honestly.

## Stale progress

If the worker is unavailable, show that progress cannot be verified and offer the Codex chat link. Never display stale polling as completion.

## Toasts

Use the existing Arc ToastStack through FeedbackProvider for short explicit action feedback. Keep durable errors and results in their section. Do not toast every successful background poll. Toast coverage across all actions remains incomplete.

## Timing

Foundation duration tokens are 120ms, 160ms, 240ms, 480ms and 580ms. Current process shimmer takes 3 seconds per repeat; sync rotation takes 1.2 seconds; the small run spinner takes .8 seconds. Prefer opacity and transform for most motion.

## Before start

Show the saved brief, evidence links, workspace and restrictions before submitting. Dirty task edits must be saved first. Duplicate active runs are rejected.

## During work

Show running state, the stop icon, latest readable progress, verified agent title, workspace, update time and a direct chat link. Keep technical IDs subordinate.

## After work

Lead with a one or two sentence Summary. Follow with a short numbered action list, what happened and still unknown. Suggested task changes and source lists are expandable.

## Evidence handling

Keep verified facts distinct from recommended actions. Do not guess assignees or dates. Every useful factual claim should preserve a primary source reference.

## Existing results

TriageResult recognizes existing section headings and places next steps before background findings. It supports basic Markdown; it is not a complete Markdown or HTML engine. Unsafe link schemes are not rendered as links.

## Apply boundary

Findings remain review material. A finished agent run does not complete the personal task. Applying a suggestion requires the normal edit and save flow.

## Reminder defaults

Morning summary at 09:10 and evening summary at 17:00 are user requested. Contextual defaults use three days without recorded progress, a 24 hour task gap and three contextual browser alerts per day. Quiet hours are 22:00 to 08:00 Europe/London.

## Progress meaning

Recorded edits or the explicit I’ve worked on this action count as human progress. Source ingestion alone must not imply the user worked on a task.

## Delivery truth

Distinguish push service acceptance from browser confirmation. Neither proves the user read it. Failed transports retry within bounded limits; stale meeting reminders expire.

## Coverage statuses

Checked means the specified scope was actually reviewed. Limited means meaningful coverage has gaps. Unavailable means access or identity prevented a check. Always include checked time, identity, scope and limitations.

## Calendar identity

Only user@example.com is authorized for work calendar imports. A personal Gmail connection is not the work calendar. Record the mismatch instead of claiming there are no meetings.

## Task ownership

Team backlog and other people’s actions are not personal tasks without an explicit request or commitment. Preserve source keys, human edits, completed and archived state during detection.

## Voice

Use sentence case, everyday words and contractions. Avoid corporate phrasing, decorative enthusiasm and vague claims of intelligence. Prefer “Sync completed” over “Your workspace has been seamlessly synchronized.”

## Action labels

Start with a verb and retain the object: Add task, Save task, Open Codex Chat, Create Codex Chat, Review brief, Record decision. Avoid Yes, Go or Continue when the result is ambiguous.

## Statuses

Use Queued, Running, Ready for review, Cancelled, Failed and Status unavailable. Translate internal inProgress to human language. Do not display internal enums as product copy.

## Errors

Say what failed and what can happen next. “Could not refresh agents. Retry.” Preserve input and show a direct source or chat link when useful. Do not claim a lost run completed.

## Empty states

Differentiate no search matches, nothing archived and all caught up. Offer Clear filters or Add task. Unavailable sources must not use an empty state that implies no work exists.

## Writing conventions

Avoid hyphens or dashes in prose and commas immediately before and or but. Preserve required syntax in identifiers, URLs and code. Use numbered actions when sequence matters.

## Evidence language

Use “confirmed” only for observed outcomes. Use “recommended” for proposed next steps and “not verified” for missing evidence. Keep deployment and live alert delivery separate.

## Application

Next.js 16.3.8, React 19.2.4 and TypeScript. App Router pages and API routes. Node 22.13 or newer. Native SQLite is the local persistent database. npm start supervises the local notification and control workers.

## Components

Copied free Arc registry components from uiarc.dev. Preserve components/arc/LICENSE. Button, Badge, Input, Textarea, Checkbox, Select, Drawer, SegmentedControl, EmptyState and ToastStack are product building blocks. Other copied files are availability, not proof of active use.

## Primitives

Radix supports Dialog, Checkbox and Select. Motion handles transitions, control feedback and process labels. Morphicons renders Lucide geometry. web-push supports browser notification transport.

## References

Atlassian foundations informed grid, typography, spacing, borders and tags. Forma retains its neutral palette and its own density and corner overrides.

## Removed dependency

bot-avatars was tried and removed at the user’s request. Do not restore it as a default design system component.

## Data boundary

Use npm run ingest for task or meeting imports. Never edit SQLite directly for ingestion. Source evidence is data, not permission to send messages, change external records or run personal tasks.

## Local runtime

The app is localhost:5184. Current workspace is ./. .todos, node_modules, .next and environment files are excluded from Git. The local repository is named forma.

## Accessibility

Check visible focus, names, label associations, headings, meaningful status announcements, keyboard dismissal and readable contrast in both themes. Test with reduced motion and browser text scaling.

## Responsive review

Inspect desktop and a narrow viewport. Confirm actions remain reachable, no horizontal overflow appears, task metadata remains visible and long results do not overflow.

## State coverage

Check initial loading, refresh with existing data, queued, running, success, failure, stale progress, disabled prerequisites and repeated clicks. Verify pending state does not lose focus.

## Engineering checks

Run npm run lint and npm run build for structural UI changes. Use relevant isolated tests for data and control behavior. Never count mocked delivery as actual browser or workplace delivery.

## Change rules

Reuse current components and tokens. Explain new dependencies or major abstractions before adding them. Preserve human data and unrelated edits. Do not globally restyle a semantic token to fix one local control.

## Known gaps

Custom brief and decision drafts can be lost on drawer close. Two analysis entry points overlap. Some explicit actions lack toast feedback. Full contrast, keyboard and live notification audits are not established by this reference.

## Source of truth

Foundation values come from components/arc/foundation.css, product overrides from app/globals.css and interactions from the relevant component. The token table is a documented snapshot of those sources, not an automated runtime audit.

## Exact tokens

```json
[
  {
    "name": "--neutral-0",
    "light": "oklch(100% 0 0)",
    "dark": "oklch(100% 0 0)"
  },
  {
    "name": "--neutral-1",
    "light": "oklch(99% 0 0)",
    "dark": "oklch(99% 0 0)"
  },
  {
    "name": "--neutral-2",
    "light": "oklch(97.8% 0 0)",
    "dark": "oklch(97.8% 0 0)"
  },
  {
    "name": "--neutral-3",
    "light": "oklch(95.8% 0 0)",
    "dark": "oklch(95.8% 0 0)"
  },
  {
    "name": "--neutral-4",
    "light": "oklch(91.5% 0 0)",
    "dark": "oklch(91.5% 0 0)"
  },
  {
    "name": "--neutral-5",
    "light": "oklch(84% 0 0)",
    "dark": "oklch(84% 0 0)"
  },
  {
    "name": "--neutral-6",
    "light": "oklch(72% 0 0)",
    "dark": "oklch(72% 0 0)"
  },
  {
    "name": "--neutral-7",
    "light": "oklch(59% 0 0)",
    "dark": "oklch(59% 0 0)"
  },
  {
    "name": "--neutral-8",
    "light": "oklch(46% 0 0)",
    "dark": "oklch(46% 0 0)"
  },
  {
    "name": "--neutral-9",
    "light": "oklch(34% 0 0)",
    "dark": "oklch(34% 0 0)"
  },
  {
    "name": "--neutral-10",
    "light": "oklch(23% 0 0)",
    "dark": "oklch(23% 0 0)"
  },
  {
    "name": "--neutral-11",
    "light": "oklch(15% 0 0)",
    "dark": "oklch(15% 0 0)"
  },
  {
    "name": "--background",
    "light": "var(--neutral-0)",
    "dark": "oklch(19% 0 0)"
  },
  {
    "name": "--surface",
    "light": "var(--neutral-0)",
    "dark": "oklch(21.5% 0 0)"
  },
  {
    "name": "--surface-raised",
    "light": "var(--neutral-0)",
    "dark": "oklch(24% 0 0)"
  },
  {
    "name": "--surface-muted",
    "light": "var(--neutral-2)",
    "dark": "oklch(26% 0 0)"
  },
  {
    "name": "--foreground",
    "light": "var(--neutral-11)",
    "dark": "oklch(96% 0 0)"
  },
  {
    "name": "--text-secondary",
    "light": "var(--neutral-8)",
    "dark": "oklch(77% 0 0)"
  },
  {
    "name": "--text-muted",
    "light": "var(--neutral-7)",
    "dark": "oklch(64% 0 0)"
  },
  {
    "name": "--border",
    "light": "oklch(93.5% 0 0)",
    "dark": "oklch(29% 0 0)"
  },
  {
    "name": "--border-subtle",
    "light": "oklch(96.5% 0 0)",
    "dark": "oklch(25% 0 0)"
  },
  {
    "name": "--border-strong",
    "light": "oklch(82% 0 0)",
    "dark": "oklch(40% 0 0)"
  },
  {
    "name": "--accent",
    "light": "oklch(33% 0 0)",
    "dark": "oklch(80% 0 0)"
  },
  {
    "name": "--accent-strong",
    "light": "oklch(24% 0 0)",
    "dark": "oklch(91% 0 0)"
  },
  {
    "name": "--accent-subtle",
    "light": "oklch(33% 0 0 / .1)",
    "dark": "oklch(80% 0 0 / .13)"
  },
  {
    "name": "--accent-foreground",
    "light": "var(--background)",
    "dark": "var(--background)"
  },
  {
    "name": "--control-on",
    "light": "oklch(23% 0 0)",
    "dark": "oklch(93% 0 0)"
  },
  {
    "name": "--control-glyph",
    "light": "oklch(100% 0 0)",
    "dark": "oklch(19% 0 0)"
  },
  {
    "name": "--control-track",
    "light": "oklch(89.5% 0 0)",
    "dark": "oklch(33% 0 0)"
  },
  {
    "name": "--control-track-hover",
    "light": "oklch(86% 0 0)",
    "dark": "oklch(37% 0 0)"
  },
  {
    "name": "--control-thumb",
    "light": "oklch(100% 0 0)",
    "dark": "oklch(97% 0 0)"
  },
  {
    "name": "--control-thumb-on",
    "light": "oklch(100% 0 0)",
    "dark": "oklch(19% 0 0)"
  },
  {
    "name": "--control-thumb-shadow",
    "light": "0 0 0 .5px oklch(0% 0 0 / .07), 0 1px 2px oklch(0% 0 0 / .14), 0 2px 6px oklch(0% 0 0 / .06)",
    "dark": "0 0 0 .5px oklch(0% 0 0 / .3), 0 1px 2px oklch(0% 0 0 / .35), 0 2px 6px oklch(0% 0 0 / .2)"
  },
  {
    "name": "--control-on-subtle",
    "light": "color-mix(in oklab, var(--control-on) 10%, transparent)",
    "dark": "color-mix(in oklab, var(--control-on) 10%, transparent)"
  },
  {
    "name": "--control-fill",
    "light": "var(--control-on)",
    "dark": "oklch(62% 0 0)"
  },
  {
    "name": "--focus-ring",
    "light": "transparent",
    "dark": "transparent"
  },
  {
    "name": "--success",
    "light": "oklch(49% .19 150)",
    "dark": "oklch(78% .18 150)"
  },
  {
    "name": "--warning",
    "light": "oklch(58% .18 75)",
    "dark": "oklch(83% .17 80)"
  },
  {
    "name": "--danger",
    "light": "oklch(54% .21 25)",
    "dark": "oklch(76% .2 25)"
  },
  {
    "name": "--shadow-resting",
    "light": "0 1px 2px oklch(0% 0 0 / .035)",
    "dark": "0 1px 2px oklch(0% 0 0 / .18)"
  },
  {
    "name": "--shadow-raised",
    "light": "0 6px 18px oklch(0% 0 0 / .065), 0 1px 3px oklch(0% 0 0 / .035)",
    "dark": "0 8px 22px oklch(0% 0 0 / .22)"
  },
  {
    "name": "--shadow-floating",
    "light": "0 20px 48px oklch(0% 0 0 / .105), 0 3px 10px oklch(0% 0 0 / .045)",
    "dark": "0 22px 55px oklch(0% 0 0 / .34)"
  },
  {
    "name": "--arc-gradient-from",
    "light": "oklch(90% .045 300)",
    "dark": "oklch(38% .05 300)"
  },
  {
    "name": "--arc-gradient-to",
    "light": "oklch(92% .045 65)",
    "dark": "oklch(40% .045 60)"
  },
  {
    "name": "--arc-gradient",
    "light": "linear-gradient(100deg, var(--arc-gradient-from), var(--arc-gradient-to))",
    "dark": "linear-gradient(100deg, var(--arc-gradient-from), var(--arc-gradient-to))"
  },
  {
    "name": "--arc-gradient-foreground",
    "light": "oklch(22% .01 300)",
    "dark": "oklch(96% .005 300)"
  },
  {
    "name": "--arc-gradient-soft",
    "light": "linear-gradient(135deg, oklch(97.5% .016 300), oklch(98% .016 65))",
    "dark": "linear-gradient(135deg, oklch(23.5% .016 300), oklch(24% .014 65))"
  },
  {
    "name": "--arc-gradient-line",
    "light": "linear-gradient(100deg, oklch(83% .06 300), oklch(86% .06 65))",
    "dark": "linear-gradient(100deg, oklch(48% .06 300), oklch(52% .055 65))"
  },
  {
    "name": "--arc-gradient-ink",
    "light": "linear-gradient(100deg, oklch(47% .1 300), oklch(50% .09 55))",
    "dark": "linear-gradient(100deg, oklch(82% .07 300), oklch(86% .065 70))"
  },
  {
    "name": "--space-1",
    "light": ".25rem",
    "dark": ".25rem"
  },
  {
    "name": "--space-2",
    "light": ".5rem",
    "dark": ".5rem"
  },
  {
    "name": "--space-3",
    "light": ".75rem",
    "dark": ".75rem"
  },
  {
    "name": "--space-4",
    "light": "1rem",
    "dark": "1rem"
  },
  {
    "name": "--space-5",
    "light": "1.25rem",
    "dark": "1.25rem"
  },
  {
    "name": "--space-6",
    "light": "1.5rem",
    "dark": "1.5rem"
  },
  {
    "name": "--space-8",
    "light": "2rem",
    "dark": "2rem"
  },
  {
    "name": "--space-10",
    "light": "2.5rem",
    "dark": "2.5rem"
  },
  {
    "name": "--space-12",
    "light": "3rem",
    "dark": "3rem"
  },
  {
    "name": "--space-16",
    "light": "4rem",
    "dark": "4rem"
  },
  {
    "name": "--space-20",
    "light": "5rem",
    "dark": "5rem"
  },
  {
    "name": "--space-24",
    "light": "6rem",
    "dark": "6rem"
  },
  {
    "name": "--radius-control",
    "light": "1.125rem",
    "dark": "1.125rem"
  },
  {
    "name": "--radius-panel",
    "light": "1.625rem",
    "dark": "1.625rem"
  },
  {
    "name": "--radius-surface",
    "light": "2.125rem",
    "dark": "2.125rem"
  },
  {
    "name": "--radius-pill",
    "light": "9999px",
    "dark": "9999px"
  },
  {
    "name": "--control-height-sm",
    "light": "2.25rem",
    "dark": "2.25rem"
  },
  {
    "name": "--control-height-md",
    "light": "2.75rem",
    "dark": "2.75rem"
  },
  {
    "name": "--control-height-lg",
    "light": "3.125rem",
    "dark": "3.125rem"
  },
  {
    "name": "--font-display",
    "light": "var(--font-body)",
    "dark": "var(--font-body)"
  },
  {
    "name": "--font-body",
    "light": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Arial, sans-serif",
    "dark": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Arial, sans-serif"
  },
  {
    "name": "--text-xs",
    "light": ".75rem",
    "dark": ".75rem"
  },
  {
    "name": "--text-sm",
    "light": ".875rem",
    "dark": ".875rem"
  },
  {
    "name": "--text-base",
    "light": "1rem",
    "dark": "1rem"
  },
  {
    "name": "--text-lg",
    "light": "1.25rem",
    "dark": "1.25rem"
  },
  {
    "name": "--text-xl",
    "light": "1.375rem",
    "dark": "1.375rem"
  },
  {
    "name": "--text-2xl",
    "light": "1.75rem",
    "dark": "1.75rem"
  },
  {
    "name": "--text-3xl",
    "light": "1.75rem",
    "dark": "1.75rem"
  },
  {
    "name": "--text-4xl",
    "light": "1.75rem",
    "dark": "1.75rem"
  },
  {
    "name": "--text-5xl",
    "light": "4.5rem",
    "dark": "4.5rem"
  },
  {
    "name": "--tracking-display",
    "light": "0",
    "dark": "0"
  },
  {
    "name": "--tracking-body",
    "light": "0",
    "dark": "0"
  },
  {
    "name": "--leading-display",
    "light": "2rem",
    "dark": "2rem"
  },
  {
    "name": "--leading-body",
    "light": "1.25rem",
    "dark": "1.25rem"
  },
  {
    "name": "--ease-enter",
    "light": "cubic-bezier(.16,1,.3,1)",
    "dark": "cubic-bezier(.16,1,.3,1)"
  },
  {
    "name": "--ease-standard",
    "light": "cubic-bezier(.22,1,.36,1)",
    "dark": "cubic-bezier(.22,1,.36,1)"
  },
  {
    "name": "--ease-exit",
    "light": "cubic-bezier(.7,0,.84,0)",
    "dark": "cubic-bezier(.7,0,.84,0)"
  },
  {
    "name": "--ease-in-out",
    "light": "cubic-bezier(.65,0,.35,1)",
    "dark": "cubic-bezier(.65,0,.35,1)"
  },
  {
    "name": "--ease-spring",
    "light": "linear(0, 0.0258, 0.09, 0.1763, 0.2732, 0.3724, 0.4683, 0.5573, 0.6376, 0.7082, 0.7689, 0.8202, 0.8628, 0.8976, 0.9256, 0.9476, 0.9648, 0.9778, 0.9875, 0.9945, 0.9994, 1.0026, 1.0047, 1.0058, 1.0062, 1.0062, 1.0059, 1.0055, 1.0049, 1.0043, 1.0036, 1.0031, 1.0025, 1.002, 1.0016, 1.0013, 1)",
    "dark": "linear(0, 0.0258, 0.09, 0.1763, 0.2732, 0.3724, 0.4683, 0.5573, 0.6376, 0.7082, 0.7689, 0.8202, 0.8628, 0.8976, 0.9256, 0.9476, 0.9648, 0.9778, 0.9875, 0.9945, 0.9994, 1.0026, 1.0047, 1.0058, 1.0062, 1.0062, 1.0059, 1.0055, 1.0049, 1.0043, 1.0036, 1.0031, 1.0025, 1.002, 1.0016, 1.0013, 1)"
  },
  {
    "name": "--duration-instant",
    "light": "120ms",
    "dark": "120ms"
  },
  {
    "name": "--duration-fast",
    "light": "160ms",
    "dark": "160ms"
  },
  {
    "name": "--duration-standard",
    "light": "240ms",
    "dark": "240ms"
  },
  {
    "name": "--duration-considered",
    "light": "480ms",
    "dark": "480ms"
  },
  {
    "name": "--duration-spring",
    "light": "580ms",
    "dark": "580ms"
  },
  {
    "name": "--font-mono",
    "light": "ui-monospace, SFMono-Regular, Menlo, monospace",
    "dark": "ui-monospace, SFMono-Regular, Menlo, monospace"
  },
  {
    "name": "--panel-padding",
    "light": "var(--space-6)",
    "dark": "var(--space-6)"
  },
  {
    "name": "--row-padding",
    "light": "var(--space-5)",
    "dark": "var(--space-5)"
  },
  {
    "name": "--radius-field",
    "light": "8px",
    "dark": "8px"
  },
  {
    "name": "--grid-columns",
    "light": "2",
    "dark": "2"
  },
  {
    "name": "--grid-gutter",
    "light": "12px",
    "dark": "12px"
  },
  {
    "name": "--grid-margin",
    "light": "16px",
    "dark": "16px"
  }
]
```

## Motion presets

```typescript
/** Motion presets are shared by the gallery and future registry consumers. */
export const motionTokens = {
  duration: { instant: 0.12, fast: 0.16, exit: 0.18, standard: 0.24, considered: 0.48 },
  ease: {
    enter: [0.16, 1, 0.3, 1],
    exit: [0.7, 0, 0.84, 0],
    standard: [0.22, 1, 0.36, 1],
    /** For elements that move while already on screen. */
    inOut: [0.65, 0, 0.35, 1],
  },
  spring: {
    responsive: { type: "spring", stiffness: 520, damping: 38 },
    gentle: { type: "spring", stiffness: 340, damping: 34 },
    /** Presses, toggles, thumbs, and small indicators. Settles fast with a hint of life. */
    snappy: { type: "spring", visualDuration: 0.26, bounce: 0.12 },
    /** Panels, height changes, and layout shifts. Critically damped, never overshoots. */
    smooth: { type: "spring", visualDuration: 0.4, bounce: 0 },
    /** Shape morphs, shared layout highlights, and width changes that follow new content. */
    morph: { type: "spring", visualDuration: 0.42, bounce: 0.16 },
  },
  /** Stagger steps in seconds. Keep total stagger under roughly 0.4s. */
  stagger: { char: 0.016, word: 0.04, line: 0.08, item: 0.035 },
  /** Blur radii in px for text and content crossfades. Keep blur small and brief. */
  blur: { subtle: 2, soft: 4, text: 8 },
} as const;

```

## Brand asset library

The logo gallery is at /design-system#brand-assets. Assets are in public/brand. Only the primary Signal logo is supplied. It preserves the exact current Forma mark. Its assets include standalone, horizontal and stacked layouts, dark and light monochrome, copper color variants and transparent or solid backgrounds. There are 24 SVGs, 24 PNGs and 12 JPGs. PNG dimensions are 2048px square or 3840px wide; JPG uses quality 96 with full chroma resolution. SVG wordmarks remain editable Arial text with fallback fonts, not outlined text. Use raster exports when exact cross device typography is required. JPG has no transparency. Download the ZIP at /brand/forma-brand-kit.zip.

### Recently added tasks

Open tasks created in the past 24 hours show a small success tone Arc badge labelled New beside the title. Use createdAt rather than updatedAt so edits and source refreshes do not reset the badge. Completed and archived tasks do not show it. The badge expires automatically with a minute level refresh. Keep it static with no animation. The title truncates first while the badge remains visible. Its tooltip explains the 24 hour window.

## Beautiful UI adoption

Task rows and the source sync status card adapt Beautiful UI TaskRows at revision `44a274e598395ab61e7c96c26fda2758780253b7`. The MIT licence lives in `components/beautiful/LICENSE`. These surfaces use scoped CSS with existing Forma tokens. Existing Arc controls remain supported in other surfaces. Morphicons remains the icon renderer.

Sync distinguishes queued, processing, awaiting result import, completed and failed commands. Only a completed command claims import success. Source coverage remains separately visible and can still be limited or unavailable after a successful sync. Task lifecycle comes from saved task data; agent progress never changes it. No timed demo sequence is used.
