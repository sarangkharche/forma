export function syncPresentation(status, pending = false, error = '') {
  if (pending) return { tone: 'active', label: 'Starting sync', detail: 'Submitting your sync request.' };
  if (error) return { tone: 'failed', label: 'Sync needs attention', detail: error };
  const states = {
    queued: { tone: 'active', label: 'Sync queued', detail: 'Waiting for the local worker to start.' },
    processing: { tone: 'active', label: 'Checking work sources', detail: 'Checking for tasks and source updates.' },
    submitted: { tone: 'active', label: 'Sync in progress', detail: 'Waiting for the analysis result to be imported. Your tasks will refresh after import.' },
    completed: { tone: 'done', label: 'Sync completed', detail: 'The latest task and source coverage information is available.' },
    failed: { tone: 'failed', label: 'Sync failed', detail: 'Check the sync run before trying again.' },
  };
  return states[status] || { tone: 'idle', label: 'Ready to sync', detail: 'Check configured sources for new tasks.' };
}
