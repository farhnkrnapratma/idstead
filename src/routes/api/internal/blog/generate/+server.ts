import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {requireAdminAuth} from '$lib/server/adminCv';
import {extractPostConfig} from '$lib/markdown';
import {extractDefineBlock} from '$lib/define';
import {
  isAiBindingAvailable,
  generateExcerpt,
  generateSummary,
  generateTldr,
  isRedundant
} from '$lib/server/blogAi';

export const POST: RequestHandler = async ({request, url, platform}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(
      403,
      'FORBIDDEN_ORIGIN',
      'Cross-origin requests are not allowed on this endpoint.'
    );
  }

  const authError = await requireAdminAuth(request, platform);
  if (authError) return authError;

  let body: {
    markdown?: string;
    needsExcerpt?: boolean;
    title?: string;
    excerpt?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return apiError(
      400,
      'INVALID_JSON_BODY',
      'Request body must be valid JSON.'
    );
  }

  const rawMarkdown = body.markdown?.trim();
  if (!rawMarkdown) {
    return apiError(
      400,
      'BLOG_GENERATE_CONTENT_REQUIRED',
      'Markdown content is required.'
    );
  }

  const {body: markdown} = extractPostConfig(rawMarkdown);
  const {body: markdownForSummary} = extractDefineBlock(markdown);

  const ai = (platform as unknown as {env?: {AI?: unknown}})?.env?.AI;
  if (!isAiBindingAvailable(ai)) {
    return apiError(
      503,
      'BLOG_AI_UNAVAILABLE',
      'AI content generation is temporarily unavailable. Please try again later.'
    );
  }

  const [excerptResult, summaryResult, tldrResult] = await Promise.allSettled([
    body.needsExcerpt ?
      generateExcerpt(markdownForSummary, ai)
    : Promise.resolve(null),
    generateSummary(markdownForSummary, ai),
    generateTldr(markdownForSummary, ai)
  ]);

  const excerpt =
    excerptResult.status === 'fulfilled' ? excerptResult.value : null;
  let summary =
    summaryResult.status === 'fulfilled' ? summaryResult.value : null;
  const tldr = tldrResult.status === 'fulfilled' ? tldrResult.value : null;

  if (
    body.needsExcerpt
    && excerpt
    && summary
    && isRedundant(excerpt, summary)
  ) {
    summary = null;
  }

  return json({excerpt, summary, tldr});
};
