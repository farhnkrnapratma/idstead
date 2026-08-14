/** @format */

import {json} from '@sveltejs/kit'
import type {RequestHandler} from './$types'
import {isNameReserved} from '$lib/utils/nameValidator'
import {verifyTurnstileToken} from '$lib/server/turnstile'
import {apiError} from '$lib/server/apiError'
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin'
import {isSameOriginRequest} from '$lib/server/sameOrigin'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Fallback moderation used only when the Cloudflare Workers AI binding is
// unavailable (e.g. plain `vite dev` without `wrangler pages dev --ai AI`, or
// a transient AI call failure). Rules-based, not an AI classifier.
const BLOCKED_PATTERNS: RegExp[] = [
  /\bviagra\b/i,
  /\bcasino\b/i,
  /\bporn(hub)?\b/i,
  /\bxxx\b/i,
  /f+u+c+k+/i,
  /\bsh[i1]t\b/i,
  /\bb[i1]tch\b/i,
  /\bassh[o0]le\b/i
]

interface ModerationResult {
  safe: boolean
  categories: string[]
  engine: 'llama-guard-3' | 'heuristic'
}

function heuristicModerate(content: string): Omit<ModerationResult, 'engine'> {
  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 2000)
    return {safe: false, categories: ['length']}

  const urlCount = (trimmed.match(/https?:\/\//gi) || []).length
  if (urlCount >= 3) return {safe: false, categories: ['S11']}

  const letters = trimmed.replace(/[^a-zA-Z]/g, '')
  const upper = trimmed.replace(/[^A-Z]/g, '')
  if (letters.length > 20 && upper.length / letters.length > 0.7)
    return {safe: false, categories: ['S11']}

  if (/(.)\1{9,}/.test(trimmed)) return {safe: false, categories: ['S11']}

  if (BLOCKED_PATTERNS.some(re => re.test(trimmed)))
    return {safe: false, categories: ['S4']}

  // Send to manual moderation queue instead of auto-approving when AI is down
  return {safe: false, categories: ['pending-manual-review']}
}

// Cloudflare AI binding isn't typed without @cloudflare/workers-types, so this
// takes the loosely-typed `platform.env.AI` and narrows it defensively.
async function moderateContent(
  content: string,
  ai: unknown
): Promise<ModerationResult> {
  if (ai && typeof (ai as {run?: unknown}).run === 'function') {
    try {
      const runner = ai as {
        run: (model: string, input: unknown) => Promise<unknown>
      }
      const result = await runner.run('@cf/meta/llama-guard-3-8b', {
        messages: [{role: 'user', content}],
        max_tokens: 128,
        temperature: 0
      })
      const text = String(
        (result as {response?: string})?.response ?? ''
      ).trim()
      const isSafe = text.toLowerCase().startsWith('safe')
      const categories =
        isSafe ?
          []
        : (text
            .split('\n')[1]
            ?.split(',')
            .map(s => s.trim())
            .filter(Boolean) ?? [])
      return {safe: isSafe, categories, engine: 'llama-guard-3'}
    } catch (err) {
      console.error(
        'Llama Guard moderation failed, falling back to heuristic:',
        err
      )
    }
  }
  return {...heuristicModerate(content), engine: 'heuristic'}
}

export const POST: RequestHandler = async ({
  request,
  url,
  platform,
  getClientAddress
}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(
      403,
      'FORBIDDEN_ORIGIN',
      'Cross-origin requests are not allowed on this endpoint.'
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.')
  }

  const turnstileToken =
    typeof body?.turnstileToken === 'string' ? body.turnstileToken : ''
  const turnstileOk = await verifyTurnstileToken(
    turnstileToken,
    getClientAddress(),
    platform
  )
  if (!turnstileOk) {
    return apiError(
      403,
      'BLOG_COMMENT_TURNSTILE_FAILED',
      'Turnstile verification failed.'
    )
  }

  const postId = typeof body?.postId === 'string' ? body.postId.trim() : ''
  const parentId =
    typeof body?.parentId === 'string' && body.parentId.trim() ?
      body.parentId.trim()
    : null
  const isAnonymous = Boolean(body?.isAnonymous)
  const authorName =
    typeof body?.authorName === 'string' ? body.authorName.trim() : ''
  const content = typeof body?.content === 'string' ? body.content.trim() : ''

  if (!postId || !UUID_RE.test(postId)) {
    return apiError(
      400,
      'BLOG_COMMENT_INVALID_POST_ID',
      'postId is required and must be a valid UUID.'
    )
  }
  if (parentId && !UUID_RE.test(parentId)) {
    return apiError(
      400,
      'BLOG_COMMENT_INVALID_PARENT_ID',
      'parentId must be a valid UUID.'
    )
  }
  if (!content) {
    return apiError(
      400,
      'BLOG_COMMENT_CONTENT_REQUIRED',
      'content is required.'
    )
  }
  if (content.length > 2000) {
    return apiError(
      400,
      'BLOG_COMMENT_CONTENT_TOO_LONG',
      'content must be 2000 characters or fewer.',
      `Received ${content.length} characters.`
    )
  }
  if (!isAnonymous && !authorName) {
    return apiError(
      400,
      'BLOG_COMMENT_AUTHOR_NAME_REQUIRED',
      'authorName is required unless isAnonymous is true.'
    )
  }
  if (!isAnonymous && isNameReserved(authorName)) {
    return apiError(
      400,
      'BLOG_COMMENT_AUTHOR_NAME_RESERVED',
      'This name cannot be used. Please use another name.'
    )
  }

  const moderation = await moderateContent(
    content,
    (platform as unknown as {env?: {AI?: unknown}})?.env?.AI
  )

  // Comments RLS no longer grants anon/authenticated an INSERT policy at
  // all (a direct REST call with only the public anon key could previously
  // insert a pre-approved comment, bypassing Turnstile and moderation
  // entirely) - the moderated insert now requires the service-role client,
  // which only this trusted server route has access to.
  const adminClient = getSupabaseAdminClient(platform)
  if (!adminClient) {
    return apiError(
      500,
      'BLOG_COMMENT_SERVICE_UNAVAILABLE',
      'Comment submission is temporarily unavailable.'
    )
  }

  const {data, error: dbErr} = await adminClient
    .from('db_comments')
    .insert({
      post_id: postId,
      parent_id: parentId,
      author_name: isAnonymous ? '' : authorName,
      content,
      is_anonymous: isAnonymous,
      is_approved: moderation.safe
    })
    .select(
      'id, post_id, parent_id, author_name, content, is_anonymous, is_approved, created_at'
    )
    .single()

  if (dbErr) {
    return apiError(500, 'BLOG_COMMENT_SAVE_FAILED', 'Could not save comment.')
  }

  return json(
    {
      is_approved: moderation.safe,
      comment: data,
      moderation: {engine: moderation.engine, categories: moderation.categories}
    },
    {status: 201}
  )
}
