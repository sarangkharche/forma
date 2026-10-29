# Forma

A local task dashboard for the user. The original Libraries.dev mirror was copied from the Forma project. The dashboard is composed with public UIArc components and the Libraries font. No Pro blocks are installed.

Icons render through Morphicons using Lucide icon data, following https://www.morphicons.com/#how. The shared icon module is components/icons.tsx. The theme toggle keeps one MorphIcon mounted as the sun and moon data change. It uses the snappy spring and respects the user's reduced motion preference. UIArc control glyphs use the same renderer.

Open http://127.0.0.1:5184. Add tasks, edit details and source links, set dates, complete tasks or archive them. Archived tasks can be restored. Data is saved in SQLite on this Mac. The browser refreshes the list every five seconds while visible.

Tasks with a known source conversation show Open chat in Codex. The link uses `codex://threads/<chat-id>` and opens that conversation in the desktop app. Edit the reference in the task's Codex chat link field. The initial 15 tasks reference the chat where this list was assembled. Future detected tasks use their actual source chat when known.

## Run

```sh
cd ./
npm install
npm run dev
```

For the production server, run `npm run build` then `npm start`. Both bind only to 127.0.0.1 on port 5184.

## Codex updates

Codex can update this app without opening a browser:

```sh
npm run export
npm run ingest -- /absolute/path/to/batch.json
```

See AGENTS.md for the batch format. Tasks deduplicate by a stable sourceKey. Background updates preserve completed and archived states and any field edited by the user. The latest source details are retained separately if they differ from his notes. Stale forms receive a conflict message instead of overwriting newer data.

The scheduled Codex check runs on this Mac while Codex is available. It is a periodic scan of recent chats and available work sources. It cannot observe every chat instantly. The schedule and last check appear under Codex updates. Disconnected sources must be reported in the check message.

## Sources and validation

The initial 15 tasks are from the work list assembled in this chat on 7 October 2026. See each task's links. The Dionisis task flags the Azure versus Astronomer wording. The Peak availability sheet hasn't been found, so its task links to the meeting and setup ticket.

UIArc components: Button, Badge, Checkbox, Input, Textarea, SearchField, Select, SegmentedControl, Drawer and EmptyState. Source is copied from https://uiarc.dev/r/ with its MIT notice. Component documentation is in docs/arc. Layout uses Arc's semantic tokens. The dark canvas and Saans type are based on https://libraries.dev/.

```sh
npm test
npm run lint
npm run build
```
