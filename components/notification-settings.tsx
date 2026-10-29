"use client";
import { useEffect, useState } from 'react';
import { Button } from '@/components/arc/button/button';
function withTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('The browser did not finish enabling notifications. Open Forma in Chrome, Firefox or Safari and try again.')), 15000); work.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); }); });
}
export function NotificationSettings() {
  const [status, setStatus] = useState('Checking this browser…');
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    async function check() {
      const available = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext;
      if (!available) { if (active) setStatus('Open Forma in Chrome, Firefox or Safari to enable push notifications.'); return; }
      if (active) setSupported(true);
      const reg = await withTimeout(navigator.serviceWorker.register('/notification-worker.js'));
      const sub = await reg?.pushManager.getSubscription();
      const response = await fetch('/api/notifications');
      if (!response.ok) throw new Error('Could not check notification settings.');
      const data = await response.json();
      if (active) { setEnabled(Boolean(sub) && Notification.permission === 'granted'); setStatus(data.lastError || (sub ? 'Notifications enabled in this browser.' : Notification.permission === 'denied' ? 'Notifications are blocked. Allow them in your browser site settings.' : 'Notifications are off in this browser.')); }
    }
    void check().catch(() => { if (active) setStatus('Could not check notification settings. Try reopening this panel.'); });
    return () => { active = false; };
  }, []);
  async function toggle() {
    setBusy(true);
    try {
      if (!enabled && await withTimeout(Notification.requestPermission()) !== 'granted') { setStatus('Allow notifications in your browser site settings to enable reminders.'); return; }
      const registration = await withTimeout(navigator.serviceWorker.register('/notification-worker.js'));
      if (enabled) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const response = await fetch('/api/notifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
          if (!response.ok) throw new Error('Could not disable notifications. Try again.');
          await subscription.unsubscribe();
        }
        setEnabled(false); setStatus('Notifications disabled in this browser.'); return;
      }
      const ready = await withTimeout(navigator.serviceWorker.ready);
      const response = await fetch('/api/notifications');
      if (!response.ok) throw new Error('Could not load notification settings.');
      const { publicKey } = await response.json();
      const subscription = await ready.pushManager.getSubscription() || await withTimeout(ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey }));
      const saved = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) });
      if (!saved.ok) { const result = await saved.json(); throw new Error(result.error || 'Could not save notifications.'); }
      setEnabled(true); setStatus('Notifications enabled in this browser.');
    } catch (error) { setStatus((error as Error).message); } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true);
    try { const reg = await withTimeout(navigator.serviceWorker.ready); await reg.showNotification('Forma: notification display test', { body: 'A display test was requested on this device. Open Forma to review your reminder preferences.', tag: 'forma-test', icon: '/icon.svg' }); setStatus('Display test requested. Check your system notifications. This does not test reminder delivery from the server.'); }
    catch { setStatus('Could not show the test notification. Check browser and system notification settings.'); } finally { setBusy(false); }
  }
  return <div className="sync-details"><p>Morning overview at <strong>9:10 am</strong>. Evening reminder at <strong>5 pm</strong>. Both use London time, including daylight saving.</p><p>Your inbox keeps contextual reminders, meeting alerts and source updates. Browser alerts follow your quiet hours and daily limits. Task details are hidden unless you enable them above.</p><p role="status">{status}</p><div className="notification-actions"><Button disabled={!supported || busy} onClick={() => void toggle()}>{busy ? 'Saving…' : enabled ? 'Disable notifications' : 'Enable notifications'}</Button>{enabled && <Button variant="secondary" disabled={busy} onClick={() => void test()}>Send test notification</Button>}</div><p className="muted">Forma saves reminders before attempting delivery. Failed attempts retry with increasing delays. Browser and system settings can prevent display. Meeting alerts expire soon after their start time and daily summaries expire after 30 minutes. Your inbox remains available.</p></div>;
}
