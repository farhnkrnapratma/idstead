export function isSameOriginRequest(request: Request, url: URL): boolean {
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin;

  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') return true;

  const site = request.headers.get('sec-fetch-site');
  return site === 'same-origin';
}
