type PlatformEnv = {env?: {TURNSTILE_SECRET?: string}}

interface SiteverifyResponse {
  success: boolean
  'error-codes'?: string[]
}

export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteip: string,
  platform: unknown
): Promise<boolean> {
  if (!token) return false

  const secret =
    (platform as PlatformEnv | undefined)?.env?.TURNSTILE_SECRET
    ?? process.env.TURNSTILE_SECRET

  if (!secret) {
    console.error('TURNSTILE_SECRET is not configured.')
    return false
  }

  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({secret, response: token, remoteip})
      }
    )

    if (!res.ok) return false

    const result = (await res.json()) as SiteverifyResponse
    return result.success === true
  } catch (err) {
    console.error('Turnstile siteverify request failed:', err)
    return false
  }
}
