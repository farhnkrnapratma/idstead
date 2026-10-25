<script lang="ts">
    import MailingDialog from './MailingDialog.svelte';
    import { type MailingCommand } from '#lib/mailing.ts';
    let mailingRequest = $state<MailingCommand | null>(null);
    import { SvelteSet } from 'svelte/reactivity';
    import { onMount, tick } from 'svelte';
    import { spotlightStore } from '../stores/spotlightStore.svelte';
    import { goto, preloadData } from '$app/navigation';
    import { page } from '$app/state';
    import * as publicEnv from '$app/env/public';
    import { apiUrl } from '#lib/apiConfig.ts';
    import {
        ArrowUpDown,
        CornerDownLeft,
        SquareTerminal,
        FolderOpen,
        X,
        CaseSensitive,
        WholeWord,
        Regex,
        ChevronLeft,
        ChevronRight,
        Keyboard,
        Quote
    } from '@lucide/svelte';
    import { portal } from '@idstead/ui/utils/actions.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import ShortcutBadge from '@idstead/ui/components/ShortcutBadge.svelte';
    import { KEY_GROUP_CLASS, KEY_SEGMENT_CLASS } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { elementRef } from '@idstead/ui/utils/elementRef.ts';
    import CommandSectionHeading from '@idstead/ui/components/CommandSectionHeading.svelte';
    import { shortcutStore } from '@idstead/ui/stores/shortcutStore.svelte.ts';
    import { CATALOG_KEY, COMMAND_SHORTCUTS, LEADER_COMBO } from '@idstead/ui/shortcuts.ts';
    import { lockScroll } from '@idstead/ui/utils/scroll.ts';
    import { visualViewport } from '@idstead/ui/utils/visualViewport.svelte.ts';
    import ShareDialog from './ShareDialog.svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import QrCodeDialog from './QrCodeDialog.svelte';
    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';
    import {
        searchHistoryStore,
        type SearchHistoryEntry
    } from '../stores/searchHistoryStore.svelte';
    import { codeBlockPrefsStore } from '@mdrs/dom/codeBlockPrefsStore.svelte.ts';
    import { refreshCodeBlockPrefs } from '@mdrs/dom/codeBlocks.ts';

    import type { ItemCategory, SpotlightItem, HelpCommandSpec } from './spotlight/types';
    import {
        SECTION_LABELS,
        CATEGORY_ICONS,
        ALL_ICON_COMPONENTS,
        ICON_NAME_BY_COMPONENT
    } from './spotlight/icons';
    import { helpCategories } from './spotlight/helpCommands';
    import { createDefaultCommands } from './spotlight/defaultCommands';
    import { isHiddenCommand } from '#app/commandVisibility.ts';
    import { isHiddenLegalPath } from '#app/legalVisibility.ts';
    import { createDynamicCommandItems } from './spotlight/dynamicCommands';
    import type { SpotlightCommandContext } from './spotlight/context';
    import {
        matchFuzzy,
        compileSearchRegex,
        highlightChunks,
        clearHighlightCache,
        type SearchFlags
    } from './spotlight/match';

    const projects = $derived(spotlightStore.projects);

    let isOpen = $state(false);
    let rawQuery = $state('');
    let isCaseSensitive = $state(false);
    let isWholeWord = $state(false);
    let isRegex = $state(false);
    let results = $state<SpotlightItem[]>([]);
    const SECTION_PAGE_SIZE = 5;
    let linkItems = $state<SpotlightItem[] | null>(null);
    let postResults = $state<SpotlightItem[]>([]);
    let postsHasMore = $state(false);
    let postsQuery = '';
    let sectionPages = $state<Record<string, number>>({});
    let activeIndex = $state(-1);
    let isLoading = $state(false);
    let showHelp = $state(false);
    let helpActiveIndex = $state(-1);
    let isShareOpen = $state(false);
    let isQrOpen = $state(false);
    let inputEl = $state<HTMLInputElement | null>(null);
    let listEl = $state<HTMLElement | null>(null);
    let helpDialogEl = $state<HTMLDivElement | null>(null);
    const visualViewportHeight = $derived(isOpen ? visualViewport.height : null);
    const visualViewportTop = $derived(isOpen ? visualViewport.offsetTop : null);

    const activePageContext = $derived.by(() => {
        if (!isQrOpen && !isShareOpen) {
            return { title: '', url: '', slug: 'page', avatarUrl: '', isBlogPost: false };
        }

        const post = (page.data as any)?.post;
        const author = (page.data as any)?.author;
        const authorAvatar = (author?.avatar as string | undefined) ?? '';
        const authorName = (author?.name as string | undefined) ?? '';
        const currentUrl = typeof window !== 'undefined' ? window.location.href : page.url.href;

        if (post?.title) {
            return {
                title: post.title as string,
                url: currentUrl,
                slug: (post.slug as string) || 'blog-post',
                avatarUrl: authorAvatar,
                isBlogPost: true
            };
        }

        const hash = (
            typeof window !== 'undefined' ?
                window.location.hash.replace(/^#/, '')
            :   (page.url.hash || '').replace(/^#/, '')).toLowerCase();

        if (hash && SECTION_LABELS[hash]) {
            const sectionLabel = SECTION_LABELS[hash];
            return {
                title: authorName ? `${sectionLabel} — ${authorName}` : sectionLabel,
                url: currentUrl,
                slug: hash,
                avatarUrl: authorAvatar,
                isBlogPost: false
            };
        }

        const docTitle =
            typeof document !== 'undefined' && document.title ? document.title
            : authorName ? `Portfolio — ${authorName}`
            : 'Portfolio';

        return {
            title: docTitle,
            url: currentUrl,
            slug: 'page',
            avatarUrl: authorAvatar,
            isBlogPost: false
        };
    });

    let debounceTimer: ReturnType<typeof setTimeout>;
    let searchAbortController: AbortController | null = null;

    const commandContext: SpotlightCommandContext = {
        close: () => close(),
        setHelp: open => {
            showHelp = open;
        },
        openShare: () => {
            isShareOpen = true;
        },
        openQr: () => {
            isQrOpen = true;
        },
        requestMailing: request => {
            mailingRequest = request;
        }
    };
    const allDefaultCommands = createDefaultCommands(commandContext);
    const defaultCommands = $derived(
        allDefaultCommands.filter(
            item => !isHiddenCommand(item.url) && !isHiddenCommand(item.title)
        )
    );
    const buildDynamicCommandItems = createDynamicCommandItems(commandContext);
    const getDynamicCommandItems = (query: string) =>
        buildDynamicCommandItems(query).filter(
            item => !isHiddenCommand(item.url) && !isHiddenCommand(item.title)
        );
    const visibleHelpCategories = $derived(
        helpCategories.map(category => ({
            ...category,
            commands: category.commands
                .filter(cmd => !isHiddenCommand(cmd.command))
                .map(cmd => ({
                    ...cmd,
                    validArgs: cmd.validArgs.filter(arg => !isHiddenLegalPath(arg))
                }))
        }))
    );
    const searchFlags = (): SearchFlags => ({
        caseSensitive: isCaseSensitive,
        wholeWord: isWholeWord,
        regex: isRegex
    });
    const fuzzyMatch = (target: string, queryText: string) =>
        matchFuzzy(target, queryText, searchFlags());
    const compileRegexQuery = (regexStr: string) => compileSearchRegex(regexStr, searchFlags());
    const getHighlightChunks = (text: string, query: string) =>
        highlightChunks(text, query, searchFlags());

    const helpCmdIndexMap = $derived(
        new Map(
            visibleHelpCategories
                .flatMap(category => category.commands)
                .map((cmd, index) => [cmd.command, index])
        )
    );

    async function loadLinkItems() {
        if (linkItems) return;
        const sources = [
            { category: 'social', path: 'socials', badge: 'Social' },
            { category: 'contact', path: 'contact', badge: 'Contact' },
            { category: 'funding', path: 'funding', badge: 'Funding' }
        ] as const;
        const lists = await Promise.all(
            sources.map(async source => {
                try {
                    const res = await fetch(
                        apiUrl(`/author?field=${source.path}`, publicEnv.PUBLIC_API_BASE_URL)
                    );
                    if (!res.ok) return [];
                    const data = (await res.json())?.[source.path];
                    return (Array.isArray(data) ? data : []).flatMap((link: any) => {
                        const url = link.url || link.href;
                        if (!link.platform || !url) return [];
                        return [
                            {
                                id: `link-${source.category}-${url}`,
                                category: source.category,
                                title: link.platform,
                                subtitle: link.displayValue || url,
                                url,
                                badge: source.badge
                            } satisfies SpotlightItem
                        ];
                    });
                } catch {
                    return [];
                }
            })
        );
        linkItems = lists.flat();
    }

    function toPostItem(post: any): SpotlightItem {
        return {
            id: `post-${post.url}`,
            category: 'posts',
            title: post.title,
            subtitle: post.subtitle ?? 'Blog post',
            url: post.url,
            icon: Quote,
            badge: 'Post'
        };
    }

    async function fetchPostsPage(query: string, page: number) {
        const res = await fetch(
            apiUrl(
                `/search?q=${encodeURIComponent(query)}&limit=${SECTION_PAGE_SIZE}&page=${page}`,
                publicEnv.PUBLIC_API_BASE_URL
            ),
            { signal: searchAbortController?.signal }
        );
        const data = await res.json();
        return {
            items: (data.data ?? []).map(toPostItem) as SpotlightItem[],
            hasMore: Boolean(data.pagination?.hasMore)
        };
    }

    function searchLocalItems(q: string): SpotlightItem[] {
        const cleanQ = q.trim();
        if (!cleanQ) {
            return [];
        }

        const isCommandQuery = cleanQ.startsWith('/');
        const isRegexQuery = isRegex;
        const compiledRegex = isRegexQuery ? compileRegexQuery(cleanQ) : null;

        const matchedItems: { item: SpotlightItem; score: number }[] = [];

        if (isCommandQuery) {
            const dynamicCmds = getDynamicCommandItems(cleanQ);
            for (const dyn of dynamicCmds) {
                if (
                    !isRegexQuery
                    || (compiledRegex
                        && (compiledRegex.test(dyn.title)
                            || (dyn.subtitle && compiledRegex.test(dyn.subtitle))))
                ) {
                    matchedItems.push({ item: dyn, score: 95 });
                }
            }
        }

        for (const cmd of defaultCommands) {
            if (isCommandQuery) {
                const cmdName = cmd.title.toLowerCase();
                const queryLower = cleanQ.toLowerCase();
                if (cmdName.startsWith(queryLower) || cmdName.includes(queryLower)) {
                    matchedItems.push({ item: cmd, score: 90 });
                    continue;
                }
            }

            const matchTitle = fuzzyMatch(cmd.title, cleanQ);
            const matchSub =
                cmd.subtitle ? fuzzyMatch(cmd.subtitle, cleanQ) : { matched: false, score: 0 };

            if (isRegexQuery) {
                if (
                    compiledRegex
                    && (compiledRegex.test(cmd.title)
                        || (cmd.subtitle && compiledRegex.test(cmd.subtitle)))
                ) {
                    matchedItems.push({ item: cmd, score: 75 });
                    continue;
                }
            }

            if (matchTitle.matched || matchSub.matched) {
                const titleScore = matchTitle.matched ? matchTitle.score : 0;
                const subScore = matchSub.matched ? matchSub.score * 0.5 : 0;
                matchedItems.push({ item: cmd, score: Math.max(titleScore, subScore) });
            }
        }

        for (const p of projects) {
            const projectTags = p.tags ?? [];
            const matchName = fuzzyMatch(p.name, cleanQ);
            const matchDesc = fuzzyMatch(p.desc, cleanQ);
            const tagMatch = projectTags.some(t => fuzzyMatch(t, cleanQ).matched);

            let isMatch = matchName.matched || matchDesc.matched || tagMatch;
            let score = Math.max(
                matchName.matched ? matchName.score : 0,
                matchDesc.matched ? matchDesc.score * 0.5 : 0
            );

            if (isRegexQuery) {
                if (
                    compiledRegex
                    && (compiledRegex.test(p.name)
                        || (p.desc && compiledRegex.test(p.desc))
                        || projectTags.some(t => compiledRegex.test(t)))
                ) {
                    isMatch = true;
                    score = 70;
                }
            }

            if (isMatch) {
                matchedItems.push({
                    item: {
                        id: `proj-${p.name}`,
                        category: 'projects',
                        title: p.name,
                        subtitle: p.desc || '',
                        url: p.url,
                        tags: (p.tags ?? []).slice(0, 3),
                        icon: FolderOpen,
                        badge: 'Project'
                    },
                    score
                });
            }
        }

        if (!isCommandQuery) {
            for (const link of linkItems ?? []) {
                const matchTitle = fuzzyMatch(link.title, cleanQ);
                const matchSub = fuzzyMatch(link.subtitle ?? '', cleanQ);
                let score = Math.max(
                    matchTitle.matched ? matchTitle.score : 0,
                    matchSub.matched ? matchSub.score * 0.5 : 0
                );
                let isMatch = matchTitle.matched || matchSub.matched;
                if (isRegexQuery) {
                    isMatch = Boolean(
                        compiledRegex
                        && (compiledRegex.test(link.title)
                            || compiledRegex.test(link.subtitle ?? ''))
                    );
                    score = isMatch ? 70 : 0;
                }
                if (isMatch) matchedItems.push({ item: link, score });
            }
        }

        const sorted =
            cleanQ === '/' ?
                matchedItems.sort((a, b) => a.item.title.localeCompare(b.item.title))
            :   matchedItems.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    if (isCommandQuery) {
                        return a.item.title.localeCompare(b.item.title);
                    }
                    const lenDiff = a.item.title.length - b.item.title.length;
                    if (lenDiff !== 0) return lenDiff;
                    return a.item.title.localeCompare(b.item.title);
                });

        const seenIds = new SvelteSet<string>();
        const seenTitles = new SvelteSet<string>();
        const uniqueMatches: SpotlightItem[] = [];

        for (const m of sorted) {
            const lowerTitle = m.item.title.toLowerCase();
            if (seenIds.has(m.item.id) || seenTitles.has(lowerTitle)) {
                continue;
            }
            seenIds.add(m.item.id);
            seenTitles.add(lowerTitle);
            uniqueMatches.push(m.item);
        }

        return uniqueMatches;
    }

    function dedupeItems(candidates: SpotlightItem[]): SpotlightItem[] {
        const seenIds = new SvelteSet<string>();
        const seenUrls = new SvelteSet<string>();
        const seenTitles = new SvelteSet<string>();
        const uniqueCombined: SpotlightItem[] = [];

        for (const item of candidates) {
            const lowerTitle = item.title.toLowerCase();
            if (
                seenIds.has(item.id)
                || seenTitles.has(lowerTitle)
                || (item.url && seenUrls.has(item.url))
            ) {
                continue;
            }
            seenIds.add(item.id);
            seenTitles.add(lowerTitle);
            if (item.url) seenUrls.add(item.url);
            uniqueCombined.push(item);
        }
        return uniqueCombined;
    }

    async function runSearch(inputString: string) {
        const trimmed = inputString.trim();
        sectionPages = {};
        if (trimmed.length < 1) {
            searchAbortController?.abort();
            results = [];
            postResults = [];
            postsHasMore = false;
            isLoading = false;
            activeIndex = -1;
            return;
        }

        searchAbortController?.abort();
        const controller = new AbortController();
        searchAbortController = controller;

        const isCommandQuery = trimmed.startsWith('/');
        postResults = [];
        postsHasMore = false;

        if (isCommandQuery && !trimmed.startsWith('/goto blog')) {
            results = dedupeItems(searchLocalItems(trimmed));
            activeIndex = -1;
            isLoading = false;
            return;
        }

        isLoading = true;
        if (!isCommandQuery) await loadLinkItems();
        if (controller.signal.aborted) return;

        const localMatches = searchLocalItems(trimmed);

        let candidates: SpotlightItem[];

        if (trimmed.length >= 2 && !isCommandQuery) {
            candidates = localMatches;
            postsQuery = trimmed;
            try {
                const page = await fetchPostsPage(trimmed, 1);
                if (controller.signal.aborted) return;
                postResults = page.items;
                postsHasMore = page.hasMore;
            } catch (err) {
                if ((err as Error)?.name === 'AbortError') return;
            }
        } else if (trimmed.startsWith('/goto blog')) {
            const blogSubQuery = trimmed.replace('/goto blog', '').trim();
            try {
                const res = await fetch(
                    apiUrl(
                        `/search?q=${encodeURIComponent(blogSubQuery || 'a')}`,
                        publicEnv.PUBLIC_API_BASE_URL
                    ),
                    { signal: controller.signal }
                );
                const data = await res.json();
                if (controller.signal.aborted) return;
                const postResults: SpotlightItem[] = (data.data ?? []).map((post: any) => ({
                    id: `open-post-${post.url}`,
                    category: 'posts' as const,
                    title: `/goto blog ${post.url.replace('/blog/', '')}`,
                    subtitle: post.title,
                    url: post.url,
                    icon: Quote,
                    badge: 'Post'
                }));
                candidates = [...localMatches, ...postResults];
            } catch (err) {
                if ((err as Error)?.name === 'AbortError') return;
                candidates = localMatches;
            }
        } else {
            candidates = localMatches;
        }

        if (controller.signal.aborted) return;

        results = dedupeItems(candidates);

        if (controller.signal.aborted) return;
        activeIndex = -1;
        isLoading = false;
    }

    function handleInput() {
        if (showHelp) showHelp = false;
        clearTimeout(debounceTimer);
        const trimmed = rawQuery.trim();
        if (trimmed.startsWith('/') && !trimmed.startsWith('/goto blog')) {
            runSearch(rawQuery);
            return;
        }
        debounceTimer = setTimeout(() => {
            runSearch(rawQuery);
        }, 150);
    }

    let previouslyFocusedElement = $state<HTMLElement | null>(null);

    function open(initialQuery = '') {
        if (typeof document !== 'undefined') {
            previouslyFocusedElement = document.activeElement as HTMLElement;
        }
        if (!isOpen) shortcutStore.pushScope('spotlight');
        isOpen = true;
        showHelp = false;
        rawQuery = initialQuery;
        activeIndex = -1;
        runSearch(initialQuery);
        tick().then(() => {
            if (listEl) listEl.scrollTop = 0;
            inputEl?.focus();
        });
    }

    function close() {
        clearTimeout(debounceTimer);
        searchAbortController?.abort();
        searchAbortController = null;
        clearHighlightCache();
        if (isOpen) shortcutStore.popScope('spotlight');
        isOpen = false;
        showHelp = false;
        rawQuery = '';
        results = [];
        postResults = [];
        postsHasMore = false;
        activeIndex = -1;
        if (previouslyFocusedElement) {
            tick().then(() => {
                previouslyFocusedElement?.focus({ preventScroll: true });
                previouslyFocusedElement = null;
            });
        }
    }

    const COMMAND_DEFAULTS: Record<string, () => void> = {
        '/theme': () => {
            const next = themeStore.cycle();
            toastStore.show(`Switched to ${next} theme`, 'success');
        },
        '/code': () => {
            codeBlockPrefsStore.cycleColorScheme();
            refreshCodeBlockPrefs();
            toastStore.show(
                `Code theme set to ${codeBlockPrefsStore.current.colorScheme}`,
                'success'
            );
        },
        '/copy': async () => {
            if (typeof window === 'undefined') return;
            await navigator.clipboard.writeText(window.location.href);
            toastStore.show('Page URL copied to clipboard', 'success');
        }
    };

    /**
     * Open palette: fill the input and hand off to the argument chord, never
     * execute. Closed palette: run it outright.
     */
    function runCommandShortcut(item: SpotlightItem) {
        const takesArgs = Boolean(item.requiresArgs || item.autocompleteQuery);

        if (isOpen) {
            rawQuery = item.autocompleteQuery || `${item.title} `;
            runSearch(rawQuery);
            activeIndex = -1;
            inputEl?.focus();
            if (takesArgs) {
                tick().then(() => shortcutStore.armGroup('args'));
            }
            return;
        }

        if (!takesArgs) {
            select(item);
            return;
        }

        const runDefault = COMMAND_DEFAULTS[item.title];
        if (runDefault) {
            void runDefault();
            return;
        }

        open(`${item.title} `);
        tick().then(() => shortcutStore.armGroup('args'));
    }

    onMount(() =>
        spotlightStore.attach({
            open: (initialQuery = '') => open(initialQuery),
            toggle: () => (isOpen ? close() : open()),
            focusOrOpen: initialQuery => {
                if (isOpen) inputEl?.focus();
                else open(initialQuery);
            },
            runCommand: title => {
                const item = defaultCommands.find(command => command.title === title);
                if (item) runCommandShortcut(item);
            }
        })
    );

    function select(item: SpotlightItem) {
        if (
            item.requiresArgs
            || (item.autocompleteQuery && !rawQuery.trim().endsWith(item.title))
        ) {
            rawQuery = item.autocompleteQuery || `${item.title} `;
            runSearch(rawQuery);
            activeIndex = -1;
            inputEl?.focus();
            return;
        }

        if (item.id === 'cmd-help' || item.title === '/help') {
            searchHistoryStore.record({
                id: item.id,
                category: item.category,
                title: item.title,
                subtitle: item.subtitle,
                badge: item.badge,
                iconName: item.icon ? ICON_NAME_BY_COMPONENT.get(item.icon) : undefined
            });
            showHelp = true;
            rawQuery = '';
            results = [];
            postResults = [];
            postsHasMore = false;
            activeIndex = -1;
            return;
        }

        if (!item.id.startsWith('dyn-mailing-')) {
            searchHistoryStore.record({
                id: item.id,
                category: item.category,
                title: item.title,
                subtitle: item.subtitle,
                badge: item.badge,
                iconName: item.icon ? ICON_NAME_BY_COMPONENT.get(item.icon) : undefined
            });
        }
        close();
        if (item.action) {
            item.action();
        } else if (item.url) {
            if (/^https?:/i.test(item.url)) {
                window.open(item.url, '_blank', 'noopener,noreferrer');
            } else if (/^(mailto|tel):/i.test(item.url)) {
                window.location.href = item.url;
            } else {
                goto(item.url);
            }
        }
    }

    function resolveHistoryItem(entry: SearchHistoryEntry): SpotlightItem | null {
        if (entry.id === 'dyn-code-minimal' || entry.title.toLowerCase() === '/code minimal') {
            const dynamic = getDynamicCommandItems('/code clean');
            const cleanItem = dynamic.find(d => d.id === 'dyn-code-clean');
            if (cleanItem) return cleanItem;
        }

        const fromDefault = defaultCommands.find(
            c => c.id === entry.id || c.title.toLowerCase() === entry.title.toLowerCase()
        );
        if (fromDefault) return fromDefault;

        if (entry.title.startsWith('/')) {
            const dynamic = getDynamicCommandItems(entry.title);
            const matchedDyn = dynamic.find(
                d => d.id === entry.id || d.title.toLowerCase() === entry.title.toLowerCase()
            );
            if (matchedDyn) return matchedDyn;
        }

        const matchedProject = projects.find(
            p => `proj-${p.name}` === entry.id || p.name.toLowerCase() === entry.title.toLowerCase()
        );
        if (matchedProject) {
            return {
                id: `proj-${matchedProject.name}`,
                category: 'projects',
                title: matchedProject.name,
                subtitle: matchedProject.desc,
                url: matchedProject.url,
                icon: FolderOpen,
                badge: 'Project'
            };
        }

        if (entry.category === 'posts' && entry.id.startsWith('post-')) {
            const postUrl = entry.id.replace('post-', '');
            return {
                id: entry.id,
                category: 'posts',
                title: entry.title,
                subtitle: entry.subtitle,
                url: postUrl,
                icon: Quote,
                badge: 'Post'
            };
        }

        const fromResults = results.find(
            r => r.id === entry.id || r.title.toLowerCase() === entry.title.toLowerCase()
        );
        if (fromResults) return fromResults;

        return null;
    }

    function getHistoryDisplay(entry: SearchHistoryEntry) {
        const icon =
            (entry.iconName && ALL_ICON_COMPONENTS[entry.iconName])
            || CATEGORY_ICONS[entry.category]
            || SquareTerminal;

        return { icon, title: entry.title, subtitle: entry.subtitle, badge: entry.badge };
    }

    function selectHistoryEntry(entry: SearchHistoryEntry) {
        const resolved = resolveHistoryItem(entry);
        if (resolved) {
            select(resolved);
        } else {
            rawQuery = entry.title;
            runSearch(rawQuery);
            activeIndex = -1;
            inputEl?.focus();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (!isOpen) return;
        // The shortcut registry runs first in the capture phase. When it consumed
        // the key — cancelling a chord, or picking one of a command's options —
        // this handler must not also act on it.
        if (e.defaultPrevented) return;

        if (showHelp) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                showHelp = false;
                tick().then(() => inputEl?.focus());
                return;
            }
            return;
        }

        const navLength = filteredHistory.length + flatItems.length;

        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                e.stopPropagation();
                if (navLength > 0) {
                    activeIndex = activeIndex < navLength - 1 ? activeIndex + 1 : 0;
                    scrollActiveIntoView();
                }
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                e.stopPropagation();
                if (navLength > 0) {
                    activeIndex = activeIndex > 0 ? activeIndex - 1 : navLength - 1;
                    scrollActiveIntoView();
                }
                break;
            }
            case 'Enter': {
                e.preventDefault();
                e.stopPropagation();
                if (
                    filteredHistory.length > 0
                    && activeIndex >= 0
                    && activeIndex < filteredHistory.length
                ) {
                    const entry = filteredHistory[activeIndex];
                    if (entry) selectHistoryEntry(entry);
                } else if (activeIndex >= filteredHistory.length && activeIndex < navLength) {
                    const itemIdx = activeIndex - filteredHistory.length;
                    if (flatItems[itemIdx]) {
                        select(flatItems[itemIdx]);
                    }
                } else if (filteredHistory.length > 0) {
                    selectHistoryEntry(filteredHistory[0]);
                } else if (flatItems.length > 0) {
                    select(flatItems[0]);
                }
                break;
            }
            case 'PageDown':
            case 'PageUp': {
                const category = activeCategory();
                if (!category) break;
                e.preventDefault();
                e.stopPropagation();
                void changeSectionPage(category, e.key === 'PageDown' ? 1 : -1);
                break;
            }
            case 'Escape': {
                e.preventDefault();
                e.stopPropagation();
                if (showHelp) {
                    showHelp = false;
                    inputEl?.focus();
                } else {
                    close();
                }
                break;
            }
        }
    }

    async function changeSectionPage(category: ItemCategory, delta: number) {
        const group = categorizedResults.find(g => g.category === category);
        if (!group || (delta > 0 && !group.hasNext) || (delta < 0 && !group.hasPrev)) return;
        const nextPage = group.page + delta;
        if (category === 'posts') {
            try {
                const page = await fetchPostsPage(postsQuery, nextPage);
                postResults = page.items;
                postsHasMore = page.hasMore;
            } catch {
                return;
            }
        }
        sectionPages = { ...sectionPages, [category]: nextPage };
        await tick();
        const first = categorizedResults.find(g => g.category === category)?.items[0];
        if (first) {
            activeIndex = (indexById.get(first.id) ?? 0) + filteredHistory.length;
            scrollActiveIntoView();
        }
    }

    function activeCategory(): ItemCategory | null {
        const itemIdx = activeIndex - filteredHistory.length;
        if (itemIdx >= 0 && flatItems[itemIdx]) return flatItems[itemIdx].category;
        return categorizedResults[0]?.category ?? null;
    }

    function handleDialogTab(e: KeyboardEvent) {
        if (e.defaultPrevented || e.key !== 'Tab') return;
        const dialog = e.currentTarget as HTMLElement;
        const focusables = Array.from(
            dialog.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]'
            )
        ).filter(
            element =>
                element.tabIndex >= 0
                && !element.matches(':disabled')
                && !element.closest('[inert]')
                && element.getClientRects().length > 0
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first) {
            e.preventDefault();
            dialog.focus();
            return;
        }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
            e.preventDefault();
            last.focus();
        } else if (
            !e.shiftKey
            && (document.activeElement === last || document.activeElement === dialog)
        ) {
            e.preventDefault();
            first.focus();
        }
    }

    function handleItemArrowKey(e: KeyboardEvent) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        handleKeydown(e);
        tick().then(() => {
            listEl?.querySelector<HTMLElement>(`#result-${activeIndex}`)?.focus();
        });
    }

    function handleResultKeydown(e: KeyboardEvent, item: SpotlightItem) {
        if (e.defaultPrevented) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select(item);
        } else {
            handleItemArrowKey(e);
        }
    }

    function handleHistoryKeydown(e: KeyboardEvent, entry: SearchHistoryEntry) {
        if (e.defaultPrevented) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectHistoryEntry(entry);
        } else {
            handleItemArrowKey(e);
        }
    }

    function scrollActiveIntoView() {
        if (!listEl || activeIndex < 0) return;
        if (activeIndex === 0) {
            listEl.scrollTop = 0;
            return;
        }
        const items = listEl.querySelectorAll('[data-result-item]');
        items[activeIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function handleGlobalKeydown(e: KeyboardEvent) {
        if (e.defaultPrevented) return;

        if (showHelp && e.key === 'Escape') {
            e.preventDefault();
            showHelp = false;
            tick().then(() => inputEl?.focus());
            return;
        }
        if (isOpen && e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
        }
    }

    $effect(() => {
        if (isOpen) return lockScroll();
    });

    $effect(() => {
        if (showHelp) {
            tick().then(() => helpDialogEl?.focus());
        }
    });

    let filteredHistory = $derived.by(() => {
        const allHistory = searchHistoryStore.current;
        if (allHistory.length === 0) return [];
        const trimmed = rawQuery.trim();
        if (!trimmed) return allHistory;

        if (trimmed === '/') {
            return allHistory;
        }

        return allHistory.filter(entry => {
            const matchTitle = fuzzyMatch(entry.title, trimmed);
            const matchSub =
                entry.subtitle ? fuzzyMatch(entry.subtitle, trimmed) : { matched: false, score: 0 };
            return matchTitle.matched || matchSub.matched;
        });
    });

    let deduplicatedResults = $derived.by(() => {
        const seenIds = new SvelteSet<string>();
        const seenTitles = new SvelteSet<string>();
        const seenUrls = new SvelteSet<string>();

        if (filteredHistory.length > 0) {
            for (const h of filteredHistory) {
                seenIds.add(h.id);
                seenTitles.add(h.title.toLowerCase());
            }
        }

        const unique: SpotlightItem[] = [];
        for (const item of [...results, ...postResults]) {
            const lowerTitle = item.title.toLowerCase();
            if (seenIds.has(item.id) || seenTitles.has(lowerTitle)) {
                continue;
            }
            if (item.url && seenUrls.has(item.url)) {
                continue;
            }
            seenIds.add(item.id);
            seenTitles.add(lowerTitle);
            if (item.url) {
                seenUrls.add(item.url);
            }
            unique.push(item);
        }
        return unique;
    });

    let lastPointerX = -1;
    let lastPointerY = -1;

    function handleItemPointerMove(e: PointerEvent, index: number) {
        if (e.clientX === lastPointerX && e.clientY === lastPointerY) return;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        activeIndex = index;
    }

    let categorizedResults = $derived.by(() => {
        const trimmed = rawQuery.trim();
        if (trimmed.length === 0) return [];

        const isCommandQuery = trimmed.startsWith('/');

        if (isCommandQuery) {
            if (deduplicatedResults.length === 0) return [];
            return [
                {
                    category: 'commands' as ItemCategory,
                    label: 'Commands',
                    items: deduplicatedResults,
                    page: 1,
                    pageCount: null,
                    hasPrev: false,
                    hasNext: false
                }
            ];
        }

        const groups: {
            category: ItemCategory;
            label: string;
            items: SpotlightItem[];
            page: number;
            pageCount: number | null;
            hasPrev: boolean;
            hasNext: boolean;
        }[] = [];
        const catMap: Record<ItemCategory, { label: string; items: SpotlightItem[] }> = {
            actions: { label: 'System actions', items: [] },
            pages: { label: 'Pages & Sections', items: [] },
            posts: { label: 'Blog posts', items: [] },
            projects: { label: 'Repositories', items: [] },
            commands: { label: 'Commands', items: [] },
            skills: { label: 'Skills & Tools', items: [] },
            social: { label: 'Social links', items: [] },
            contact: { label: 'Contact', items: [] },
            funding: { label: 'Funding', items: [] }
        };

        for (const item of deduplicatedResults) {
            catMap[item.category]?.items.push(item);
        }

        for (const [key, val] of Object.entries(catMap)) {
            if (val.items.length === 0) continue;
            const requested = sectionPages[key] ?? 1;
            if (key === 'posts') {
                groups.push({
                    category: 'posts',
                    label: val.label,
                    items: val.items,
                    page: requested,
                    pageCount: null,
                    hasPrev: requested > 1,
                    hasNext: postsHasMore
                });
                continue;
            }
            const pageCount = Math.ceil(val.items.length / SECTION_PAGE_SIZE);
            const page = Math.min(Math.max(requested, 1), pageCount);
            groups.push({
                category: key as ItemCategory,
                label: val.label,
                items: val.items.slice((page - 1) * SECTION_PAGE_SIZE, page * SECTION_PAGE_SIZE),
                page,
                pageCount,
                hasPrev: page > 1,
                hasNext: page < pageCount
            });
        }

        return groups;
    });

    let flatItems = $derived.by(() => {
        return categorizedResults.flatMap(group => group.items);
    });

    let indexById = $derived.by(() => {
        return new Map(flatItems.map((item, i) => [item.id, i]));
    });

    const preloadTarget = $derived.by(() => {
        if (!isOpen) return null;
        const itemIdx = activeIndex - filteredHistory.length;
        const item =
            activeIndex === -1 ? flatItems[0]
            : itemIdx >= 0 ? flatItems[itemIdx]
            : undefined;
        const url = item && !item.action ? item.url : undefined;
        return url?.startsWith('/') && !url.startsWith('//') ? url : null;
    });

    $effect(() => {
        if (preloadTarget) preloadData(preloadTarget).catch(() => {});
    });

    const flatHelpCommands = $derived(visibleHelpCategories.flatMap(cat => cat.commands));

    function selectHelpCommand(cmd: HelpCommandSpec) {
        showHelp = false;
        helpActiveIndex = -1;
        if (cmd.command === '/refresh') {
            if (typeof window !== 'undefined') window.location.reload();
        } else if (cmd.command === '/keyboard') {
            close();
            shortcutStore.catalogOpen = true;
        } else {
            rawQuery = cmd.actionQuery || cmd.command;
            runSearch(rawQuery);
            tick().then(() => inputEl?.focus());
        }
    }

    function handleHelpKeydown(e: KeyboardEvent) {
        handleDialogTab(e);
        if (e.defaultPrevented) return;
        const total = flatHelpCommands.length;
        if (!total) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            helpActiveIndex = helpActiveIndex < total - 1 ? helpActiveIndex + 1 : 0;
            tick().then(() => {
                helpDialogEl
                    ?.querySelector<HTMLElement>(`[data-help-idx="${helpActiveIndex}"]`)
                    ?.focus();
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            helpActiveIndex = helpActiveIndex > 0 ? helpActiveIndex - 1 : total - 1;
            tick().then(() => {
                helpDialogEl
                    ?.querySelector<HTMLElement>(`[data-help-idx="${helpActiveIndex}"]`)
                    ?.focus();
            });
        } else if (e.key === 'Enter' && e.target === helpDialogEl) {
            e.preventDefault();
            if (helpActiveIndex >= 0 && helpActiveIndex < total) {
                selectHelpCommand(flatHelpCommands[helpActiveIndex]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            showHelp = false;
            helpActiveIndex = -1;
            tick().then(() => inputEl?.focus());
        }
    }

    function handleHelpItemPointerMove(idx: number) {
        if (helpActiveIndex !== idx) helpActiveIndex = idx;
    }
</script>

{#snippet iconKey(Icon: typeof ArrowUpDown)}
    <span
        class={KEY_GROUP_CLASS}
        aria-hidden="true">
        <kbd class={cn(KEY_SEGMENT_CLASS, 'border-line-subtle/60 bg-surface text-fg-secondary')}>
            <Icon class="size-2.5" />
        </kbd>
    </span>
{/snippet}

<svelte:window onkeydown={handleGlobalKeydown} />

{#if isOpen}
    <div
        use:portal
        style:top={visualViewportTop !== null ? `${visualViewportTop}px` : undefined}
        style:height={visualViewportHeight !== null ? `${visualViewportHeight}px` : undefined}
        class="fixed inset-0 z-99999 flex items-center justify-center overscroll-contain p-4 transition-[top,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
        <button
            type="button"
            class="fixed inset-0 cursor-default touch-none bg-overlay/80 backdrop-blur-xs transition-opacity duration-200"
            aria-label="Close search"
            tabindex="-1"
            onwheel={e => e.preventDefault()}
            ontouchmove={e => e.preventDefault()}
            onclick={close}></button>

        <div
            style:max-height={visualViewportHeight !== null ?
                `${Math.min(visualViewportHeight * 0.85, (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.8)}px`
            :   undefined}
            class="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-md border-0 bg-surface text-fg shadow-xl backdrop-blur-md transition-[max-height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none focus:outline-none md:w-[40vw] md:max-w-none dark:border dark:border-fg/8"
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-label="Command palette and search"
            inert={showHelp}
            onkeydown={handleDialogTab}>
            <div
                class="flex items-center justify-between border-b border-line-subtle/40 px-3 py-1.5 sm:px-4 sm:py-2">
                <input
                    {@attach elementRef<HTMLInputElement>(node => (inputEl = node))}
                    bind:value={rawQuery}
                    oninput={handleInput}
                    onkeydown={handleKeydown}
                    type="search"
                    id="spotlight-search-input"
                    name="q"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="Search or type / for commands..."
                    class="search-input min-w-0 flex-1 border-none! border-transparent! bg-transparent py-0! pt-0! pb-0! font-mono text-xs font-medium text-fg shadow-none! ring-0! ring-transparent! ring-offset-0! outline-none! [-webkit-box-shadow:none]! [-webkit-tap-highlight-color:transparent] placeholder:font-mono placeholder:text-xs placeholder:font-normal placeholder:text-fg-muted focus:border-none! focus:border-transparent! focus:shadow-none! focus:ring-0! focus:ring-transparent! focus:outline-none! focus-visible:border-none! focus-visible:border-transparent! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:ring-transparent! focus-visible:outline-none! active:border-none! active:border-transparent! active:shadow-none! active:ring-0! active:ring-transparent! active:outline-none!"
                    aria-label="Search query"
                    aria-autocomplete="list"
                    aria-controls="search-results"
                    aria-activedescendant={activeIndex >= 0 ?
                        `result-${activeIndex}`
                    :   undefined} />

                <div class="flex shrink-0 items-center gap-0.5 pl-1.5 select-none sm:gap-1 sm:pl-2">
                    <Button
                        type="ghost"
                        size="xs"
                        class="flex size-5 cursor-pointer items-center justify-center rounded p-0 transition-colors hover:bg-surface-hover sm:size-6 sm:rounded-md"
                        title="Match Case ({isCaseSensitive ? 'ON' : 'OFF'})"
                        aria-label="Toggle case sensitivity"
                        aria-pressed={isCaseSensitive}
                        onclick={() => {
                            isCaseSensitive = !isCaseSensitive;
                            clearHighlightCache();
                            runSearch(rawQuery);
                        }}>
                        <CaseSensitive
                            class={cn(
                                'size-3 transition-colors sm:size-3.5',
                                isCaseSensitive ? 'text-fg-accent' : 'text-fg-muted hover:text-fg'
                            )} />
                    </Button>

                    <Button
                        type="ghost"
                        size="xs"
                        class="flex size-5 cursor-pointer items-center justify-center rounded p-0 transition-colors hover:bg-surface-hover sm:size-6 sm:rounded-md"
                        title="Match Whole Word ({isWholeWord ? 'ON' : 'OFF'})"
                        aria-label="Toggle whole word search"
                        aria-pressed={isWholeWord}
                        onclick={() => {
                            isWholeWord = !isWholeWord;
                            clearHighlightCache();
                            runSearch(rawQuery);
                        }}>
                        <WholeWord
                            class={cn(
                                'size-3 transition-colors sm:size-3.5',
                                isWholeWord ? 'text-fg-accent' : 'text-fg-muted hover:text-fg'
                            )} />
                    </Button>

                    <Button
                        type="ghost"
                        size="xs"
                        class="flex size-5 cursor-pointer items-center justify-center rounded p-0 transition-colors hover:bg-surface-hover sm:size-6 sm:rounded-md"
                        title="Use Regular Expression ({isRegex ? 'ON' : 'OFF'})"
                        aria-label="Toggle regular expression search"
                        aria-pressed={isRegex}
                        onclick={() => {
                            isRegex = !isRegex;
                            clearHighlightCache();
                            runSearch(rawQuery);
                        }}>
                        <Regex
                            class={cn(
                                'size-3 transition-colors sm:size-3.5',
                                isRegex ? 'text-fg-accent' : 'text-fg-muted hover:text-fg'
                            )} />
                    </Button>
                </div>
            </div>

            <div
                {@attach elementRef<HTMLDivElement>(node => (listEl = node))}
                class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {#if filteredHistory.length > 0}
                    <div class={cn('px-2.5 pt-2.5', deduplicatedResults.length === 0 && 'pb-2.5')}>
                        <div
                            class="flex items-center justify-between gap-2 px-2 pb-1.5 select-none">
                            <span class="text-xxs font-bold tracking-wider text-fg-muted">
                                Recents
                            </span>
                        </div>
                        <div class="flex flex-col gap-0.5">
                            {#each filteredHistory as entry, idx (entry.id)}
                                {@const historyDisplay = getHistoryDisplay(entry)}
                                {@const EntryIcon = historyDisplay.icon}
                                {@const historyShortcut =
                                    COMMAND_SHORTCUTS[historyDisplay.title.split(' ')[0]]}
                                {@const historyShortcutKey = historyShortcut ?? ''}
                                <div
                                    id="result-{idx}"
                                    role="option"
                                    tabindex="0"
                                    aria-selected={activeIndex === idx}
                                    data-result-item
                                    onfocus={() => (activeIndex = idx)}
                                    onclick={() => selectHistoryEntry(entry)}
                                    onkeydown={e => handleHistoryKeydown(e, entry)}
                                    onpointermove={e => handleItemPointerMove(e, idx)}
                                    class={cn(
                                        'group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md px-2 py-1.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                                        activeIndex === idx ?
                                            'bg-accent/10 text-fg dark:bg-accent/20'
                                        :   'text-fg-secondary hover:bg-surface-hover hover:text-fg'
                                    )}>
                                    <div class="flex min-w-0 flex-1 items-center gap-1.5">
                                        <div
                                            class={cn(
                                                'flex size-6 shrink-0 items-center justify-center transition-colors select-none',
                                                activeIndex === idx ? 'text-fg-accent' : (
                                                    'text-fg-secondary group-hover:text-fg-accent'
                                                )
                                            )}>
                                            <EntryIcon class="size-3.5" />
                                        </div>

                                        {#if historyDisplay.title.startsWith('/')}
                                            {@const spaceIdx = historyDisplay.title.indexOf(' ')}
                                            {@const verb =
                                                spaceIdx === -1 ?
                                                    historyDisplay.title
                                                :   historyDisplay.title.slice(0, spaceIdx)}
                                            {@const args =
                                                spaceIdx === -1 ? '' : (
                                                    historyDisplay.title.slice(spaceIdx)
                                                )}
                                            <div class="flex min-w-0 flex-1 items-center gap-2">
                                                <span class="shrink-0 font-mono text-xs">
                                                    {#each getHighlightChunks(verb, rawQuery) as chunk, cIdx (cIdx)}<span
                                                            class={chunk.match ?
                                                                'font-semibold text-fg-accent'
                                                            :   'font-medium text-fg'}
                                                            >{chunk.text}</span
                                                        >{/each}{#if args}{#each getHighlightChunks(args, rawQuery) as chunk, cIdx (cIdx)}<span
                                                                class={chunk.match ?
                                                                    'font-semibold text-fg-accent'
                                                                :   'font-normal text-fg-muted/60'}
                                                                >{chunk.text}</span
                                                            >{/each}{/if}
                                                </span>
                                                {#if historyDisplay.subtitle}
                                                    <span
                                                        class="text-2xs text-fg-muted/40 select-none"
                                                        >—</span>
                                                    <span
                                                        class="min-w-0 flex-1 truncate font-sans text-2xs text-fg-muted">
                                                        {#each getHighlightChunks(historyDisplay.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                                                            {#if chunk.match}
                                                                <span
                                                                    class="font-semibold text-fg-accent"
                                                                    >{chunk.text}</span>
                                                            {:else}
                                                                <span>{chunk.text}</span>
                                                            {/if}
                                                        {/each}
                                                    </span>
                                                {/if}
                                            </div>
                                        {:else}
                                            <div class="flex min-w-0 flex-1 items-center gap-2">
                                                <span
                                                    class="max-w-[45%] shrink-0 truncate text-xs font-medium text-fg sm:max-w-[55%]">
                                                    {#each getHighlightChunks(historyDisplay.title, rawQuery) as chunk, cIdx (cIdx)}
                                                        <span
                                                            class={chunk.match ?
                                                                'font-semibold text-fg-accent'
                                                            :   ''}>{chunk.text}</span>
                                                    {/each}
                                                </span>
                                                {#if historyDisplay.subtitle}
                                                    <span
                                                        class="text-2xs text-fg-muted/40 select-none"
                                                        >—</span>
                                                    <span
                                                        class="min-w-0 flex-1 truncate font-sans text-2xs text-fg-muted">
                                                        {#each getHighlightChunks(historyDisplay.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                                                            {#if chunk.match}
                                                                <span
                                                                    class="font-semibold text-fg-accent"
                                                                    >{chunk.text}</span>
                                                            {:else}
                                                                <span>{chunk.text}</span>
                                                            {/if}
                                                        {/each}
                                                    </span>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>

                                    <div class="flex shrink-0 items-center gap-0.5">
                                        {#if historyShortcut}
                                            <ShortcutBadge
                                                combo={historyShortcutKey}
                                                leader
                                                active={activeIndex === idx} />
                                        {/if}
                                        <span
                                            aria-hidden="true"
                                            class="flex size-6 shrink-0 items-center justify-center">
                                            <CornerDownLeft
                                                strokeWidth={1.5}
                                                class={cn(
                                                    'size-3 text-fg-accent group-hover:visible',
                                                    activeIndex === idx ? 'visible' : 'invisible'
                                                )} />
                                        </span>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if isLoading && deduplicatedResults.length === 0}
                    <div class="space-y-2 p-3">
                        {#each [1, 2, 3] as placeholderId (placeholderId)}
                            <div
                                class="flex animate-pulse items-center gap-3 rounded-md border border-line-subtle bg-surface-hover p-2.5 select-none">
                                <div class="size-4 shrink-0 rounded-md bg-line"></div>
                                <div class="flex-1 space-y-1.5">
                                    <div class="h-3 w-2/5 rounded bg-line"></div>
                                    <div class="h-2.5 w-3/5 rounded bg-line-subtle"></div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else if deduplicatedResults.length === 0 && filteredHistory.length === 0}
                    {#if rawQuery.length === 0}
                        <div
                            class="flex h-full flex-col items-center justify-center gap-1 px-4 py-8 text-center select-none">
                            <p class="text-xs font-medium text-fg-muted">
                                Search or run any commands
                            </p>
                            <p class="text-2xs text-fg-muted">
                                Type <span class="font-mono text-fg-accent">/</span> for commands,
                                or
                                <span class="font-mono text-fg-accent">/help</span> for the guide
                            </p>
                        </div>
                    {:else}
                        <div
                            class="flex h-full flex-col items-center justify-center px-4 py-10 text-center select-none">
                            <p class="text-xs font-medium text-fg-muted">No results found</p>
                        </div>
                    {/if}
                {:else if deduplicatedResults.length > 0}
                    <div
                        id="search-results"
                        role="listbox"
                        aria-label="Search results"
                        class="scrollbar-none px-2.5 pb-2.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {#each categorizedResults as group, gIdx (group.category)}
                            <div
                                class={cn(
                                    'px-2 pb-1.5 select-none',
                                    filteredHistory.length > 0 || gIdx > 0 ? 'pt-1.5' : 'pt-2.5'
                                )}>
                                <div class="flex items-center justify-between gap-2">
                                    <span class="text-xxs font-bold tracking-wider text-fg-muted">
                                        {group.label}
                                    </span>
                                    {#if group.hasPrev || group.hasNext}
                                        <div class="flex items-center gap-1 text-2xs text-fg-muted">
                                            <button
                                                type="button"
                                                aria-label="Previous {group.label} page"
                                                disabled={!group.hasPrev}
                                                onclick={() =>
                                                    changeSectionPage(group.category, -1)}
                                                class="inline-flex size-5 cursor-pointer items-center justify-center rounded-sm hover:bg-surface-hover disabled:cursor-default disabled:opacity-40">
                                                <ChevronLeft class="size-3" />
                                            </button>
                                            <span class="min-w-8 text-center tabular-nums">
                                                {group.pageCount ?
                                                    `${group.page} / ${group.pageCount}`
                                                :   group.page}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label="Next {group.label} page"
                                                disabled={!group.hasNext}
                                                onclick={() => changeSectionPage(group.category, 1)}
                                                class="inline-flex size-5 cursor-pointer items-center justify-center rounded-sm hover:bg-surface-hover disabled:cursor-default disabled:opacity-40">
                                                <ChevronRight class="size-3" />
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                            <div class="flex flex-col gap-0.5">
                                {#each group.items as item (item.id)}
                                    {@const globalIdx =
                                        (indexById.get(item.id) ?? 0) + filteredHistory.length}
                                    {@const ItemIcon =
                                        item.icon
                                        ?? CATEGORY_ICONS[item.category]
                                        ?? SquareTerminal}
                                    <div
                                        id="result-{globalIdx}"
                                        role="option"
                                        tabindex="0"
                                        aria-selected={activeIndex === globalIdx}
                                        data-result-item
                                        onfocus={() => (activeIndex = globalIdx)}
                                        onclick={() => select(item)}
                                        onkeydown={e => handleResultKeydown(e, item)}
                                        onpointermove={e => handleItemPointerMove(e, globalIdx)}
                                        class={cn(
                                            'group relative flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md px-2 py-1.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                                            activeIndex === globalIdx ?
                                                'bg-accent/10 text-fg dark:bg-accent/20'
                                            :   'text-fg-secondary hover:bg-surface-hover hover:text-fg'
                                        )}>
                                        <div class="flex min-w-0 flex-1 items-center gap-1.5">
                                            <div
                                                class={cn(
                                                    'flex size-6 shrink-0 items-center justify-center transition-colors select-none',
                                                    activeIndex === globalIdx ? 'text-fg-accent' : (
                                                        'text-fg-secondary group-hover:text-fg-accent'
                                                    )
                                                )}>
                                                <ItemIcon class="size-3.5" />
                                            </div>

                                            {#if item.title.startsWith('/')}
                                                {@const spaceIdx = item.title.indexOf(' ')}
                                                {@const verb =
                                                    spaceIdx === -1 ?
                                                        item.title
                                                    :   item.title.slice(0, spaceIdx)}
                                                {@const args =
                                                    spaceIdx === -1 ? '' : (
                                                        item.title.slice(spaceIdx)
                                                    )}
                                                <div class="flex min-w-0 flex-1 items-center gap-2">
                                                    <span class="shrink-0 font-mono text-xs">
                                                        {#each getHighlightChunks(verb, rawQuery) as chunk, cIdx (cIdx)}<span
                                                                class={chunk.match ?
                                                                    'font-semibold text-fg-accent'
                                                                :   'font-medium text-fg'}
                                                                >{chunk.text}</span
                                                            >{/each}{#if args}{#each getHighlightChunks(args, rawQuery) as chunk, cIdx (cIdx)}<span
                                                                    class={chunk.match ?
                                                                        'font-semibold text-fg-accent'
                                                                    :   'font-normal text-fg-muted/60'}
                                                                    >{chunk.text}</span
                                                                >{/each}{/if}
                                                    </span>
                                                    {#if item.subtitle}
                                                        <span
                                                            class="text-2xs text-fg-muted/40 select-none"
                                                            >—</span>
                                                        <span
                                                            class="min-w-0 flex-1 truncate font-sans text-2xs text-fg-muted">
                                                            {#each getHighlightChunks(item.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                                                                {#if chunk.match}
                                                                    <span
                                                                        class="font-semibold text-fg-accent"
                                                                        >{chunk.text}</span>
                                                                {:else}
                                                                    <span>{chunk.text}</span>
                                                                {/if}
                                                            {/each}
                                                        </span>
                                                    {/if}
                                                </div>
                                            {:else}
                                                <div class="flex min-w-0 flex-1 items-center gap-2">
                                                    <span
                                                        class="max-w-[45%] shrink-0 truncate text-xs font-medium text-fg sm:max-w-[55%]">
                                                        {#each getHighlightChunks(item.title, rawQuery) as chunk, cIdx (cIdx)}
                                                            <span
                                                                class={chunk.match ?
                                                                    'font-semibold text-fg-accent'
                                                                :   ''}>{chunk.text}</span>
                                                        {/each}
                                                    </span>
                                                    {#if item.subtitle}
                                                        <span
                                                            class="text-2xs text-fg-muted/40 select-none"
                                                            >—</span>
                                                        <span
                                                            class="min-w-0 flex-1 truncate font-sans text-2xs text-fg-muted">
                                                            {#each getHighlightChunks(item.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                                                                {#if chunk.match}
                                                                    <span
                                                                        class="font-semibold text-fg-accent"
                                                                        >{chunk.text}</span>
                                                                {:else}
                                                                    <span>{chunk.text}</span>
                                                                {/if}
                                                            {/each}
                                                        </span>
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>

                                        <div class="flex shrink-0 items-center gap-0.5">
                                            {#if COMMAND_SHORTCUTS[item.title]}
                                                <ShortcutBadge
                                                    combo={COMMAND_SHORTCUTS[item.title]}
                                                    leader
                                                    active={activeIndex === globalIdx} />
                                            {/if}
                                            <span
                                                aria-hidden="true"
                                                class="flex size-6 shrink-0 items-center justify-center">
                                                <CornerDownLeft
                                                    strokeWidth={1.5}
                                                    class={cn(
                                                        'size-3 text-fg-accent group-hover:visible',
                                                        activeIndex === globalIdx ? 'visible' : (
                                                            'invisible'
                                                        )
                                                    )} />
                                            </span>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <div
                class="hidden flex-none items-center justify-between gap-2 border-t border-line-subtle/60 px-3.5 py-2 text-2xs select-none sm:flex">
                <div
                    class="flex min-w-0 flex-1 items-center gap-3 text-2xs leading-none font-medium text-fg-muted">
                    <span
                        class="flex items-center"
                        title="Shortcut mode">
                        <span class="sr-only">Shortcut mode:</span>
                        <ShortcutBadge
                            combo={LEADER_COMBO}
                            leader />
                    </span>
                    {#if isLoading}
                        <span>Searching…</span>
                    {:else if rawQuery.trim()}
                        <span>
                            {deduplicatedResults.length}
                            result{deduplicatedResults.length === 1 ? '' : 's'}
                        </span>
                    {/if}
                </div>
                <div
                    class="flex shrink-0 items-center gap-2.5 text-2xs leading-none font-medium text-fg-muted">
                    <span class="flex items-center gap-1">
                        {@render iconKey(ArrowUpDown)}
                        <span class="hidden sm:inline">navigate</span>
                    </span>
                    {#if categorizedResults.some(group => group.hasPrev || group.hasNext)}
                        <span class="flex items-center gap-1">
                            <ShortcutBadge combo="PageUp" />
                            <ShortcutBadge combo="PageDown" />
                            <span class="hidden sm:inline">page</span>
                        </span>
                    {/if}
                    <span class="flex items-center gap-1">
                        {@render iconKey(CornerDownLeft)}
                        <span class="hidden sm:inline">execute</span>
                    </span>
                    <span class="flex items-center gap-1">
                        <ShortcutBadge combo="Esc" />
                        <span class="hidden sm:inline">close</span>
                    </span>
                </div>
            </div>
        </div>
    </div>
{/if}

{#if showHelp}
    <div
        use:portal
        class="fixed inset-0 z-100000 flex items-center justify-center overscroll-contain p-4">
        <button
            type="button"
            class="fixed inset-0 cursor-default touch-none bg-overlay/80 backdrop-blur-xs transition-opacity duration-200"
            aria-label="Close reference guide"
            tabindex="-1"
            onclick={() => {
                showHelp = false;
                helpActiveIndex = -1;
                tick().then(() => inputEl?.focus());
            }}></button>

        <div
            {@attach elementRef<HTMLDivElement>(node => (helpDialogEl = node))}
            class="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-md border-0 bg-surface text-fg shadow-xl backdrop-blur-md outline-none focus:outline-none md:w-[40vw] md:max-w-none dark:border dark:border-fg/8"
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-label="Reference guide"
            onkeydown={handleHelpKeydown}>
            <div
                class="flex items-center justify-between border-b border-line-subtle/40 px-4 py-2.5">
                <span class="text-xs font-bold tracking-wide text-fg select-none">
                    Reference Guide
                </span>
                <button
                    type="button"
                    onclick={() => {
                        showHelp = false;
                        helpActiveIndex = -1;
                        tick().then(() => inputEl?.focus());
                    }}
                    class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    aria-label="Close guide">
                    <X class="size-3.5" />
                </button>
            </div>

            <div class="flex-1 space-y-3 overflow-y-auto px-2.5 py-2.5 text-xs">
                {#each visibleHelpCategories as category (category.id)}
                    <section aria-label={category.label}>
                        <CommandSectionHeading
                            label={category.label}
                            context={category.context} />
                        <div class="flex flex-col gap-0.5">
                            {#each category.commands as cmd (cmd.command)}
                                {@const cmdIdx = helpCmdIndexMap.get(cmd.command) ?? 0}
                                {@const CmdIcon = cmd.icon}
                                <button
                                    type="button"
                                    data-help-idx={cmdIdx}
                                    onfocus={() => (helpActiveIndex = cmdIdx)}
                                    onclick={() => selectHelpCommand(cmd)}
                                    onpointermove={() => handleHelpItemPointerMove(cmdIdx)}
                                    class={cn(
                                        'group flex w-full cursor-pointer flex-col gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                                        helpActiveIndex === cmdIdx ?
                                            'bg-accent/10 text-fg dark:bg-accent/20'
                                        :   'text-fg-secondary hover:bg-surface-hover hover:text-fg'
                                    )}>
                                    <div class="flex min-w-0 items-start gap-1.5">
                                        <div
                                            class={cn(
                                                'flex size-6 shrink-0 items-center justify-center transition-colors select-none',
                                                helpActiveIndex === cmdIdx ? 'text-fg-accent' : (
                                                    'text-fg-secondary group-hover:text-fg-accent'
                                                )
                                            )}>
                                            <CmdIcon class="size-3.5" />
                                        </div>
                                        <div
                                            class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 py-1">
                                            <span class="font-mono text-xs font-medium text-fg">
                                                {cmd.command}{#if cmd.argHint}<span
                                                        class="ml-1 font-normal text-fg-muted">
                                                        {cmd.argHint}</span
                                                    >{/if}
                                            </span>
                                            <span
                                                class="hidden text-2xs text-fg-muted/40 select-none sm:inline"
                                                >—</span>
                                            <span
                                                class="min-w-0 basis-full font-sans text-2xs text-fg-muted sm:flex-1 sm:basis-auto">
                                                {cmd.description}
                                            </span>
                                        </div>
                                        {#if COMMAND_SHORTCUTS[cmd.command]}
                                            <span class="shrink-0 pt-1">
                                                <ShortcutBadge
                                                    combo={COMMAND_SHORTCUTS[cmd.command]}
                                                    leader
                                                    active={helpActiveIndex === cmdIdx} />
                                            </span>
                                        {/if}
                                    </div>
                                    {#if cmd.validArgs.length > 0}
                                        <div
                                            class="flex flex-wrap items-center gap-1 pl-7.5 font-mono text-3xs">
                                            {#each cmd.validArgs as arg (arg)}
                                                <span
                                                    class="inline-flex items-center rounded bg-surface-hover px-1 py-0.5 leading-normal text-fg-secondary"
                                                    >{arg}</span>
                                            {/each}
                                        </div>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    </section>
                {/each}

                <div>
                    <CommandSectionHeading label="Search filters" />
                    <div class="space-y-0.5 text-2xs">
                        <div
                            class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
                            <div class="flex min-w-0 items-center gap-2">
                                <div
                                    class="flex size-6 shrink-0 items-center justify-center text-fg-secondary select-none">
                                    <CaseSensitive class="size-3.5" />
                                </div>
                                <span class="font-medium text-fg">Match case</span>
                                <span class="text-fg-muted/40 select-none">—</span>
                                <span class="hidden font-sans text-fg-muted sm:inline"
                                    >Case-sensitive search toggle</span>
                            </div>
                            <span class="font-mono text-3xs text-fg-accent">Aa</span>
                        </div>
                        <div
                            class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
                            <div class="flex min-w-0 items-center gap-2">
                                <div
                                    class="flex size-6 shrink-0 items-center justify-center text-fg-secondary select-none">
                                    <WholeWord class="size-3.5" />
                                </div>
                                <span class="font-medium text-fg">Whole word</span>
                                <span class="text-fg-muted/40 select-none">—</span>
                                <span class="hidden font-sans text-fg-muted sm:inline"
                                    >Match exact whole words</span>
                            </div>
                            <span class="font-mono text-3xs text-fg-accent">ab</span>
                        </div>
                        <div
                            class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
                            <div class="flex min-w-0 items-center gap-2">
                                <div
                                    class="flex size-6 shrink-0 items-center justify-center text-fg-secondary select-none">
                                    <Regex class="size-3.5" />
                                </div>
                                <span class="font-medium text-fg">Regex mode</span>
                                <span class="text-fg-muted/40 select-none">—</span>
                                <span class="hidden font-sans text-fg-muted sm:inline"
                                    >Regular expression pattern matching</span>
                            </div>
                            <span class="font-mono text-3xs text-fg-accent">.*</span>
                        </div>
                    </div>
                </div>

                <div>
                    <CommandSectionHeading label="Keyboard shortcuts" />
                    <button
                        type="button"
                        class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover/70 focus-visible:outline-2 focus-visible:outline-focus-ring"
                        onclick={() => {
                            showHelp = false;
                            close();
                            shortcutStore.catalogOpen = true;
                        }}>
                        <div class="flex min-w-0 items-center gap-2">
                            <div
                                class="flex size-6 shrink-0 items-center justify-center text-fg-secondary select-none">
                                <Keyboard class="size-3.5" />
                            </div>
                            <span class="font-sans text-2xs text-fg-secondary">
                                Browse keyboard shortcuts on this page
                            </span>
                        </div>
                        <span class="flex shrink-0 items-center gap-1">
                            <ShortcutBadge
                                combo={CATALOG_KEY}
                                leader />
                        </span>
                    </button>
                </div>
            </div>

            <div
                class="hidden flex-none items-center justify-end gap-2.5 border-t border-line-subtle/60 px-3.5 py-2 text-2xs leading-none select-none sm:flex">
                <span class="flex items-center gap-1">
                    {@render iconKey(ArrowUpDown)}
                    <span class="text-fg-muted">navigate</span>
                </span>
                <span class="flex items-center gap-1">
                    {@render iconKey(CornerDownLeft)}
                    <span class="text-fg-muted">execute</span>
                </span>
                <span class="flex items-center gap-1">
                    <ShortcutBadge combo="Esc" />
                    <span class="text-fg-muted">close</span>
                </span>
            </div>
        </div>
    </div>
{/if}

<ShareDialog
    bind:isOpen={isShareOpen}
    title={activePageContext.isBlogPost ? 'Share this article' : 'Share this page'}
    articleTitle={activePageContext.title}
    url={activePageContext.url}
    showEmail
    onClose={() => (isShareOpen = false)}
    onOpenQr={() => (isQrOpen = true)} />

<QrCodeDialog
    bind:isOpen={isQrOpen}
    url={activePageContext.url}
    slug={activePageContext.slug}
    avatarUrl={activePageContext.avatarUrl}
    onClose={() => (isQrOpen = false)} />

<MailingDialog
    request={mailingRequest}
    onClose={() => (mailingRequest = null)} />

<style>
    @reference "@idstead/ui/styles/global.css";

    .search-input::-webkit-search-cancel-button,
    .search-input::-webkit-search-decoration,
    .search-input::-webkit-search-results-button,
    .search-input::-webkit-search-results-decoration {
        @apply hidden appearance-none;
    }
</style>
