export function isLocalWrite(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  // Next can normalize request.url to localhost even when the browser uses 127.0.0.1.
  // Compare the browser's origin to the actual Host instead of that internal URL.
  if (!origin) return true;
  return host !== null && origin === `http://${host}` && /^(127\.0\.0\.1|localhost):5184$/.test(host);
}
