import {sequence} from '@sveltejs/kit/hooks'
import * as Sentry from '@sentry/sveltekit'
import {redirect, type Handle} from '@sveltejs/kit'
import {env as publicEnv} from '$env/dynamic/public'
import {dev} from '$app/environment'

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 60

function getCdnBaseUrl(): string {
  const base = (publicEnv.PUBLIC_CDN_BASE_URL ?? '').trim()
  if (!base) return ''
  return base.replace(/\/+$/, '')
}

interface RateLimitRecord {
  timestamps: number[]
}

const rateLimitMap = new Map<string, RateLimitRecord>()

function getClientIp(event: any): string {
  try {
    return (
      event.request.headers.get('cf-connecting-ip')
      || event.request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || event.getClientAddress?.()
      || '127.0.0.1'
    )
  } catch {
    return '127.0.0.1'
  }
}

export const handle: Handle = sequence(
  Sentry.initCloudflareSentryHandle({
    dsn: publicEnv.PUBLIC_SENTRY_DSN || '',
    environment: publicEnv.PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    tracesSampleRate: dev ? 0 : 1.0,
    enableLogs: !dev
  }),
  Sentry.sentryHandle(),
  async ({event, resolve}) => {
    const requestId =
      event.request.headers.get('x-request-id') || crypto.randomUUID()

    if (event.url.hostname === 'www.fkp.my.id') {
      throw redirect(
        301,
        `https://fkp.my.id${event.url.pathname}${event.url.search}`
      )
    }

    const cdnBaseUrl = getCdnBaseUrl()

    if (
      event.url.pathname.startsWith('/fonts/')
      || event.url.pathname === '/site.webmanifest'
    ) {
      if (cdnBaseUrl) {
        try {
          const cdnRes = await event.fetch(`${cdnBaseUrl}${event.url.pathname}`)
          if (cdnRes.ok) {
            const ext = event.url.pathname.split('.').pop()?.toLowerCase()
            const mime =
              ext === 'otf' ? 'font/otf'
              : ext === 'woff2' ? 'font/woff2'
              : ext === 'webmanifest' || ext === 'json' ?
                'application/manifest+json'
              : cdnRes.headers.get('content-type') || 'application/octet-stream'

            return new Response(cdnRes.body, {
              status: 200,
              headers: {
                'Content-Type': mime,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=31536000, immutable'
              }
            })
          }
        } catch {}
      }
    }

    if (
      [
        '/favicon.ico',
        '/favicon-16x16.png',
        '/favicon-32x32.png',
        '/apple-touch-icon.png',
        '/android-chrome-192x192.png',
        '/android-chrome-512x512.png'
      ].includes(event.url.pathname)
    ) {
      if (!cdnBaseUrl) {
        throw redirect(307, event.url.pathname)
      }

      throw redirect(301, `${cdnBaseUrl}${event.url.pathname}`)
    }

    const pathname = event.url.pathname.toLowerCase().replace(/\/$/, '')

    if (
      ['/blog', '/projects', '/contact', '/cv', '/funding', '/home'].includes(
        pathname
      )
    ) {
      const section = pathname.replace('/', '')
      throw redirect(307, `/#${section}`)
    }

    const isApiRequest =
      event.url.pathname.startsWith('/api/')
      || event.url.pathname === '/api'
      || (event.request.headers.get('accept')?.includes('application/json')
        ?? false)

    const isInternalApi = event.url.pathname.startsWith('/api/internal')
    const isAdminApi = event.url.pathname.startsWith('/api/internal/admin')

    let rateLimitHeaders: Record<string, string> = {}

    if (isApiRequest && !isAdminApi) {
      const clientIp = getClientIp(event)
      const now = Date.now()
      const record = rateLimitMap.get(clientIp) || {timestamps: []}

      record.timestamps = record.timestamps.filter(
        t => now - t < RATE_LIMIT_WINDOW_MS
      )

      const limiter = event.platform?.env?.API_RATE_LIMITER
      const isLimited =
        limiter ?
          !(await limiter.limit({key: clientIp})).success
        : record.timestamps.length >= MAX_REQUESTS_PER_WINDOW

      if (isLimited) {
        const oldest = record.timestamps[0] ?? now
        const resetSeconds = Math.max(
          1,
          Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000)
        )
        return new Response(
          JSON.stringify({
            error: {
              code: 'RATE_LIMITED',
              message: 'Rate limit exceeded. Please wait before retrying.'
            }
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
              'X-Request-ID': requestId,
              ...(isInternalApi ? {} : {'Access-Control-Allow-Origin': '*'}),
              'Retry-After': String(resetSeconds > 0 ? resetSeconds : 60),
              'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(
                Math.floor(
                  (now + (resetSeconds > 0 ? resetSeconds : 60) * 1000) / 1000
                )
              )
            }
          }
        )
      }

      record.timestamps.push(now)
      rateLimitMap.set(clientIp, record)

      const remaining = MAX_REQUESTS_PER_WINDOW - record.timestamps.length
      const resetTime = Math.floor((now + RATE_LIMIT_WINDOW_MS) / 1000)

      rateLimitHeaders = {
        'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(resetTime)
      }
    }

    if (isApiRequest && event.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...(isInternalApi ? {} : {'Access-Control-Allow-Origin': '*'}),
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
          'X-Request-ID': requestId,
          ...rateLimitHeaders
        }
      })
    }

    const response = await resolve(event, {
      transformPageChunk: ({html}) => {
        const cdn = getCdnBaseUrl()
        if (cdn) {
          return html.replaceAll(`${cdn}//`, `${cdn}/`)
        }
        return html
      }
    })
    const contentType = response.headers.get('content-type') ?? ''

    if (isApiRequest) {
      response.headers.set('X-Request-ID', requestId)
      if (!isInternalApi) {
        response.headers.set('Access-Control-Allow-Origin', '*')
      }
    }

    if (isApiRequest && !isAdminApi) {
      for (const [hKey, hVal] of Object.entries(rateLimitHeaders)) {
        response.headers.set(hKey, hVal)
      }
    }

    if (
      isApiRequest
      && (response.status >= 400 || contentType.includes('text/html'))
    ) {
      const httpStatus = response.status >= 400 ? response.status : 404

      const DEFAULT_CODES: Record<number, string> = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        429: 'RATE_LIMITED'
      }
      const DEFAULT_MESSAGES: Record<number, string> = {
        400: 'The request was invalid.',
        401: 'Authentication is required to access this privileged endpoint.',
        403: 'You do not have permission to access this privileged resource.',
        404: 'Requested API endpoint or resource does not exist.',
        429: 'Rate limit exceeded. Please wait before retrying.'
      }

      let errorCode = DEFAULT_CODES[httpStatus] ?? 'INTERNAL_ERROR'
      let errorMessage =
        DEFAULT_MESSAGES[httpStatus]
        ?? 'An unexpected error occurred while processing the request.'
      let errorDetails: string | undefined

      if (contentType.includes('application/json')) {
        try {
          const jsonBody = await response.clone().json()
          if (jsonBody && typeof jsonBody === 'object') {
            const isSensitive = (text: string) =>
              /row-level security|violates|postgres|supabase|column|relation|syntax error|duplicate key|PGRST|permission denied/i.test(
                text
              )

            if (typeof jsonBody.code === 'string' && jsonBody.code) {
              errorCode = jsonBody.code
            }

            const rawMessage = String(
              jsonBody.message ?? jsonBody.error ?? ''
            ).trim()
            if (rawMessage && !isSensitive(rawMessage)) {
              errorMessage = rawMessage.replace(/^\d{3}\s+[^:]+:\s*/, '')
            }

            const rawDetails = String(jsonBody.details ?? '').trim()
            if (rawDetails && !isSensitive(rawDetails)) {
              errorDetails = rawDetails
            }
          }
        } catch (err) {}
      }

      const errHeaders: Record<string, string> = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
        ...(isInternalApi ? {} : {'Access-Control-Allow-Origin': '*'}),
        ...rateLimitHeaders
      }

      return new Response(
        JSON.stringify({
          error: {
            code: errorCode,
            message: errorMessage,
            ...(errorDetails ? {details: errorDetails} : {})
          }
        }),
        {status: httpStatus, headers: errHeaders}
      )
    }

    if (contentType.includes('text/html')) {
      response.headers.append(
        'Link',
        '</.well-known/api-catalog>; rel="api-catalog"'
      )
      response.headers.append(
        'Link',
        '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"'
      )
      response.headers.append(
        'Link',
        '</llms.txt>; rel="describedby"; type="text/markdown"'
      )
      response.headers.append(
        'Link',
        '</sitemap.xml>; rel="sitemap"; type="application/xml"'
      )
    }

    return response
  }
)

export const handleError = Sentry.handleErrorWithSentry()
