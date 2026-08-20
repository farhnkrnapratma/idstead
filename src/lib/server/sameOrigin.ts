export function isSameOriginRequest(request: Request, url: URL): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === url.origin;
}
