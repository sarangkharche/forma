export async function openCodex(url: string) {
  const response = await fetch('/api/open-codex', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not open Codex.');
}
