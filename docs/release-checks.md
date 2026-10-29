# Release verification

This records the customer readiness work from 29 October 2026. It is a technical verification record. General customer availability still needs the live checks below.

## Automated checks

The [Forma checks workflow](https://github.com/sarangkharche/forma/actions/workflows/ci.yml) runs on macOS and Linux with Node 22 and 24. Open the run for the exact commit before approving a release.

It installs the locked dependency tree with lifecycle scripts disabled and checks dependency advisories, lint, tests, the production build and the running app. The app smoke check covers an empty install, task creation and human edits, completion, reminder preferences, the local request guard, worker backups, restore and persistence across restart. Stub AI executables make accidental provider startup fail the check.

The API checks the Host and any Origin against the supported local addresses on port 5184. This protects against untrusted hostnames and browser origins. It does not authenticate other programs running on the same machine.

The Node minimum is 22.16 within the 22 series, or 24 and newer, because the [SQLite backup API](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html#sqlitebackupsourceDb-destination-options) was introduced in Node 22.16. Use the latest patch of a tested Node release. Node 23 is unsupported.

The test suite also covers source tool restrictions, source coverage, manual edit protection, cancelled and failed AI runs, notification delivery state and backup integrity. These tests use synthetic data and transports. They do not prove third party account access or OS notification display.

## Locally observed

1. A fresh dependency install with scripts disabled produced a successful production build. The patched dependency audit reported zero vulnerabilities.
2. The production app smoke check passed on macOS. Restored data included human edits, completed tasks, decisions and saved settings from a consistent SQLite backup.
3. An isolated macOS LaunchAgent started Forma, restarted it with the saved task intact and was removed. The existing user service and task data were preserved.
4. A fresh browser session displayed the empty dashboard, manual mode with an Enable AI control and notification preferences. Browser notification setup timed out with an actionable recovery message. No OS notification was observed.
5. Codex CLI 0.165.0 completed a synthetic app server request. Claude Code 2.1.308 connected to the synthetic MCP server and ran the startup guard. Its model request was rejected by the account spend limit and imported no tasks.

## Required before general availability

1. Complete a model driven Claude source scan with a trusted test account. Verify identity mismatch handling, a real read and import, pagination, a partial outage and an attempted write that produces no external change. The current account spend limit prevents this verification.
2. Verify browser alert display, notification clicks and permission recovery in the supported customer browsers and operating systems. Push service acceptance alone is insufficient.
3. Have a small customer pilot follow the README from a clean machine and verify sign in, source configuration, startup, reminder delivery and recovery. Record the supported configuration and any failures before expanding access.

Windows remains unverified. Login startup is macOS only. Linux support is for manual local startup and the automated workflow. Source authentication is owned by the selected CLI and service; setup and doctor do not grant access or prove connectivity.

## Recovery

Before updating an existing installation, create a new backup with `npm run backup -- /absolute/path/new-backup.sqlite`. Update the code, run `npm ci`, run doctor and build again. Keep the prior checkout and data until the update is verified.

If recovery is needed, stop Forma and use `npm run restore -- /absolute/path/backup.sqlite /absolute/path/new-data-directory`. Start the prior compatible checkout with `TODOS_DATA_DIR` pointing to that new directory. The restore command never overwrites an existing directory. MCP configuration and external credentials need their own private backup.
