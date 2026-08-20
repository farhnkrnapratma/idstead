import {env as publicEnv} from '$env/dynamic/public';

function getSupabaseBaseUrl() {
  const urlRaw = publicEnv.PUBLIC_SUPABASE_URL;
  if (!urlRaw) return null;
  if (urlRaw.endsWith('/rest/v1') || urlRaw.endsWith('/rest/v1/')) {
    return urlRaw.replace(/\/rest\/v1\/?$/, '');
  }
  return urlRaw;
}

export async function proxyToSupabaseEdgeFunction(
  request: Request,
  functionName: string
) {
  const baseUrl = getSupabaseBaseUrl();
  const anonKey = publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!baseUrl || !anonKey) {
    return new Response(
      JSON.stringify({
        code: 500,
        error:
          '500 Internal Server Error: Supabase edge function is not configured.'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  const functionUrl = `${baseUrl}/functions/v1/${functionName}`;
  const authHeader = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  const accepts = request.headers.get('accept') || 'application/json';

  const headers = new Headers({apikey: anonKey, Accept: accepts});

  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const edgeResponse = await fetch(functionUrl, {
    method,
    headers,
    body: hasBody ? (request.body ?? null) : undefined,

    ...(hasBody ? {duplex: 'half'} : {})
  } as RequestInit);

  const resultBody = await edgeResponse.arrayBuffer();
  const responseHeaders = new Headers();
  const responseContentType = edgeResponse.headers.get('content-type');
  const responseCacheControl = edgeResponse.headers.get('cache-control');

  if (responseContentType) {
    responseHeaders.set('Content-Type', responseContentType);
  }
  if (responseCacheControl) {
    responseHeaders.set('Cache-Control', responseCacheControl);
  }

  return new Response(resultBody, {
    status: edgeResponse.status,
    headers: responseHeaders
  });
}
