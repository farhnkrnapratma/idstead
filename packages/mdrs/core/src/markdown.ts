// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { extractReferences, placeReferences } from './references';
import { extractFrontmatter } from './frontmatter';
import {
    MAX_DOCUMENT_LENGTH,
    extractDefineBlock,
    evaluateDefineBlock,
    hasDefineEntries,
    protectInterpolationTokens,
    resolveConditionals,
    resolveProtectedInterpolationTokens,
    documentFetcher,
    unavailableFetcher,
    type JsonFetcher
} from './define';
import { loadIcons } from './icons';
import { sanitizeHtml } from './sanitize';
import {
    placeholderPattern,
    placeholderPrefix,
    restoreAllPlaceholders,
    stripPlaceholderChars
} from './placeholders';
import { convertGithubAlerts } from './render/alerts';
import { parseContainers } from './render/containers';
import { parseDetailsBlocks } from './render/details';
import { formatFootnoteReferences } from './render/footnotes';
import {
    type HeadingItem,
    extractHeadings,
    injectHeadingIds,
    prefixHashLinks
} from './render/headings';
import { extractVerbatimBlocks, protectVerbatimBlocks } from './render/verbatim';
import { type MathSource, extractMath, renderMathSources } from './render/math';
import { parseWithOptions, type RenderOptions } from './render/parser';
import { parseSteps } from './render/steps';

export type { RenderOptions };

export async function resolveDefines(
    markdown: string,
    fetcher: JsonFetcher = unavailableFetcher()
): Promise<string> {
    const get = documentFetcher(fetcher);
    const source = stripPlaceholderChars(markdown);
    const { body } = extractFrontmatter(source);
    const frontmatter = source.slice(0, source.length - body.length);
    const { raw: defineRaw, body: withDefineGap } = extractDefineBlock(body);
    const bodyAfterDefine =
        defineRaw === null ? body : withDefineGap.replace(/^(?:[ \t]*\r?\n)+/, '');
    const interpolate = hasDefineEntries(defineRaw);
    const { scope } = interpolate
        ? await evaluateDefineBlock(defineRaw, get)
        : { scope: new Map() };
    const verbatimBlocks = new Map<string, string>();
    const { output: withConditionals } = await resolveConditionals(
        protectVerbatimBlocks(bodyAfterDefine, verbatimBlocks),
        scope,
        get,
        { inline: interpolate }
    );
    if (!interpolate) return frontmatter + restoreAllPlaceholders(withConditionals, verbatimBlocks);
    const interpolationPlaceholders = new Map<string, string>();
    const withTokensProtected = protectInterpolationTokens(
        withConditionals,
        interpolationPlaceholders
    );
    const { output } = await resolveProtectedInterpolationTokens(
        withTokensProtected,
        interpolationPlaceholders,
        scope,
        get
    );
    return frontmatter + restoreAllPlaceholders(output, verbatimBlocks);
}

export async function renderMarkdownUnsafe(
    markdown: string,
    fetcher: JsonFetcher = unavailableFetcher(),
    options: RenderOptions = {}
): Promise<string> {
    if (markdown.length > MAX_DOCUMENT_LENGTH) {
        throw new Error('Markdown document is too large to render.');
    }
    const get = documentFetcher(fetcher);
    const { body: bodyAfterFrontmatter } = extractFrontmatter(stripPlaceholderChars(markdown));
    const { raw: defineRaw, body: bodyAfterDefine } = extractDefineBlock(bodyAfterFrontmatter);
    const interpolate = hasDefineEntries(defineRaw);
    const { scope } = interpolate
        ? await evaluateDefineBlock(defineRaw, get)
        : { scope: new Map() };
    const verbatimPlaceholders = new Map<string, string>();
    const { output: withConditionals } = await resolveConditionals(
        extractVerbatimBlocks(bodyAfterDefine, verbatimPlaceholders),
        scope,
        get,
        { inline: interpolate }
    );
    const interpolationPlaceholders = new Map<string, string>();
    const withInterpolationProtected = interpolate
        ? protectInterpolationTokens(withConditionals, interpolationPlaceholders)
        : withConditionals;
    const mathSources = new Map<string, MathSource>();
    const withMathExtracted = extractMath(withInterpolationProtected, mathSources);
    const { output: withInterpolated } = await resolveProtectedInterpolationTokens(
        withMathExtracted,
        interpolationPlaceholders,
        scope,
        get
    );
    const mathPlaceholders = await renderMathSources(mathSources, async source =>
        source.includes(placeholderPrefix('INTERPOLATION'))
            ? (
                  await resolveProtectedInterpolationTokens(
                      source,
                      interpolationPlaceholders,
                      scope,
                      get
                  )
              ).output
            : source
    );
    const references = extractReferences(withInterpolated);
    const icons = await loadIcons(references.markdown);
    const withContainers = parseContainers(convertGithubAlerts(references.markdown), icons);
    const rawHtml = parseWithOptions(withContainers, options);
    const withDetails = parseDetailsBlocks(rawHtml);
    const withSteps = parseSteps(withDetails);
    const withFootnotes = placeReferences(formatFootnoteReferences(withSteps), references.marker);
    const withMathRestored = restoreAllPlaceholders(withFootnotes, mathPlaceholders);
    const withUnwrappedBlocks = withMathRestored
        .replace(/<p>\s*(<div class="mdrs-math mdrs-math--block[\s\S]*?<\/div>)\s*<\/p>/gi, '$1')
        .replace(new RegExp(`<p>\\s*(${placeholderPattern('VERBATIM')})\\s*</p>`, 'gi'), '$1');
    return restoreAllPlaceholders(withUnwrappedBlocks, verbatimPlaceholders);
}

export async function renderMarkdown(
    markdown: string,
    fetcher: JsonFetcher = unavailableFetcher(),
    options: RenderOptions = {}
): Promise<string> {
    return sanitizeHtml(await renderMarkdownUnsafe(markdown, fetcher, options));
}

export async function prepareMarkdownPage(
    markdown: string,
    fetcher: JsonFetcher = unavailableFetcher(),
    options: RenderOptions = {}
): Promise<{ html: string; headings: HeadingItem[] }> {
    const rawHtml = await renderMarkdown(markdown, fetcher, options);
    const html = prefixHashLinks(injectHeadingIds(rawHtml));
    const headings = extractHeadings(html);
    return { html, headings };
}
