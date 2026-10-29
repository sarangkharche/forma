# Notifications

Forma uses Next.js routes, the existing SQLite store and the web-push package. npm start and npm run dev start one notification worker alongside the web server. It checks every 15 seconds. No Express server or separate database is needed.

Enable notifications through the bell in Forma in a browser that supports PushManager. Permission is requested only when Enable notifications is clicked. Use one consistent localhost origin because browser permissions and subscriptions are scoped to origin. Each browser can disable its own subscription and send a local test notification.

Daily reminders run at 09:10 and 17:00 Europe/London, including daylight saving. They include counts of unfinished tasks, high priority tasks and tasks due today or overdue. Empty lists do not notify. A reminder remains eligible for 30 minutes after its scheduled time. Missed reminders outside that window are skipped.

New tasks created after that browser enabled notifications trigger grouped high priority alerts if still open. Existing high priority tasks are included in daily summaries without an initial flood. Done and archived tasks are excluded. Delivery receipts and browser subscriptions persist in SQLite. Successful push submission is recorded to prevent repeated alerts. HTTP 404 and 410 remove expired subscriptions; other failures retry on the next check. A successful push submission does not prove OS display. Notification payloads contain counts rather than titles, links or notes. The browser push provider receives an encrypted generic payload.

The Mac must be awake, online and running Forma. The tab can be closed, subject to browser background support and notification settings. This does not install a login agent or promise delivery while the Mac is asleep. Clicking a notification focuses Forma or opens its localhost homepage.

Validation: isolated tests cover London winter and summer scheduling, expiry, completed task exclusion, subscription endpoint validation, deduplication, later additions, failed sends and expired subscriptions. Browser permission and actual OS delivery must be tested through Enable notifications and Send test notification. Existing npm audit findings are in eslint-config-next and its development dependency chain, not web-push.

Sources: https://github.com/web-push-libs/web-push and https://developer.mozilla.org/en-US/docs/Web/API/Push_API.
