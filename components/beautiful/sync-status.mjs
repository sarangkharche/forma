export function syncPresentation(status, pending = false, error = '') {
  if (pending) return { tone: 'active', label: 'Starting sync', detail: 'Submitting your request to Codex.' };
  if (error) return { tone: 'failed', label: 'Sync needs attention', detail: error };
  const states = {
    queued: { tone: 'active', label: 'Sync queued', detail: 'Waiting for Codex to start.' },
    processing: { tone: 'active', label: 'Checking work sources', detail: 'Codex is checking for tasks and source updates.' },
    submitted: { tone: 'active', label: 'Sync in progress', detail: 'Waiting for the Codex result to be imported. Your tasks will refresh after import.' },
    completed: { tone: 'done', label: 'Sync completed', detail: 'The result was imported. Tasks and source coverage are updated.' },
    failed: { tone: 'failed', label: 'Sync failed', detail: 'Check the sync chat before trying again.' },
  };
  return states[status] || { tone: 'idle', label: 'Ready to sync', detail: 'Check configured sources for new tasks.' };
}
