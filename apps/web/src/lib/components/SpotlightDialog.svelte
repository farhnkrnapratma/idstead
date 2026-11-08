<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import MailingDialog from './MailingDialog.svelte';
    import { type MailingCommand } from '#lib/mailing.ts';
    let mailingRequest = $state<MailingCommand | null>(null);
    import { onMount, tick } from 'svelte';
    import { spotlightStore } from '../stores/spotlightStore.svelte';
    import { goto, preloadData } from '$app/navigation';
    import { page } from '$app/state';
    import * as publicEnv from '$app/env/public';
    import { apiUrl } from '#lib/apiConfig.ts';
    import { SquareTerminal, Quote } from '@lucide/svelte';
    import { portal } from '@idstead/ui/utils/actions.ts';

    import { shortcutStore } from '@idstead/ui/stores/shortcutStore.svelte.ts';
    import { lockScroll } from '@idstead/ui/utils/scroll.ts';
    import { visualViewport } from '@idstead/ui/utils/visualViewport.svelte.ts';
    import ShareDialog from './ShareDialog.svelte';
    import QrCodeDialog from './QrCodeDialog.svelte';
    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';
    import {
        searchHistoryStore,
        type SearchHistoryEntry
    } from '../stores/searchHistoryStore.svelte';
    import { codeBlockPrefsStore } from '@mdrs/dom/codeBlockPrefsStore.svelte.ts';
    import { refreshCodeBlockPrefs } from '@mdrs/dom/codeBlocks.ts';

    import type { ItemCategory, SpotlightItem } from './spotlight/types';
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
    import { searchLocalItems as searchLocal, dedupeItems } from './spotlight/localSearch';
    import { resolveHistoryItem as resolveHistory } from './spotlight/history';
    import { enterTarget, stepIndex } from './spotlight/keyboard';
    import { mergeResults } from './spotlight/localSearch';
    import SpotlightHelpPanel from './SpotlightHelpPanel.svelte';
    import SpotlightSearchBar from './SpotlightSearchBar.svelte';
    import SpotlightFooter from './SpotlightFooter.svelte';
    import SpotlightResults from './SpotlightResults.svelte';
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

    const localMatcher = { fuzzy: fuzzyMatch, compile: compileRegexQuery };
    function searchLocalItems(q: string): SpotlightItem[] {
        return searchLocal(
            q,
            isRegex,
            {
                commands: defaultCommands,
                dynamicCommands: getDynamicCommandItems,
                projects,
                links: linkItems ?? []
            },
            localMatcher
        );
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
        return resolveHistory(entry, {
            defaultCommands,
            dynamicCommands: getDynamicCommandItems,
            projects,
            results
        });
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

    function toggleOption(option: 'case' | 'word' | 'regex') {
        if (option === 'case') isCaseSensitive = !isCaseSensitive;
        else if (option === 'word') isWholeWord = !isWholeWord;
        else isRegex = !isRegex;
        clearHighlightCache();
        runSearch(rawQuery);
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
            case 'ArrowDown':
            case 'ArrowUp': {
                e.preventDefault();
                e.stopPropagation();
                if (navLength > 0) {
                    activeIndex = stepIndex(e.key, activeIndex, navLength);
                    scrollActiveIntoView();
                }
                break;
            }
            case 'Enter': {
                e.preventDefault();
                e.stopPropagation();
                const target = enterTarget(activeIndex, filteredHistory.length, flatItems.length);
                if (target?.kind === 'history') {
                    const entry = filteredHistory[target.index];
                    if (entry) selectHistoryEntry(entry);
                } else if (target?.kind === 'item' && flatItems[target.index]) {
                    select(flatItems[target.index]);
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

    let deduplicatedResults = $derived(mergeResults(filteredHistory, [...results, ...postResults]));

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

    function selectHelpCommand(cmd: { command: string; actionQuery?: string }) {
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

<svelte:window onkeydown={handleGlobalKeydown} />

{#if isOpen}
    <div
        use:portal
        style:top={visualViewportTop !== null ? `${visualViewportTop}px` : undefined}
        style:height={visualViewportHeight !== null ? `${visualViewportHeight}px` : undefined}
        class="fixed inset-0 z-99999 flex items-start justify-center overscroll-contain p-4 transition-[top,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:pt-[12vh]">
        <button
            type="button"
            class="fixed inset-0 cursor-default touch-none bg-overlay/50 transition-opacity duration-200"
            aria-label="Close search"
            tabindex="-1"
            onwheel={e => e.preventDefault()}
            ontouchmove={e => e.preventDefault()}
            onclick={close}></button>

        <div
            style:max-height={visualViewportHeight !== null ?
                `${Math.min(visualViewportHeight * 0.85, (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.8)}px`
            :   undefined}
            class="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-md border-0 bg-surface text-fg shadow-xl transition-[max-height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none focus:outline-none md:w-[40vw] md:max-w-none"
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-label="Command palette and search"
            inert={showHelp}
            onkeydown={handleDialogTab}>
            <SpotlightSearchBar
                bind:rawQuery
                bind:inputEl
                {activeIndex}
                {isCaseSensitive}
                {isWholeWord}
                {isRegex}
                onInput={handleInput}
                onKeydown={handleKeydown}
                onToggle={toggleOption} />

            <SpotlightResults
                bind:activeIndex
                bind:listEl
                {filteredHistory}
                {categorizedResults}
                resultCount={deduplicatedResults.length}
                {isLoading}
                {rawQuery}
                {indexById}
                {getHistoryDisplay}
                {getHighlightChunks}
                {handleHistoryKeydown}
                {handleItemPointerMove}
                {handleResultKeydown}
                {changeSectionPage}
                {select}
                {selectHistoryEntry} />

            <SpotlightFooter
                {isLoading}
                query={rawQuery}
                resultCount={deduplicatedResults.length}
                hasPages={categorizedResults.some(group => group.hasPrev || group.hasNext)} />
        </div>
    </div>
{/if}

{#if showHelp}
    <SpotlightHelpPanel
        categories={visibleHelpCategories}
        {helpCmdIndexMap}
        bind:activeIndex={helpActiveIndex}
        bind:dialogEl={helpDialogEl}
        onClose={() => {
            showHelp = false;
            helpActiveIndex = -1;
            tick().then(() => inputEl?.focus());
        }}
        onOpenShortcuts={() => {
            showHelp = false;
            close();
            shortcutStore.catalogOpen = true;
        }}
        onSelect={selectHelpCommand}
        onPointerMove={handleHelpItemPointerMove}
        onKeydown={handleHelpKeydown} />
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
