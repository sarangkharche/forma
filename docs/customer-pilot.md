# Customer pilot

Use this guide for a small assisted pilot before general customer availability. Keep the results private. Do not include credentials, notification subscription endpoints, source documents or private task exports in a public issue.

This is a test plan. No customer has completed it yet.

## Record the configuration

Record the exact Git commit, operating system, browser version, Node and npm versions, chosen AI provider and CLI version. Use the latest patch of Node 22 or 24. Windows has not been verified. Login startup is available only on macOS.

Use a new installation and a dedicated test workspace with synthetic tasks. Start with manual mode. Leave the pilot user's existing Forma installation and data available for recovery. Only use external accounts and source scopes the tester is authorised to access.

## Install and use the dashboard

1. Follow the README from a new clone. Run `npm ci`, `npm run setup`, `npm run doctor`, `npm run build` and `npm start`.
2. Choose to skip AI during setup. Confirm the dashboard starts at `http://127.0.0.1:5184` and contains no imported tasks. An existing process on port 5184 must be stopped by its owner before starting this installation.
3. Create a synthetic task, edit its context, mark it complete and reopen it. Refresh the page and restart Forma. Confirm the saved state survives.
4. Run `npm run backup -- /absolute/path/new-backup.sqlite`. Restore it with `npm run restore -- /absolute/path/new-backup.sqlite /absolute/path/new-data-directory`. Stop Forma, then start it with `TODOS_DATA_DIR` set to the restored directory. Confirm the task, human edits and preferences are intact.
5. On macOS, preview `npm run install:startup -- --dry-run`. If the tester chooses login startup, install it, verify a restart and remove it with `npm run uninstall:startup`. Confirm task data remains. Do not replace an unrecognised existing service.

## Verify notifications

1. Open the notification inbox and Settings. Choose Enable notifications and answer the browser's permission prompt. Record the visible permission result. If blocked, use the browser's settings for this local site to allow notifications, reopen the panel and retry. Do not change broader security settings.
2. Choose Send test notification. Visually verify the system alert or notification centre entry. The button tests the browser display path; its success message alone does not prove a banner appeared or that server reminders work.
3. After enabling notifications, create a new high priority synthetic task. Keep Forma's server and workers running. Verify that the reminder appears in the inbox and that an actual system alert is visible. Quiet hours and the daily limit can defer browser alerts.
4. Click the actual system alert. Confirm Forma opens or focuses and shows the notification inbox. Record this separately from display.
5. Disable notifications in Forma, then enable them again. Confirm reminders still arrive and there are no duplicate alerts. Verify denied permission recovery separately if it was not exercised in step 1.
6. Repeat for each browser and operating system included in the planned customer support promise. Record browser push acceptance, browser display confirmation, visible OS display and click behaviour as separate results.

## Verify each AI provider and source

1. Install and sign in to the chosen CLI using its official instructions. Select the provider in Forma and run `npm run doctor -- --check-auth`. This checks local authentication status rather than model access or source permissions.
2. Use a synthetic task to check analysis, interruption, saved context and error recovery. Confirm an AI result never completes the task for the user.
3. Configure the exact trusted source identity and read tools using the README. Record the verified account, workspace and bounded search range privately. Do not assume a connector available in another app is available to Forma's CLI.
4. Create a known unfinished action in an approved test source through its normal UI. Sync and verify its title, ownership and primary link. Sync again and confirm no duplicate. Edit the task in Forma and confirm another sync preserves the human edit.
5. Test identity mismatch without granting broader access. Confirm that source is not searched or imported. Test a paginated source containing a known action on a later page and confirm the full bounded result is inspected.
6. Make one test source unavailable. Confirm existing tasks survive and coverage reports the limitation rather than claiming there are no actions.
7. Use a disposable synthetic MCP fixture to test an unlisted write tool. Verify denial and an unchanged mutation marker. Never try a write against a real customer service to test the guard.
8. Record provider quota, missing permissions and unsupported capabilities as blocked checks. Do not mark them passed because mocked tests succeeded.

## Decide whether to expand access

Record each step as pass, fail, blocked or not tested with the observed result and a private evidence link. Include whether the tester needed help that the README did not provide. Report reproducible app defects without private source content.

General availability still needs completed live provider and source checks, visible notification display and clicks on the supported configurations and a successful customer installation. A prepared checklist or an agent's installation rehearsal does not complete the customer pilot.
