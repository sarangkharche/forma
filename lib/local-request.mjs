export function isLocalRequest(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  // Next can normalize request.url to localhost even when the browser uses 127.0.0.1.
  // Compare the browser's origin to the actual Host instead of that internal URL.
  return host !== null && /^(127\.0\.0\.1|localhost):5184$/.test(host)
    && (origin === null || origin === `http://${host}`);
}

export const isLocalWrite = isLocalRequest;
