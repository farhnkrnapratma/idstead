/** @format */

import {json} from '@sveltejs/kit'
import {supabase} from '$lib/supabase'
import type {RequestHandler} from './$types'
import {isNameReserved} from '$lib/nameValidator'

const FORBIDDEN_WORDS = [
  /anj\w+/i,
  /baf\w+/i,
  /baj\w+/i,
  /ngg\w+t/i,
  /nged\w+t/i,
  /kontol/i,
  /memek/i,
  /peler/i,
  /jembut/i,
  /fuck/i,
  /shit/i,
  /asshole/i,
  /bitch/i,
  /bastard/i,
  /spammer/i,
  /slot online/i,
  /judi/i,
  /gacor/i,
  /porn/i
]

const ANONYMOUS_AUTHOR = 'Anonymous'
const MAX_AUTHOR_LENGTH = 80
const MAX_CONTENT_LENGTH = 2000
const MAX_REPLY_DEPTH = 4

function localModerate(content: string): boolean {
  for (const pattern of FORBIDDEN_WORDS) {
    if (pattern.test(content)) {
      return false
    }
  }
  return true
}

function getCommentDepth(
  commentId: string | null,
  comments: Array<{id: string; parent_id: string | null}>
) {
  let depth = 0
  let currentId = commentId
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId)) return MAX_REPLY_DEPTH + 1
    visited.add(currentId)

    const current = comments.find(comment => comment.id === currentId)
    if (!current) break

    depth += 1
    currentId = current.parent_id
  }

  return depth
}

export const POST: RequestHandler = async ({request, platform}) => {
  try {
    const {
      postId,
      authorName,
      content,
      isAnonymous = false,
      parentId = null
    } = await request.json()
    const trimmedAuthorName =
      typeof authorName === 'string' ? authorName.trim() : ''
    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    const normalizedParentId =
      typeof parentId === 'string' && parentId.trim() ? parentId.trim() : null
    const anonymous = Boolean(isAnonymous)
    const displayName = anonymous ? ANONYMOUS_AUTHOR : trimmedAuthorName

    if (!postId || !trimmedContent || (!anonymous && !trimmedAuthorName)) {
      return json({message: 'Missing required fields'}, {status: 400})
    }

    if (!anonymous && isNameReserved(trimmedAuthorName)) {
      return json(
        {message: 'This name cannot be used. Please use another name.'},
        {status: 400}
      )
    }

    if (
      displayName.length > MAX_AUTHOR_LENGTH
      || trimmedContent.length > MAX_CONTENT_LENGTH
    ) {
      return json({message: 'Comment is too long.'}, {status: 400})
    }

    const {data: post, error: postError} = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return json({message: 'Post not found.'}, {status: 404})
    }

    if (normalizedParentId) {
      const {data: parentComment, error: parentError} = await supabase
        .from('comments')
        .select('id, post_id, is_approved')
        .eq('id', normalizedParentId)
        .single()

      if (
        parentError
        || !parentComment
        || parentComment.post_id !== postId
        || !parentComment.is_approved
      ) {
        return json({message: 'Reply target is not available.'}, {status: 400})
      }

      const {data: threadComments, error: threadError} = await supabase
        .from('comments')
        .select('id, parent_id')
        .eq('post_id', postId)

      if (threadError) {
        console.error('Failed to validate comment depth:', threadError)
        return json(
          {message: 'Failed to validate reply target.'},
          {status: 500}
        )
      }

      if (
        getCommentDepth(normalizedParentId, threadComments || [])
        >= MAX_REPLY_DEPTH
      ) {
        return json({message: 'Reply thread is too deep.'}, {status: 400})
      }
    }

    let isApproved = true
    let moderationSource = 'local_fallback'
    const moderationText =
      anonymous ?
        `Comment: "${trimmedContent}"`
      : `Name: "${displayName}"\nComment: "${trimmedContent}"`

    if (platform?.env?.AI) {
      try {
        const ai = platform.env.AI as {
          run: (
            model: string,
            options: Record<string, unknown>
          ) => Promise<{response?: string}>
        }
        const systemPrompt = `You are a content moderation AI. Analyze the following blog comment submission for hate speech, severe insults, harassment, threats, explicit content, or obvious spam.
Respond with exactly one word: "SAFE" if the comment is clean and allowed, or "BLOCKED" if it contains forbidden content. Do not include any other words, punctuation, or explanations.`

        const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            {role: 'system', content: systemPrompt},
            {role: 'user', content: moderationText}
          ]
        })

        const aiText = (response.response || '').trim().toUpperCase()
        if (aiText.includes('BLOCKED')) {
          isApproved = false
        } else if (aiText.includes('SAFE')) {
          isApproved = true
        } else {
          isApproved = localModerate(moderationText)
        }
        moderationSource = 'cloudflare_workers_ai'
      } catch (aiErr) {
        console.error(
          'Cloudflare Workers AI failed, falling back to local filter:',
          aiErr
        )
        isApproved = localModerate(moderationText)
      }
    } else {
      isApproved = localModerate(moderationText)
    }

    if (!isApproved) {
      return json(
        {
          is_approved: false,
          message: 'Comment was blocked by AI content moderation.'
        },
        {status: 400}
      )
    }

    const {data: comment, error} = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        parent_id: normalizedParentId,
        author_name: displayName,
        content: trimmedContent,
        is_anonymous: anonymous,
        is_approved: true
      })
      .select()
      .single()

    if (error) {
      console.error('Database error saving comment:', error)
      return json(
        {message: 'Failed to save comment to database'},
        {status: 500}
      )
    }

    return json({
      is_approved: true,
      comment,
      moderation_source: moderationSource
    })
  } catch (err) {
    const error = err as Error
    console.error('Comment API error:', error)
    return json(
      {message: error.message || 'Internal server error'},
      {status: 500}
    )
  }
}
