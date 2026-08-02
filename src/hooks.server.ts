/** @format */

import {sequence} from '@sveltejs/kit/hooks'
import * as Sentry from '@sentry/sveltekit'
import {redirect, type Handle} from '@sveltejs/kit'
import {PUBLIC_SENTRY_DSN} from '$env/static/public'

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 60

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
    dsn: PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
    enableLogs: true
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

    if (
      [
        '/favicon.ico',
        '/favicon-16x16.png',
        '/favicon-32x32.png',
        '/apple-touch-icon.png',
        '/android-chrome-192x192.png',
        '/android-chrome-512x512.png',
        '/site.webmanifest'
      ].includes(event.url.pathname)
    ) {
      throw redirect(301, `https://cdn.fkp.my.id${event.url.pathname}`)
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

    const isAdminApi = event.url.pathname.startsWith('/api/admin')
    let rateLimitHeaders: Record<string, string> = {}

    // Apply Rate Limiting to Public API Endpoints
    if (isApiRequest && !isAdminApi) {
      const clientIp = getClientIp(event)
      const now = Date.now()
      const record = rateLimitMap.get(clientIp) || {timestamps: []}

      record.timestamps = record.timestamps.filter(
        t => now - t < RATE_LIMIT_WINDOW_MS
      )

      if (record.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
        const oldest = record.timestamps[0]
        const resetSeconds = Math.ceil(
          (oldest + RATE_LIMIT_WINDOW_MS - now) / 1000
        )
        return new Response(
          JSON.stringify({
            code: 429,
            error:
              '429 Too Many Requests: Rate limit exceeded. Please wait before retrying.'
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
              'X-Request-ID': requestId,
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

    const response = await resolve(event)
    const contentType = response.headers.get('content-type') ?? ''

    if (isApiRequest) {
      response.headers.set('X-Request-ID', requestId)
    }

    // Attach Rate Limit headers to API responses
    if (isApiRequest && !isAdminApi) {
      for (const [hKey, hVal] of Object.entries(rateLimitHeaders)) {
        response.headers.set(hKey, hVal)
      }
    }

    if (
      isApiRequest
      && (response.status >= 400 || contentType.includes('text/html'))
    ) {
      const code = response.status >= 400 ? response.status : 404
      const statusText =
        code === 400 ? 'Bad Request'
        : code === 401 ? 'Unauthorized'
        : code === 403 ? 'Forbidden'
        : code === 404 ? 'Not Found'
        : code === 429 ? 'Too Many Requests'
        : 'Internal Server Error'

      let safeDetail = ''

      if (code === 401) {
        safeDetail =
          'Authentication is required to access this privileged endpoint.'
      } else if (code === 403) {
        safeDetail =
          'You do not have permission to access this privileged resource.'
      } else if (code === 404) {
        safeDetail = 'Requested API endpoint or resource does not exist.'
      } else if (code === 429) {
        safeDetail = 'Rate limit exceeded. Please wait before retrying.'
      } else if (code === 500) {
        safeDetail =
          'An unexpected error occurred while processing the request.'
      }

      if (contentType.includes('application/json')) {
        try {
          const jsonBody = await response.clone().json()
          if (
            jsonBody
            && typeof jsonBody === 'object'
            && ('error' in jsonBody || 'message' in jsonBody)
          ) {
            const rawMsg = String(
              jsonBody.error || jsonBody.message || ''
            ).trim()

            const isSensitive =
              /row-level security|violates|postgres|supabase|column|relation|syntax error|duplicate key|PGRST|permission denied/i.test(
                rawMsg
              )

            if (!isSensitive && rawMsg) {
              const cleanMsg = rawMsg.replace(/^\d{3}\s+[^:]+:\s*/, '')
              safeDetail = cleanMsg
            }
          }
        } catch (err) {
          // Fall back to safeDetail
        }
      }

      const formattedError = `${code} ${statusText}: ${safeDetail || 'Request could not be completed.'}`

      const errHeaders: Record<string, string> = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
        ...rateLimitHeaders
      }

      return new Response(JSON.stringify({code, error: formattedError}), {
        status: code,
        headers: errHeaders
      })
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
