import type { RequestHandler } from './$types';
import * as publicEnv from '$app/env/public';
import { apiUrl } from '#lib/apiConfig.ts';
import {
    readSiteProfile,
    readPublishedPosts,
    markdownText,
    validDate,
    publicResponse
} from '#lib/server/publicMetadata.ts';

export const GET: RequestHandler = async ({ request }) => {
    const [author, posts] = await Promise.all([readSiteProfile(), readPublishedPosts()]);
    const authorName = markdownText(author.name);
    const authorHeadline = markdownText(author.headline);
    const authorBio = markdownText(author.bio);
    const SITE_URL = author.siteUrl;
    const API_URL = apiUrl('', publicEnv.PUBLIC_API_BASE_URL);

    let md = `# ${authorName} — ${authorHeadline}

> ${authorBio}

Welcome to the LLM & AI Agent directory for ${authorName}'s developer portfolio. This file provides structured links to Markdown documents, public APIs, RSS feeds, and site documentation.

## Core Information & APIs

- [Profile Markdown](${API_URL}/author?output=md): Full author profile, technical skills, experiences, and contact channels in Markdown.
- [Public API Documentation](${API_URL}): Human-friendly documentation for REST & Markdown API endpoints.
- [OpenAPI (JSON)](${API_URL}/openapi.json): Machine-readable OpenAPI v3 JSON specification for all public APIs.
- [OpenAPI (YAML)](${API_URL}/openapi.yaml): Same spec in YAML format.
- [Agent Skills Discovery](${SITE_URL}/.well-known/agent-skills/index.json): Per-endpoint agent skill descriptors with content digests for automated agent integration.
- [API Catalog (RFC 9727)](${SITE_URL}/.well-known/api-catalog): Linkset of all public API endpoints for service discovery.
- [Atom Feed](${SITE_URL}/atom.xml): Atom feed containing recent blog post summaries.
- [XML Sitemap](${SITE_URL}/sitemap.xml): Complete URL index for web crawlers.
- [CV Download PDF](${API_URL}/cv?output=pdf): Official curriculum vitae PDF file.
- [CV Verification Bundle](${API_URL}/cv?output=zip): The CV PDF with its checksums, detached OpenPGP signatures, public key and VERIFY.txt.
- [OpenPGP Public Key](${SITE_URL}/pgp.asc): ASCII-armored key that signs the CV, also discoverable through WKD.

## Posts (Markdown API)

`;

    if (posts && posts.length > 0) {
        posts.forEach(post => {
            const dateStr = validDate(post.created_at)?.split('T')[0] ?? 'unknown';
            md += `- [${markdownText(post.title)}](${SITE_URL}/blog/${encodeURIComponent(post.slug)}.md): Published on ${dateStr}. ID: \`${post.id}\`. ${post.excerpt ? `— ${markdownText(post.excerpt)}` : ''}\n`;
        });
    } else {
        md += `*No published posts available.*\n`;
    }

    md += `\n## Optional\n\n`;
    md += `- [JSON Author API](${API_URL}/author): Full author dataset in JSON format.\n`;
    md += `- [JSON Blog Catalog](${API_URL}/blog): Catalog of published blog posts in JSON format.\n`;

    return publicResponse(request, md, 'text/markdown; charset=utf-8', 300);
};
