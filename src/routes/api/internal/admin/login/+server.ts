/** @format */

import {json} from '@sveltejs/kit'
import type {RequestHandler} from './$types'
import {supabase} from '$lib/supabase'
import {verifyTurnstileToken} from '$lib/server/turnstile'
import {apiError} from '$lib/server/apiError'
import {
  checkLoginLockout,
  recordFailedLogin,
  clearLoginAttempts
} from '$lib/server/loginRateLimit'

function getClientIp(request: Request, getClientAddress: () => string) {
  try {
    return (
      request.headers.get('cf-connecting-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || getClientAddress()
      || '127.0.0.1'
    )
  } catch {
    return '127.0.0.1'
  }
}

export const POST: RequestHandler = async ({
  request,
  platform,
  getClientAddress
}) => {
  const clientIp = getClientIp(request, getClientAddress)

  const lockout = checkLoginLockout(clientIp)
  if (!lockout.allowed) {
    return apiError(
      429,
      'ADMIN_LOGIN_LOCKED',
      'Too many failed login attempts. Please wait before retrying.',
      `Retry after ${lockout.retryAfterSeconds}s.`
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.')
  }

  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const turnstileToken =
    typeof body?.turnstileToken === 'string' ? body.turnstileToken : ''

  if (!email || !password) {
    return apiError(
      400,
      'ADMIN_LOGIN_CREDENTIALS_REQUIRED',
      'email and password are required.'
    )
  }

  const turnstileOk = await verifyTurnstileToken(
    turnstileToken,
    getClientAddress(),
    platform
  )
  if (!turnstileOk) {
    recordFailedLogin(clientIp)
    return apiError(
      403,
      'ADMIN_LOGIN_TURNSTILE_FAILED',
      'Turnstile verification failed.'
    )
  }

  const {data, error} = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error || !data.session) {
    recordFailedLogin(clientIp)
    return apiError(
      401,
      'ADMIN_LOGIN_INVALID_CREDENTIALS',
      'Invalid email or password.'
    )
  }

  clearLoginAttempts(clientIp)
  return json({session: data.session})
}
