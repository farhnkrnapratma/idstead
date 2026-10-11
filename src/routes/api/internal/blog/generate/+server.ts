import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { extractDefineBlock } from '#lib/define.ts';
import { isAiBindingAvailable, generateSummary, generateTldr } from '#lib/server/blogAi.ts';
import { workerBinding } from '#lib/server/workerEnv.ts';

export const POST: RequestHandler = async ({ request, url, platform }) => {
    if (!isSameOriginRequest(request, url)) {
        return apiError(
            403,
            'FORBIDDEN_ORIGIN',
            'Cross-origin requests are not allowed on this endpoint.'
        );
    }

    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    let body: { markdown?: string };
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Request body must be valid JSON.');
    }

    const rawMarkdown = body.markdown?.trim();
    if (!rawMarkdown) {
        return apiError(400, 'BLOG_GENERATE_CONTENT_REQUIRED', 'Markdown content is required.');
    }

    const { body: markdownForSummary } = extractDefineBlock(rawMarkdown);

    const ai = await workerBinding('AI');
    if (!isAiBindingAvailable(ai)) {
        return apiError(
            503,
            'BLOG_AI_UNAVAILABLE',
            'AI content generation is temporarily unavailable. Please try again later.'
        );
    }

    const [summaryResult, tldrResult] = await Promise.allSettled([
        generateSummary(markdownForSummary, ai),
        generateTldr(markdownForSummary, ai)
    ]);

    const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
    const tldr = tldrResult.status === 'fulfilled' ? tldrResult.value : null;

    return json({ summary, tldr });
};
