import { extractReferences, placeReferences } from './references';
import { extractFrontmatter } from './frontmatter';
import {
    MAX_DOCUMENT_LENGTH,
    extractDefineBlock,
    evaluateDefineBlock,
    hasDefineEntries,
    protectInterpolationTokens,
    resolveProtectedInterpolationTokens,
    unavailableResolvers,
    type ApiRegistry
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
import { extractIgnoreRenderBlocks, protectIgnoreRenderBlocks } from './render/ignoreRender';
import { type MathSource, extractMath, renderMathSources } from './render/math';
import { parseWithOptions, type RenderOptions } from './render/parser';
import { parseSteps } from './render/steps';

export type { RenderOptions };

export async function resolveDefines(
    markdown: string,
    resolvers: ApiRegistry = unavailableResolvers()
): Promise<string> {
    const source = stripPlaceholderChars(markdown);
    const { body } = extractFrontmatter(source);
    const frontmatter = source.slice(0, source.length - body.length);
    const { raw: defineRaw, body: withDefineGap } = extractDefineBlock(body);
    if (defineRaw === null) return source;
    const bodyAfterDefine = withDefineGap.replace(/^(?:[ \t]*\r?\n)+/, '');
    if (!hasDefineEntries(defineRaw)) return frontmatter + bodyAfterDefine;
    const { scope } = await evaluateDefineBlock(defineRaw, resolvers);
    const ignoreRenderBlocks = new Map<string, string>();
    const interpolationPlaceholders = new Map<string, string>();
    const withTokensProtected = protectInterpolationTokens(
        protectIgnoreRenderBlocks(bodyAfterDefine, ignoreRenderBlocks),
        interpolationPlaceholders
    );
    const { output } = await resolveProtectedInterpolationTokens(
        withTokensProtected,
        interpolationPlaceholders,
        scope,
        resolvers
    );
    return frontmatter + restoreAllPlaceholders(output, ignoreRenderBlocks);
}

export async function renderMarkdownUnsafe(
    markdown: string,
    resolvers: ApiRegistry = unavailableResolvers(),
    options: RenderOptions = {}
): Promise<string> {
    if (markdown.length > MAX_DOCUMENT_LENGTH) {
        throw new Error('Markdown document is too large to render.');
    }
    const { body: bodyAfterFrontmatter } = extractFrontmatter(stripPlaceholderChars(markdown));
    const { raw: defineRaw, body: bodyAfterDefine } = extractDefineBlock(bodyAfterFrontmatter);
    const interpolate = hasDefineEntries(defineRaw);
    const { scope } =
        interpolate ? await evaluateDefineBlock(defineRaw, resolvers) : { scope: new Map() };
    const ignoreRenderPlaceholders = new Map<string, string>();
    const withRawBlocksExtracted = extractIgnoreRenderBlocks(
        bodyAfterDefine,
        ignoreRenderPlaceholders
    );
    const interpolationPlaceholders = new Map<string, string>();
    const withInterpolationProtected =
        interpolate ?
            protectInterpolationTokens(withRawBlocksExtracted, interpolationPlaceholders)
        :   withRawBlocksExtracted;
    const mathSources = new Map<string, MathSource>();
    const withMathExtracted = extractMath(withInterpolationProtected, mathSources);
    const { output: withInterpolated } = await resolveProtectedInterpolationTokens(
        withMathExtracted,
        interpolationPlaceholders,
        scope,
        resolvers
    );
    const mathPlaceholders = await renderMathSources(mathSources, async source =>
        source.includes(placeholderPrefix('INTERPOLATION')) ?
            (
                await resolveProtectedInterpolationTokens(
                    source,
                    interpolationPlaceholders,
                    scope,
                    resolvers
                )
            ).output
        :   source
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
        .replace(new RegExp(`<p>\\s*(${placeholderPattern('IGNORE_RENDER')})\\s*</p>`, 'gi'), '$1');
    return restoreAllPlaceholders(withUnwrappedBlocks, ignoreRenderPlaceholders);
}

export async function renderMarkdown(
    markdown: string,
    resolvers: ApiRegistry = unavailableResolvers(),
    options: RenderOptions = {}
): Promise<string> {
    return sanitizeHtml(await renderMarkdownUnsafe(markdown, resolvers, options));
}

export async function prepareMarkdownPage(
    markdown: string,
    resolvers: ApiRegistry = unavailableResolvers(),
    options: RenderOptions = {}
): Promise<{ html: string; headings: HeadingItem[] }> {
    const rawHtml = await renderMarkdown(markdown, resolvers, options);
    const html = prefixHashLinks(injectHeadingIds(rawHtml));
    const headings = extractHeadings(html);
    return { html, headings };
}
