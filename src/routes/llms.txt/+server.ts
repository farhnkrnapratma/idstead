import type {RequestHandler} from './$types';
import {
  readSiteProfile,
  readPublishedPosts,
  markdownText,
  validDate,
  publicResponse
} from '$lib/server/publicMetadata';

export const GET: RequestHandler = async ({request}) => {
  const [author, posts] = await Promise.all([
    readSiteProfile(),
    readPublishedPosts()
  ]);
  const authorName = markdownText(author.name);
  const authorHeadline = markdownText(author.headline);
  const authorBio = markdownText(author.bio);
  const SITE_URL = author.siteUrl;

  let md = `# ${authorName} — ${authorHeadline}

> ${authorBio}

Welcome to the LLM & AI Agent directory for ${authorName}'s developer portfolio. This file provides structured links to Markdown documents, public APIs, RSS feeds, and site documentation.

## Core Information & APIs

- [Profile Markdown](${SITE_URL}/api/v1/author?format=md): Full author profile, technical skills, experiences, and contact channels in Markdown.
- [Public API Documentation](${SITE_URL}/api/v1): Human-friendly documentation for REST & Markdown API endpoints.
- [OpenAPI (JSON)](${SITE_URL}/.well-known/openapi.json): Machine-readable OpenAPI v3 JSON specification for all public APIs.
- [OpenAPI (YAML)](${SITE_URL}/.well-known/openapi.yaml): Same spec in YAML format.
- [Agent Skills Discovery](${SITE_URL}/.well-known/agent-skills/index.json): Per-endpoint agent skill descriptors with content digests for automated agent integration.
- [API Catalog (RFC 9727)](${SITE_URL}/.well-known/api-catalog): Linkset of all public API endpoints for service discovery.
- [Atom Feed](${SITE_URL}/atom.xml): Atom feed containing recent blog post summaries.
- [XML Sitemap](${SITE_URL}/sitemap.xml): Complete URL index for web crawlers.
- [CV Download PDF](${SITE_URL}/api/v1/cv): Official curriculum vitae PDF file.

## Posts (Markdown API)

`;

  if (posts && posts.length > 0) {
    posts.forEach(post => {
      const dateStr = validDate(post.created_at)?.split('T')[0] ?? 'unknown';
      md += `- [${markdownText(post.title)}](${SITE_URL}/api/v1/blog/${encodeURIComponent(post.slug)}?format=md): Published on ${dateStr}. ID: \`${post.id}\`. ${post.excerpt ? `— ${markdownText(post.excerpt)}` : ''}\n`;
    });
  } else {
    md += `*No published posts available.*\n`;
  }

  md += `\n## Optional\n\n`;
  md += `- [JSON Author API](${SITE_URL}/api/v1/author): Full author dataset in JSON format.\n`;
  md += `- [JSON Blog Catalog](${SITE_URL}/api/v1/blog): Catalog of published blog posts in JSON format.\n`;

  return publicResponse(request, md, 'text/markdown; charset=utf-8', 300);
};
